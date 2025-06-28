import { supabase } from '../lib/supabase';
import type { Destination } from '../types';

export interface CreateDestinationInput {
  originalTask: string;
  userId: string;
}

export interface DestinationWithStats extends Destination {
  voyage_count: number;
  total_focus_time: number;
  last_visited: string | null;
}

export class DestinationService {
  /**
   * Create a new destination with AI-generated content
   */
  static async createDestination(input: CreateDestinationInput): Promise<Destination> {
    try {
      // Try AI generation first
      let destinationData;
      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-destination', {
          body: { 
            task: input.originalTask,
            userId: input.userId 
          }
        });

        if (aiError) throw aiError;
        destinationData = aiData;
      } catch (aiError) {
        console.warn('AI generation failed, using fallback:', aiError);
        destinationData = this.generateDestinationFallback(input.originalTask);
      }

      // Save to database
      const { data, error } = await supabase
        .from('destinations')
        .insert({
          user_id: input.userId,
          original_task: input.originalTask,
          destination_name: destinationData.destination_name,
          description: destinationData.description,
          related_apps: destinationData.related_apps,
          color_theme: destinationData.color_theme,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create destination:', error);
      throw new Error('Unable to create destination. Please try again.');
    }
  }

  /**
   * Get all destinations for a user
   */
  static async getUserDestinations(userId: string): Promise<Destination[]> {
    try {
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get destinations:', error);
      throw new Error('Unable to load destinations. Please try again.');
    }
  }

  /**
   * Get destinations with usage statistics
   */
  static async getUserDestinationsWithStats(userId: string): Promise<DestinationWithStats[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_destinations_with_stats', { user_id: userId });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get destinations with stats:', error);
      // Fallback to basic destinations without stats
      const destinations = await this.getUserDestinations(userId);
      return destinations.map(dest => ({
        ...dest,
        voyage_count: 0,
        total_focus_time: 0,
        last_visited: null,
      }));
    }
  }

  /**
   * Delete a destination and all related data
   */
  static async deleteDestination(destinationId: string): Promise<void> {
    try {
      // Delete related voyages and their distraction events first
      const { data: voyages } = await supabase
        .from('voyages')
        .select('id')
        .eq('destination_id', destinationId);

      if (voyages && voyages.length > 0) {
        const voyageIds = voyages.map(v => v.id);
        
        // Delete distraction events first
        await supabase
          .from('distraction_events')
          .delete()
          .in('voyage_id', voyageIds);
        
        // Delete voyages
        await supabase
          .from('voyages')
          .delete()
          .eq('destination_id', destinationId);
      }

      // Delete the destination
      const { error } = await supabase
        .from('destinations')
        .delete()
        .eq('id', destinationId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete destination:', error);
      throw new Error('Unable to delete destination. Please try again.');
    }
  }

  /**
   * Update destination details
   */
  static async updateDestination(
    destinationId: string, 
    updates: Partial<Pick<Destination, 'destination_name' | 'description' | 'color_theme'>>
  ): Promise<Destination> {
    try {
      const { data, error } = await supabase
        .from('destinations')
        .update(updates)
        .eq('id', destinationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to update destination:', error);
      throw new Error('Unable to update destination. Please try again.');
    }
  }

  /**
   * Fallback destination generation when AI is unavailable
   */
  private static generateDestinationFallback(task: string) {
    const taskLower = task.toLowerCase();
    
    // Enhanced keyword matching with more categories
    const destinationMap = [
      {
        keywords: ['thesis', 'research', 'paper', 'study', 'academic', 'dissertation'],
        name: 'Academic Archipelago',
        description: 'Navigate the seas of knowledge where every page is a pathway to wisdom.',
        apps: ['Zotero', 'Notion', 'Word', 'Google Scholar', 'Mendeley'],
        color: '#8B5CF6'
      },
      {
        keywords: ['code', 'programming', 'develop', 'build', 'software', 'app'],
        name: 'Code Cove',
        description: 'Where logic meets creativity to build digital wonders.',
        apps: ['VS Code', 'GitHub', 'Terminal', 'Stack Overflow', 'Docker'],
        color: '#10B981'
      },
      {
        keywords: ['piano', 'music', 'instrument', 'guitar', 'violin', 'compose'],
        name: 'Melody Marina',
        description: 'Let your fingers dance on keys, creating symphonies from the heart.',
        apps: ['Simply Piano', 'Flowkey', 'YouTube', 'Metronome', 'MuseScore'],
        color: '#F59E0B'
      },
      {
        keywords: ['fitness', 'exercise', 'workout', 'gym', 'training', 'sport'],
        name: 'Strength Summit',
        description: 'Climb the peaks of physical and mental fortitude through dedicated training.',
        apps: ['Nike Training', 'MyFitnessPal', 'Strava', 'Apple Health', 'YouTube'],
        color: '#EF4444'
      },
      {
        keywords: ['learn', 'course', 'education', 'skill', 'tutorial'],
        name: 'Wisdom Waters',
        description: 'Sail through islands of knowledge where every discovery opens new horizons.',
        apps: ['Anki', 'Notion', 'Khan Academy', 'Coursera', 'YouTube'],
        color: '#6366F1'
      },
      {
        keywords: ['write', 'writing', 'article', 'blog', 'content', 'story'],
        name: 'Writers Bay',
        description: 'Where thoughts flow like tides and every sentence sparkles with purpose.',
        apps: ['Notion', 'Typora', 'Grammarly', 'Hemingway Editor', 'Google Docs'],
        color: '#8B5CF6'
      },
      {
        keywords: ['design', 'creative', 'art', 'graphic', 'ui', 'ux'],
        name: 'Creative Coast',
        description: 'Where imagination meets skill to craft beautiful and meaningful designs.',
        apps: ['Figma', 'Adobe Creative Suite', 'Sketch', 'Canva', 'Pinterest'],
        color: '#EC4899'
      },
      {
        keywords: ['read', 'book', 'reading', 'literature', 'novel'],
        name: 'Literary Lagoon',
        description: 'Dive deep into stories and knowledge that expand your mind and soul.',
        apps: ['Kindle', 'Goodreads', 'Audible', 'Apple Books', 'Notion'],
        color: '#059669'
      },
      {
        keywords: ['business', 'finance', 'investment', 'startup', 'entrepreneur'],
        name: 'Commerce Cove',
        description: 'Navigate the currents of commerce where ideas transform into value.',
        apps: ['Excel', 'QuickBooks', 'Slack', 'Zoom', 'LinkedIn'],
        color: '#0891B2'
      }
    ];

    // Find matching destination
    const match = destinationMap.find(dest => 
      dest.keywords.some(keyword => taskLower.includes(keyword))
    );

    if (match) {
      return {
        destination_name: match.name,
        description: match.description,
        related_apps: match.apps,
        color_theme: match.color,
      };
    }

    // Generic fallback
    return {
      destination_name: `${task} Isle`,
      description: `A focused journey to accomplish ${task.toLowerCase()}, finding inner peace through concentration.`,
      related_apps: ['Chrome', 'Notion', 'Calendar', 'Timer', 'Music'],
      color_theme: '#3B82F6',
    };
  }
}