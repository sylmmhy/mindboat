import { create } from 'zustand';
import { supabase } from '../lib/supabase';
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
  endVoyage: () => Promise<void>;
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

      if (error) throw error;

      set({
        currentVoyage: data,
        isVoyageActive: true,
        distractionCount: 0,
        startTime,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to start voyage' });
    } finally {
      set({ isLoading: false });
    }
  },

  endVoyage: async () => {
    const { currentVoyage, startTime, distractionCount } = get();
    if (!currentVoyage || !startTime) return;

    set({ isLoading: true, error: null });
    
    try {
      const endTime = new Date();
      const actualDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 60000); // minutes

      const { error } = await supabase
        .from('voyages')
        .update({
          end_time: endTime.toISOString(),
          actual_duration: actualDuration,
          distraction_count: distractionCount,
          status: 'completed',
        })
        .eq('id', currentVoyage.id);

      if (error) throw error;

      // Update voyage history
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
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to end voyage' });
    } finally {
      set({ isLoading: false });
    }
  },

  recordDistraction: async (event) => {
    const { currentVoyage } = get();
    if (!currentVoyage) return;

    try {
      // Record distraction event
      const { error } = await supabase
        .from('distraction_events')
        .insert({
          voyage_id: currentVoyage.id,
          detected_at: new Date(event.timestamp).toISOString(),
          duration_seconds: event.duration,
          type: event.type,
        });

      if (error) throw error;

      // Update local distraction count
      set(state => ({
        distractionCount: state.distractionCount + 1
      }));
    } catch (error) {
      console.error('Failed to record distraction:', error);
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

      if (error) throw error;
      
      set({ voyageHistory: data || [] });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load voyage history' });
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