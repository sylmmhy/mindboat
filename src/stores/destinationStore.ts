import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Destination } from '../types';

interface DestinationState {
  destinations: Destination[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadDestinations: (userId: string) => Promise<void>;
  createDestination: (task: string, userId: string) => Promise<Destination | null>;
  deleteDestination: (id: string) => Promise<void>;
}

export const useDestinationStore = create<DestinationState>((set, get) => ({
  destinations: [],
  isLoading: false,
  error: null,

  loadDestinations: async (userId) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      set({ destinations: data || [] });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load destinations' });
    } finally {
      set({ isLoading: false });
    }
  },

  createDestination: async (task, userId) => {
    set({ isLoading: true, error: null });
    
    try {
      // Call Supabase Edge Function to generate destination with AI
      const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-destination', {
        body: { task, userId }
      });

      if (aiError) {
        // Fallback to simple destination creation if AI fails
        console.warn('AI generation failed, using fallback:', aiError);
        const fallbackDestination = {
          destination_name: `${task} 之旅`,
          description: `专注完成 ${task} 的美妙航程`,
          related_apps: ['Chrome', 'Notion', 'VS Code'],
          color_theme: '#3B82F6'
        };
        aiData = fallbackDestination;
      }

      // Save to database
      const { data, error } = await supabase
        .from('destinations')
        .insert({
          user_id: userId,
          original_task: task,
          destination_name: aiData.destination_name,
          description: aiData.description,
          related_apps: aiData.related_apps,
          color_theme: aiData.color_theme,
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      set(state => ({
        destinations: [data, ...state.destinations]
      }));

      return data;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create destination' });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteDestination: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const { error } = await supabase
        .from('destinations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        destinations: state.destinations.filter(d => d.id !== id)
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete destination' });
    } finally {
      set({ isLoading: false });
    }
  },
}));