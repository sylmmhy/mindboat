import { supabase } from '../lib/supabase';
import type { DistractionDetectionEvent } from '../types';

export interface DistractionEvent {
  id: string;
  voyage_id: string;
  detected_at: string;
  duration_seconds: number | null;
  type: 'tab_switch' | 'idle' | 'camera_distraction';
  user_response: 'return_to_course' | 'exploring' | 'ignored' | null;
}

export class DistractionService {
  /**
   * Record a distraction event
   */
  static async recordDistraction(
    voyageId: string, 
    event: DistractionDetectionEvent,
    userResponse?: 'return_to_course' | 'exploring' | 'ignored'
  ): Promise<DistractionEvent> {
    try {
      const { data, error } = await supabase
        .from('distraction_events')
        .insert({
          voyage_id: voyageId,
          detected_at: new Date(event.timestamp).toISOString(),
          duration_seconds: event.duration ? Math.floor(event.duration / 1000) : null,
          type: event.type,
          user_response: userResponse || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Update voyage distraction count atomically
      await this.incrementVoyageDistractionCount(voyageId);

      return data;
    } catch (error) {
      console.error('Failed to record distraction:', error);
      throw new Error('Unable to record distraction event.');
    }
  }

  /**
   * Update user response to a distraction
   */
  static async updateDistractionResponse(
    distractionId: string,
    response: 'return_to_course' | 'exploring' | 'ignored'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('distraction_events')
        .update({ user_response: response })
        .eq('id', distractionId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update distraction response:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get distraction events for a voyage
   */
  static async getVoyageDistractions(voyageId: string): Promise<DistractionEvent[]> {
    try {
      const { data, error } = await supabase
        .from('distraction_events')
        .select('*')
        .eq('voyage_id', voyageId)
        .order('detected_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get voyage distractions:', error);
      return [];
    }
  }

  /**
   * Get distraction patterns for analytics
   */
  static async getDistractionPatterns(userId: string, days = 30) {
    try {
      const { data, error } = await supabase
        .rpc('get_distraction_patterns', {
          user_id: userId,
          days_back: days
        });

      if (error) throw error;
      
      return data || {
        most_common_type: null,
        average_duration: 0,
        peak_distraction_hours: [],
        improvement_trend: 0
      };
    } catch (error) {
      console.error('Failed to get distraction patterns:', error);
      return {
        most_common_type: null,
        average_duration: 0,
        peak_distraction_hours: [],
        improvement_trend: 0
      };
    }
  }

  /**
   * Increment voyage distraction count atomically
   */
  private static async incrementVoyageDistractionCount(voyageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .rpc('increment_distraction_count', { voyage_id: voyageId });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to increment distraction count:', error);
      // Don't throw error as the main distraction recording succeeded
    }
  }

  /**
   * Get distraction summary for a voyage
   */
  static async getVoyageDistractionSummary(voyageId: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_voyage_distraction_summary', { voyage_id: voyageId });

      if (error) throw error;
      
      return data || {
        total_distractions: 0,
        by_type: {},
        total_distraction_time: 0,
        return_to_course_rate: 0
      };
    } catch (error) {
      console.error('Failed to get distraction summary:', error);
      return {
        total_distractions: 0,
        by_type: {},
        total_distraction_time: 0,
        return_to_course_rate: 0
      };
    }
  }
}