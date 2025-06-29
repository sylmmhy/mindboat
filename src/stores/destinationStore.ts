import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from './notificationStore';
import type { Destination } from '../types';

interface DestinationState {
  destinations: Destination[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadDestinations: (userId: string) => Promise<void>;
  createDestination: (task: string, userId: string) => Promise<Destination | null>;
  deleteDestination: (id: string) => Promise<void>;
  addDemoDestination: (task: string, userId: string) => Destination;
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
      console.warn('Failed to load destinations from database:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load destinations' });

      if (error instanceof Error && !error.message.includes('relation') && !error.message.includes('table')) {
        useNotificationStore.getState().showWarning(
          'Could not load destinations from database. You can still create new ones.',
          'Connection Issue'
        );
      }
    } finally {
      set({ isLoading: false });
    }
  },

  createDestination: async (task, userId) => {
    set({ isLoading: true, error: null });

    try {
      // First try to call the Edge Function for AI generation
      let aiData;
      try {
        const { data, error: aiError } = await supabase.functions.invoke('generate-destination', {
          body: { task, userId }
        });

        if (aiError) throw aiError;
        aiData = data;
      } catch (aiError) {
        console.warn('AI generation failed, using fallback:', aiError);
        // Fallback to simple destination creation
        aiData = generateDestinationFallback(task);
      }

      // Try to save to database
      const { data, error } = await supabase
        .from('destinations')
        .insert({
          original_task: task,
          destination_name: aiData.destination_name,
          description: aiData.description,
          related_apps: aiData.related_apps,
          color_theme: aiData.color_theme,
        })
        .select()
        .single();

      if (error) {
        // If database save fails, create a local demo destination
        console.warn('Database save failed, creating local destination:', error);
        const demoDestination = get().addDemoDestination(task, userId);

        return demoDestination;
      }

      // Update local state with database result
      set(state => ({
        destinations: [data, ...state.destinations]
      }));

      return data;
    } catch (error) {
      console.error('Failed to create destination:', error);

      // Create a demo destination as fallback
      const demoDestination = get().addDemoDestination(task, userId);

      useNotificationStore.getState().showError(
        'Failed to create destination. Created demo version instead.',
        'Creation Error'
      );

      return demoDestination;
    } finally {
      set({ isLoading: false });
    }
  },

  addDemoDestination: (task, userId) => {
    const aiData = generateDestinationFallback(task);
    const demoDestination: Destination = {
      id: `demo-${Date.now()}`,
      user_id: userId,
      original_task: task,
      destination_name: aiData.destination_name,
      description: aiData.description,
      related_apps: aiData.related_apps,
      color_theme: aiData.color_theme,
      created_at: new Date().toISOString(),
    };

    set(state => ({
      destinations: [demoDestination, ...state.destinations]
    }));

    return demoDestination;
  },

  deleteDestination: async (id) => {
    set({ isLoading: true, error: null });

    try {
      // If it's a demo destination, just remove from local state
      if (id.startsWith('demo-')) {
        set(state => ({
          destinations: state.destinations.filter(d => d.id !== id)
        }));

        // Remove verbose success notification - deletion is self-evident
        return;
      }

      // Try to delete from database
      const { error } = await supabase
        .from('destinations')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Database delete failed, removing locally:', error);
        // Remove verbose warning - graceful degradation is handled
      }

      // Remove from local state regardless of database result
      set(state => ({
        destinations: state.destinations.filter(d => d.id !== id)
      }));

      // Remove verbose success notification - deletion is self-evident
    } catch (error) {
      console.error('Failed to delete destination:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete destination' });

      useNotificationStore.getState().showError(
        'Failed to delete destination. Please try again.',
        'Delete Error'
      );
    } finally {
      set({ isLoading: false });
    }
  },
}));

// Fallback destination generation function
function generateDestinationFallback(task: string) {
  const taskLower = task.toLowerCase();

  let destinationName = '';
  let description = '';
  let relatedApps: string[] = [];
  let colorTheme = '#3B82F6';

  if (taskLower.includes('thesis') || taskLower.includes('research') || taskLower.includes('paper') || taskLower.includes('study')) {
    destinationName = 'Academic Archipelago';
    description = 'Navigate the seas of knowledge where every page is a pathway to wisdom.';
    relatedApps = ['Zotero', 'Notion', 'Word', 'Google Scholar', 'Mendeley'];
    colorTheme = '#8B5CF6';
  } else if (taskLower.includes('code') || taskLower.includes('programming') || taskLower.includes('develop') || taskLower.includes('build')) {
    destinationName = 'Code Cove';
    description = 'Where logic meets creativity to build digital wonders.';
    relatedApps = ['VS Code', 'GitHub', 'Terminal', 'Stack Overflow', 'Docker'];
    colorTheme = '#10B981';
  } else if (taskLower.includes('piano') || taskLower.includes('music') || taskLower.includes('instrument')) {
    destinationName = 'Melody Marina';
    description = 'Let your fingers dance on keys, creating symphonies from the heart.';
    relatedApps = ['Simply Piano', 'Flowkey', 'YouTube', 'Metronome', 'MuseScore'];
    colorTheme = '#F59E0B';
  } else if (taskLower.includes('fitness') || taskLower.includes('exercise') || taskLower.includes('workout') || taskLower.includes('gym')) {
    destinationName = 'Strength Summit';
    description = 'Climb the peaks of physical and mental fortitude through dedicated training.';
    relatedApps = ['Nike Training', 'MyFitnessPal', 'Strava', 'Apple Health', 'YouTube'];
    colorTheme = '#EF4444';
  } else if (taskLower.includes('learn') || taskLower.includes('course') || taskLower.includes('education')) {
    destinationName = 'Wisdom Waters';
    description = 'Sail through islands of knowledge where every discovery opens new horizons.';
    relatedApps = ['Anki', 'Notion', 'Khan Academy', 'Coursera', 'YouTube'];
    colorTheme = '#6366F1';
  } else if (taskLower.includes('write') || taskLower.includes('writing') || taskLower.includes('article') || taskLower.includes('blog')) {
    destinationName = 'Writers Bay';
    description = 'Where thoughts flow like tides and every sentence sparkles with purpose.';
    relatedApps = ['Notion', 'Typora', 'Grammarly', 'Hemingway Editor', 'Google Docs'];
    colorTheme = '#8B5CF6';
  } else if (taskLower.includes('design') || taskLower.includes('creative') || taskLower.includes('art')) {
    destinationName = 'Creative Coast';
    description = 'Where imagination meets skill to craft beautiful and meaningful designs.';
    relatedApps = ['Figma', 'Adobe Creative Suite', 'Sketch', 'Canva', 'Pinterest'];
    colorTheme = '#EC4899';
  } else if (taskLower.includes('read') || taskLower.includes('book') || taskLower.includes('reading')) {
    destinationName = 'Literary Lagoon';
    description = 'Dive deep into stories and knowledge that expand your mind and soul.';
    relatedApps = ['Kindle', 'Goodreads', 'Audible', 'Apple Books', 'Notion'];
    colorTheme = '#059669';
  } else {
    // Generic destination
    destinationName = `${task} Isle`;
    description = `A focused journey to accomplish ${task.toLowerCase()}, finding inner peace through concentration.`;
    relatedApps = ['Chrome', 'Notion', 'Calendar', 'Timer', 'Music'];
    colorTheme = '#3B82F6';
  }

  return {
    destination_name: destinationName,
    description,
    related_apps: relatedApps,
    color_theme: colorTheme,
  };
}