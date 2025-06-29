import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from './notificationStore';
import type { Voyage, DistractionDetectionEvent } from '../types';

interface VoyageState {
  currentVoyage: Voyage | null;
  voyageHistory: Voyage[];
  isVoyageActive: boolean;
  distractionCount: number;
  startTime: Date | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  startVoyage: (destinationId: string, userId: string, plannedDuration?: number) => Promise<void>;
  endVoyage: () => Promise<Voyage | null>;
  recordDistraction: (event: DistractionDetectionEvent) => Promise<void>;
  loadVoyageHistory: (userId: string) => Promise<void>;
  resetVoyageState: () => void;
}

export const useVoyageStore = create<VoyageState>((set, get) => ({
  currentVoyage: null,
  voyageHistory: [],
  isVoyageActive: false,
  distractionCount: 0,
  startTime: null,
  isLoading: false,
  error: null,

  startVoyage: async (destinationId, userId, plannedDuration) => {
    set({ isLoading: true, error: null });

    try {
      const startTime = new Date();

      const { data, error } = await supabase
        .from('voyages')
        .insert({
          user_id: userId,
          destination_id: destinationId,
          start_time: startTime.toISOString(),
          planned_duration: plannedDuration,
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
        });

        return;
      }

      set({
        currentVoyage: data,
        isVoyageActive: true,
        distractionCount: 0,
        startTime,
      });
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
    const { currentVoyage, distractionCount } = get();
    if (!currentVoyage) return null;

    set({ isLoading: true, error: null });

    try {
      const endTime = new Date();

      // Calculate actual duration from the voyage's start_time in the database
      const voyageStartTime = new Date(currentVoyage.start_time);
      const actualDuration = Math.floor((endTime.getTime() - voyageStartTime.getTime()) / 60000); // minutes

      // If it's a local voyage, just update local state
      if (currentVoyage.id.startsWith('local-')) {
        const updatedVoyage = {
          ...currentVoyage,
          end_time: endTime.toISOString(),
          actual_duration: actualDuration,
          distraction_count: distractionCount,
          status: 'completed' as const,
        };

        set(state => ({
          currentVoyage: null,
          isVoyageActive: false,
          distractionCount: 0,
          startTime: null,
          voyageHistory: [updatedVoyage, ...state.voyageHistory],
        }));

        return updatedVoyage;
      }

      const { data, error } = await supabase
        .from('voyages')
        .update({
          end_time: endTime.toISOString(),
          actual_duration: actualDuration,
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
          distraction_count: distractionCount,
          status: 'completed' as const,
        };

        set(state => ({
          currentVoyage: null,
          isVoyageActive: false,
          distractionCount: 0,
          startTime: null,
          voyageHistory: [localUpdatedVoyage, ...state.voyageHistory],
        }));

        return localUpdatedVoyage;
      } else {
        // Calculate voyage statistics after successful database update
        try {
          const { error: statsError } = await supabase
            .rpc('calculate_voyage_statistics', { voyage_id_param: currentVoyage.id });

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

  recordDistraction: async (event) => {
    const { currentVoyage } = get();
    if (!currentVoyage) return;

    // Always increment local counter immediately
    set(state => ({ distractionCount: state.distractionCount + 1 }));

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
      error: null,
    });
  },
}));