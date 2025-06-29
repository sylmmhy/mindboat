import { supabase } from '../lib/supabase';
import type { User } from '../types';

export interface UserProfile {
  id: string;
  lighthouse_goal: string | null;
  created_at: string;
  updated_at: string;
}

export class UserService {
  /**
   * Get user profile with lighthouse goal
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw new Error('Unable to load user profile. Please try again.');
    }
  }

  /**
   * Create or update user profile with lighthouse goal
   */
  static async upsertUserProfile(userId: string, lighthouseGoal: string): Promise<UserProfile> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          lighthouse_goal: lighthouseGoal,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to save user profile:', error);
      throw new Error('Unable to save your lighthouse goal. Please try again.');
    }
  }

  /**
   * Get user statistics for analytics
   */
  static async getUserStats(userId: string): Promise<{
    totalVoyages: number;
    totalFocusTime: number;
    averageFocusTime: number;
    destinationCount: number;
    thisWeekFocusTime: number;
  }> {
    try {
      // Get voyage statistics
      const { data: voyageStats, error: voyageError } = await supabase
        .rpc('get_user_voyage_stats', { user_id: userId });

      if (voyageError) throw voyageError;

      // Get destination count
      const { count: destinationCount, error: destError } = await supabase
        .from('destinations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (destError) throw destError;

      // Get this week's focus time
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: weekStats, error: weekError } = await supabase
        .from('voyages')
        .select('actual_duration')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('created_at', oneWeekAgo.toISOString());

      if (weekError) throw weekError;

      const thisWeekFocusTime = weekStats?.reduce((total, voyage) => 
        total + (voyage.actual_duration || 0), 0) || 0;

      return {
        totalVoyages: voyageStats?.total_voyages || 0,
        totalFocusTime: voyageStats?.total_focus_time || 0,
        averageFocusTime: voyageStats?.average_focus_time || 0,
        destinationCount: destinationCount || 0,
        thisWeekFocusTime,
      };
    } catch (error) {
      console.error('Failed to get user stats:', error);
      // Return zero stats instead of throwing to avoid breaking the UI
      return {
        totalVoyages: 0,
        totalFocusTime: 0,
        averageFocusTime: 0,
        destinationCount: 0,
        thisWeekFocusTime: 0,
      };
    }
  }

  /**
   * Delete user data (GDPR compliance)
   */
  static async deleteUserData(userId: string): Promise<void> {
    try {
      // Delete in order due to foreign key constraints
      await supabase.from('distraction_events').delete().in('voyage_id', 
        supabase.from('voyages').select('id').eq('user_id', userId)
      );
      
      await supabase.from('daily_reflections').delete().eq('user_id', userId);
      await supabase.from('voyages').delete().eq('user_id', userId);
      await supabase.from('destinations').delete().eq('user_id', userId);
      await supabase.from('user_profiles').delete().eq('id', userId);
      
    } catch (error) {
      console.error('Failed to delete user data:', error);
      throw new Error('Unable to delete user data. Please contact support.');
    }
  }
}