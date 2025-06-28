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

        useNotificationStore.getState().showWarning(
          'Voyage started locally. Progress may not be saved.',
          'Local Voyage'
        );
        
        return;
      }

      set({
        currentVoyage: data,
        isVoyageActive: true,
        distractionCount: 0,
        startTime,
      });

      useNotificationStore.getState().showSuccess(
        'Your voyage has begun! Stay focused on your destination.',
        'Voyage Started'
      );
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
    const { currentVoyage, startTime, distractionCount } = get();
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

        useNotificationStore.getState().showSuccess(
          `Voyage completed! You focused for ${actualDuration} minutes.`,
          'Local Voyage Complete'
        );
        
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
        useNotificationStore.getState().showWarning(
          'Voyage completed locally. Database sync failed.',
          'Sync Warning'
        );
        
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
        
        useNotificationStore.getState().showSuccess(
          `Voyage completed and saved! You focused for ${actualDuration} minutes.`,
          'Voyage Complete'
        );
      }

      // Use the data returned from the database update, or fallback to local calculation
      const updatedVoyage = data || {
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
    } catch (error) {
      console.error('Failed to end voyage:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to end voyage' });
      
      useNotificationStore.getState().showError(
        'Failed to save voyage completion. Your progress may be lost.',
        'Save Error'
      );
      
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  recordDistraction: async (event) => {
    const { currentVoyage } = get();
    if (!currentVoyage) return;
    
    // Capture current position for context
    const position = {
      x: Math.random() * 100, // In a real app, this could be actual scroll position or screen coordinates
      y: Math.random() * 100
    };

    try {
      // Determine if this is a completion update or new distraction
      const isCompletion = !!event.duration;
      
      // Always try to record to database, with fallback for local voyages
      const distractionData = {
        voyage_id: currentVoyage.id,
        detected_at: new Date(event.timestamp).toISOString(),
        duration_seconds: event.duration ? Math.floor(event.duration / 1000) : null,
        type: event.type,
        position_x: position.x,
        position_y: position.y,
        context_url: window.location.href,
        is_resolved: isCompletion,
      };

      let recordingSuccessful = false;

      // Try database recording unless it's a local voyage
      if (!currentVoyage.id.startsWith('local-')) {
        try {
          if (isCompletion) {
            // Try to update the most recent unresolved distraction of this type
            const { data: existingEvent, error: findError } = await supabase
              .from('distraction_events')
              .select('id')
              .eq('voyage_id', currentVoyage.id)
              .eq('type', event.type)
              .eq('is_resolved', false)
              .order('detected_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!findError && existingEvent) {
              // Update existing event with duration
              const { error: updateError } = await supabase
                .from('distraction_events')
                .update({
                  duration_seconds: Math.floor(event.duration / 1000),
                  is_resolved: true,
                })
                .eq('id', existingEvent.id);
              
              if (!updateError) {
                recordingSuccessful = true;
              }
            } else {
              // No existing event found, insert new complete record
              const { error } = await supabase
                .from('distraction_events')
                .insert(distractionData);
              
              if (!error) {
                recordingSuccessful = true;
              }
            }
          } else {
            // Insert new distraction start event
            const { error } = await supabase
              .from('distraction_events')
              .insert(distractionData);
            if (!error) {
              recordingSuccessful = true;
            }
          }
        } catch (dbError) {
          console.warn('Database error while recording distraction:', dbError);
        }
      }

      // Only increment local count for new distractions, not completions
      if (!isCompletion) {
        set(state => ({
          distractionCount: state.distractionCount + 1
        }));
      }

      // Show notifications appropriately
      if (!isCompletion) {
        const distractionMessages = {
          tab_switch: 'Tab switching detected',
          idle: 'Idle time detected',
          camera_distraction: 'Camera distraction detected'
        };

        useNotificationStore.getState().showInfo(
          distractionMessages[event.type] || 'Distraction detected',
          recordingSuccessful ? 'Focus Alert (Recorded)' : 'Focus Alert (Local)',
          { duration: 3000 }
        );
      } else {
        // Distraction resolved
        useNotificationStore.getState().showSuccess(
          'Back on track!',
          'Focus Restored',
          { duration: 2000 }
        );
      }
    } catch (error) {
      console.error('Failed to record distraction:', error);
      
      // Still update local count for new distractions even if recording fails
      if (!event.duration) {
        set(state => ({
          distractionCount: state.distractionCount + 1
        }));
      }
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