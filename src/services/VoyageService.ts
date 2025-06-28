import { supabase } from '../lib/supabase';
import type { Voyage, DistractionDetectionEvent } from '../types';

export interface StartVoyageInput {
  userId: string;
  destinationId: string;
  plannedDuration?: number;
}

export interface VoyageWithDestination extends Voyage {
  destination: {
    id: string;
    destination_name: string;
    description: string;
    color_theme: string;
  };
}

export class VoyageService {
  /**
   * Start a new voyage session
   */
  static async startVoyage(input: StartVoyageInput): Promise<VoyageWithDestination> {
    try {
      const startTime = new Date();
      
      const { data, error } = await supabase
        .from('voyages')
        .insert({
          user_id: input.userId,
          destination_id: input.destinationId,
          start_time: startTime.toISOString(),
          planned_duration: input.plannedDuration,
          status: 'active',
          weather_mood: 'sunny',
          distraction_count: 0,
        })
        .select(`
          *,
          destination:destinations(id, destination_name, description, color_theme)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to start voyage:', error);
      throw new Error('Unable to start voyage. Please try again.');
    }
  }

  /**
   * End a voyage session
   */
  static async endVoyage(voyageId: string): Promise<Voyage> {
    try {
      const endTime = new Date();
      
      // First get the voyage to calculate duration
      const { data: voyage, error: getError } = await supabase
        .from('voyages')
        .select('start_time, distraction_count')
        .eq('id', voyageId)
        .single();

      if (getError) throw getError;

      const startTime = new Date(voyage.start_time);
      const actualDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 60000); // minutes

      const { data, error } = await supabase
        .from('voyages')
        .update({
          end_time: endTime.toISOString(),
          actual_duration: actualDuration,
          status: 'completed',
        })
        .eq('id', voyageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to end voyage:', error);
      throw new Error('Unable to complete voyage. Please try again.');
    }
  }

  /**
   * Get active voyage for a user
   */
  static async getActiveVoyage(userId: string): Promise<VoyageWithDestination | null> {
    try {
      const { data, error } = await supabase
        .from('voyages')
        .select(`
          *,
          destination:destinations(id, destination_name, description, color_theme)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get active voyage:', error);
      throw new Error('Unable to load active voyage.');
    }
  }

  /**
   * Get voyage history for a user
   */
  static async getVoyageHistory(userId: string, limit = 50): Promise<VoyageWithDestination[]> {
    try {
      const { data, error } = await supabase
        .from('voyages')
        .select(`
          *,
          destination:destinations(id, destination_name, description, color_theme)
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get voyage history:', error);
      throw new Error('Unable to load voyage history.');
    }
  }

  /**
   * Abandon an active voyage
   */
  static async abandonVoyage(voyageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('voyages')
        .update({
          status: 'abandoned',
          end_time: new Date().toISOString(),
        })
        .eq('id', voyageId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to abandon voyage:', error);
      throw new Error('Unable to abandon voyage.');
    }
  }

  /**
   * Update voyage weather mood
   */
  static async updateWeatherMood(voyageId: string, mood: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('voyages')
        .update({ weather_mood: mood })
        .eq('id', voyageId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update weather mood:', error);
      // Don't throw error for weather updates as it's not critical
    }
  }

  /**
   * Get voyage statistics for a date range
   */
  static async getVoyageStats(userId: string, startDate: Date, endDate: Date) {
    try {
      const { data, error } = await supabase
        .rpc('get_voyage_stats_by_date', {
          user_id: userId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get voyage stats:', error);
      return {
        total_voyages: 0,
        total_focus_time: 0,
        average_duration: 0,
        total_distractions: 0
      };
    }
  }
}