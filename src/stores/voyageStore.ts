import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from './notificationStore';
import { getHighPrecisionTime, calculatePreciseDuration } from '../utils/precisionTimer';
import type { Voyage, DistractionDetectionEvent } from '../types';

interface VoyageState {
  currentVoyage: Voyage | null;
  voyageHistory: Voyage[];
  isVoyageActive: boolean;
  distractionCount: number;
  startTime: Date | null;
  preciseStartTime: number | null; // High precision start time in milliseconds
  isLoading: boolean;
  error: string | null;
  lastDistractionTime: number | null;  // Track last distraction to prevent rapid duplicates

  // Actions
  startVoyage: (destinationId: string, userId: string, plannedDuration?: number) => Promise<void>;
  endVoyage: () => Promise<Voyage | null>;
  recordDistraction: (event: DistractionDetectionEvent) => Promise<void>;
  loadVoyageHistory: (userId: string) => Promise<void>;
  resetVoyageState: () => void;
  
  // Internal helper for debounced distraction recording
  _shouldRecordDistraction: (timestamp: number) => boolean;
}

// Configuration for distraction debouncing
const DISTRACTION_DEBOUNCE_MS = 10000; // 10 seconds - can be modified

export const useVoyageStore = create<VoyageState>()(
  subscribeWithSelector((set, get) => ({
  currentVoyage: null,
  voyageHistory: [],
  isVoyageActive: false,
  distractionCount: 0,
  startTime: null,
  preciseStartTime: null,
  isLoading: false,
  error: null,
  lastDistractionTime: null,

  startVoyage: async (destinationId, userId, plannedDuration) => {
    set({ isLoading: true, error: null });

    try {
      const startTime = new Date();
      const preciseStartTime = getHighPrecisionTime();

      const { data, error } = await supabase
        .from('voyages')
        .insert({
          user_id: userId,
          destination_id: destinationId,
          start_time: startTime.toISOString(),
          planned_duration: plannedDuration,
          planned_duration_ms: plannedDuration ? plannedDuration * 60000 : null, // Convert to milliseconds
          start_time_precise_ms: Math.round(preciseStartTime),
          status: 'active',
          weather_mood: 'sunny', // Default weather
          distraction_count: 0,
        })
        .select(`
          *,
          destination:destinations(*)
        `)
        .single();

      if (error) {
        // If database fails, create a local voyage
        console.warn('Database voyage creation failed, creating local voyage:', error);

        const localVoyage: Voyage = {
          id: `local-${Date.now()}`,
          user_id: userId,
          destination_id: destinationId,
          start_time: startTime.toISOString(),
          planned_duration: plannedDuration,
          status: 'active',
          weather_mood: 'sunny',
          distraction_count: 0,
          created_at: startTime.toISOString(),
        };

        set({
          currentVoyage: localVoyage,
          isVoyageActive: true,
          distractionCount: 0,
          startTime,
          preciseStartTime,
        });

        // Reset distraction tracking for new voyage
        set({ lastDistractionTime: null });

        return;
      }

      set({
        currentVoyage: data,
        isVoyageActive: true,
        distractionCount: 0,
        startTime,
        preciseStartTime,
      });

      // Reset distraction tracking for new voyage
      set({ lastDistractionTime: null });

    } catch (error) {
      console.error('Failed to start voyage:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to start voyage' });

      useNotificationStore.getState().showError(
        'Failed to start your voyage. Please try again.',
        'Voyage Error'
      );
    } finally {
      set({ isLoading: false });
    }
  },

  endVoyage: async (): Promise<Voyage | null> => {
    const { currentVoyage, distractionCount, preciseStartTime } = get();
    if (!currentVoyage) return null;

    set({ isLoading: true, error: null });

    try {
      const endTime = new Date();
      const preciseEndTime = getHighPrecisionTime();

      // Calculate actual duration from the voyage's start_time in the database
      const voyageStartTime = new Date(currentVoyage.start_time);
      const actualDuration = Math.floor((endTime.getTime() - voyageStartTime.getTime()) / 60000); // minutes
      
      // Calculate precise duration in milliseconds
      const preciseDuration = preciseStartTime ? 
        Math.round(calculatePreciseDuration(preciseStartTime, preciseEndTime)) : 
        (endTime.getTime() - voyageStartTime.getTime());

      // If it's a local voyage, just update local state
      if (currentVoyage.id.startsWith('local-')) {
        const updatedVoyage = {
          ...currentVoyage,
          end_time: endTime.toISOString(),
          actual_duration: actualDuration,
          actual_duration_ms: preciseDuration,
          distraction_count: distractionCount,
          status: 'completed' as const,
        };

        set(state => ({
          currentVoyage: null,
          isVoyageActive: false,
          distractionCount: 0,
          startTime: null,
          preciseStartTime: null,
          voyageHistory: [updatedVoyage, ...state.voyageHistory],
        }));

        return updatedVoyage;
      }

      const { data, error } = await supabase
        .from('voyages')
        .update({
          end_time: endTime.toISOString(),
          actual_duration: actualDuration,
          actual_duration_ms: preciseDuration,
          distraction_count: distractionCount,
          status: 'completed',
        })
        .eq('id', currentVoyage.id)
        .select()
        .single();

      if (error) {
        console.warn('Database voyage update failed:', error);

        // Return local updated voyage even if database update failed
        const localUpdatedVoyage = {
          ...currentVoyage,
          end_time: endTime.toISOString(),
          actual_duration: actualDuration,
          actual_duration_ms: preciseDuration,
          distraction_count: distractionCount,
          status: 'completed' as const,
        };

        set(state => ({
          currentVoyage: null,
          isVoyageActive: false,
          distractionCount: 0,
          startTime: null,
          preciseStartTime: null,
          voyageHistory: [localUpdatedVoyage, ...state.voyageHistory],
        }));

        return localUpdatedVoyage;
      } else {
        // Calculate voyage statistics after successful database update
        try {
          const { error: statsError } = await supabase
            .rpc('calculate_voyage_statistics_precise', { voyage_id_param: currentVoyage.id });

          if (statsError) {
            console.warn('Failed to calculate voyage statistics:', statsError);
          }
        } catch (statsError) {
          console.warn('Error calculating voyage statistics:', statsError);
        }

        set(state => ({
          currentVoyage: null,
          isVoyageActive: false,
          distractionCount: 0,
          startTime: null,
          preciseStartTime: null,
          voyageHistory: [data, ...state.voyageHistory],
        }));

        return data;
      }
    } catch (error) {
      console.error('Failed to end voyage:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to end voyage' });

      useNotificationStore.getState().showError(
        'Failed to complete your voyage. Please try again.',
        'Voyage Error'
      );

      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  _shouldRecordDistraction: (timestamp: number): boolean => {
    const { lastDistractionTime } = get();
    
    // Always record if this is the first distraction
    if (!lastDistractionTime) {
      return true;
    }
    
    // Only record if enough time has passed since last distraction
    const timeSinceLastDistraction = timestamp - lastDistractionTime;
    const shouldRecord = timeSinceLastDistraction >= DISTRACTION_DEBOUNCE_MS;
    
    if (import.meta.env.DEV) {
      console.log(`🔄 [DEBOUNCE] Distraction debounce check:`, {
        shouldRecord,
        timeSinceLastDistraction: `${Math.round(timeSinceLastDistraction / 1000)}s`,
        debounceThreshold: `${DISTRACTION_DEBOUNCE_MS / 1000}s`,
        lastDistractionTime: new Date(lastDistractionTime).toLocaleTimeString()
      });
    }
    
    return shouldRecord;
  },

  recordDistraction: async (event) => {
    const { currentVoyage } = get();
    if (!currentVoyage) return;

    // Check if we should record this distraction (debouncing)
    const shouldRecord = get()._shouldRecordDistraction(event.timestamp);
    
    if (!shouldRecord) {
      if (import.meta.env.DEV) {
        console.log(`⏭️ [DEBOUNCE] Skipping distraction - too soon after last one`);
      }
      return;
    }

    // Record this distraction timestamp and increment counter
    set(state => ({ 
      distractionCount: state.distractionCount + 1,
      lastDistractionTime: event.timestamp
    }));

    if (import.meta.env.DEV) {
      console.log(`📊 [DISTRACTION] Recorded new distraction (#${get().distractionCount})`, {
        type: event.type,
        timestamp: new Date(event.timestamp).toLocaleTimeString(),
        duration: event.duration ? `${Math.round(event.duration / 1000)}s` : 'ongoing'
      });
    }

    try {
      // Try to save to database
      const { error } = await supabase
        .from('distraction_events')
        .insert({
          voyage_id: currentVoyage.id,
          detected_at: new Date(event.timestamp).toISOString(),
          duration_seconds: event.duration ? Math.round(event.duration / 1000) : null,
          type: event.type,
        });

      if (error && !currentVoyage.id.startsWith('local-')) {
        console.warn('Failed to save distraction event:', error);
      }

      // Update voyage distraction count in database (if not local)
      if (!currentVoyage.id.startsWith('local-')) {
        try {
          const { distractionCount } = get();
          await supabase
            .from('voyages')
            .update({ distraction_count: distractionCount })
            .eq('id', currentVoyage.id);
        } catch (updateError) {
          console.warn('Failed to update voyage distraction count:', updateError);
        }
      }
    } catch (error) {
      console.warn('Failed to record distraction:', error);
      // Keep local counter updated even if database fails
    }
  },

  loadVoyageHistory: async (userId) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('voyages')
        .select(`
          *,
          destination:destinations(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Failed to load voyage history:', error);
        useNotificationStore.getState().showWarning(
          'Could not load voyage history from database.',
          'Connection Issue'
        );
        return;
      }

      set({ voyageHistory: data || [] });

      if (data && data.length > 0) {
        useNotificationStore.getState().showSuccess(
          `Loaded ${data.length} completed voyage${data.length === 1 ? '' : 's'}`,
          'History Loaded'
        );
      }
    } catch (error) {
      console.error('Failed to load voyage history:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load voyage history' });

      useNotificationStore.getState().showError(
        'Failed to load voyage history. Please try again.',
        'Load Error'
      );
    } finally {
      set({ isLoading: false });
    }
  },

  resetVoyageState: () => {
    set({
      currentVoyage: null,
      isVoyageActive: false,
      distractionCount: 0,
      startTime: null,
      preciseStartTime: null,
      lastDistractionTime: null,
      error: null,
    });
  },
})));