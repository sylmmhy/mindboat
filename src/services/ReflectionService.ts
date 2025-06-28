import { supabase } from '../lib/supabase';

export interface DailyReflection {
  id: string;
  user_id: string;
  date: string;
  reflection_text: string | null;
  total_focus_time: number;
  voyage_count: number;
  generated_at: string;
}

export class ReflectionService {
  /**
   * Generate daily reflection using AI
   */
  static async generateDailyReflection(userId: string, date: Date): Promise<DailyReflection> {
    try {
      // Get voyages data for the day
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: voyages, error: voyageError } = await supabase
        .from('voyages')
        .select(`
          *,
          destination:destinations(destination_name, description),
          distraction_events(type, duration_seconds, user_response)
        `)
        .eq('user_id', userId)
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString());

      if (voyageError) throw voyageError;

      const totalFocusTime = voyages?.reduce((sum, v) => sum + (v.actual_duration || 0), 0) || 0;
      const voyageCount = voyages?.length || 0;

      let reflectionText = null;

      // Try to generate AI reflection if there's activity
      if (voyageCount > 0) {
        try {
          const { data: aiReflection, error: aiError } = await supabase.functions.invoke('generate-reflection', {
            body: {
              voyages,
              totalFocusTime,
              voyageCount,
              date: date.toISOString()
            }
          });

          if (aiError) throw aiError;
          reflectionText = aiReflection.reflection;
        } catch (aiError) {
          console.warn('AI reflection generation failed, using fallback:', aiError);
          reflectionText = this.generateFallbackReflection(voyages, totalFocusTime, voyageCount);
        }
      }

      // Save to database
      const { data, error } = await supabase
        .from('daily_reflections')
        .upsert({
          user_id: userId,
          date: date.toISOString().split('T')[0],
          reflection_text: reflectionText,
          total_focus_time: totalFocusTime,
          voyage_count: voyageCount,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to generate daily reflection:', error);
      throw new Error('Unable to generate daily reflection.');
    }
  }

  /**
   * Get daily reflection for a specific date
   */
  static async getDailyReflection(userId: string, date: Date): Promise<DailyReflection | null> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('daily_reflections')
        .select('*')
        .eq('user_id', userId)
        .eq('date', dateStr)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get daily reflection:', error);
      return null;
    }
  }

  /**
   * Get reflection history for a user
   */
  static async getReflectionHistory(userId: string, limit = 30): Promise<DailyReflection[]> {
    try {
      const { data, error } = await supabase
        .from('daily_reflections')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get reflection history:', error);
      return [];
    }
  }

  /**
   * Generate weekly summary reflection
   */
  static async generateWeeklySummary(userId: string, weekStart: Date): Promise<string> {
    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const { data: reflections, error } = await supabase
        .from('daily_reflections')
        .select('*')
        .eq('user_id', userId)
        .gte('date', weekStart.toISOString().split('T')[0])
        .lte('date', weekEnd.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      if (!reflections || reflections.length === 0) {
        return "A quiet week on the seas of focus. Sometimes the strongest sailors take time to prepare for their next great voyage.";
      }

      // Try AI generation for weekly summary
      try {
        const { data: aiSummary, error: aiError } = await supabase.functions.invoke('generate-reflection', {
          body: {
            reflections,
            type: 'weekly_summary',
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString()
          }
        });

        if (aiError) throw aiError;
        return aiSummary.reflection;
      } catch (aiError) {
        console.warn('AI weekly summary failed, using fallback:', aiError);
        return this.generateFallbackWeeklySummary(reflections);
      }
    } catch (error) {
      console.error('Failed to generate weekly summary:', error);
      return "Your week of focused sailing continues. Every moment of attention is a step toward your lighthouse.";
    }
  }

  /**
   * Fallback reflection generation when AI is unavailable
   */
  private static generateFallbackReflection(voyages: any[], totalFocusTime: number, voyageCount: number): string {
    const templates = [
      `Today you sailed for ${totalFocusTime} minutes across ${voyageCount} voyage${voyageCount === 1 ? '' : 's'}. The seagull observed your steady progress toward your lighthouse.`,
      `${voyageCount} journey${voyageCount === 1 ? '' : 's'} completed today, accumulating ${totalFocusTime} minutes of focused navigation. Your determination is like the steady lighthouse beam.`,
      `The winds were favorable today - ${totalFocusTime} minutes of concentrated sailing across ${voyageCount} destination${voyageCount === 1 ? '' : 's'}. Each voyage brings you closer to your ideal self.`
    ];

    if (totalFocusTime === 0) {
      return "Sometimes the sea is calm and we rest at harbor. Tomorrow brings new opportunities to set sail toward your dreams.";
    }

    if (totalFocusTime >= 120) { // 2+ hours
      return `Remarkable dedication today! ${totalFocusTime} minutes of focused sailing shows the heart of a true navigator. Your lighthouse grows brighter with each voyage.`;
    }

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Fallback weekly summary generation
   */
  private static generateFallbackWeeklySummary(reflections: DailyReflection[]): string {
    const totalTime = reflections.reduce((sum, r) => sum + r.total_focus_time, 0);
    const totalVoyages = reflections.reduce((sum, r) => sum + r.voyage_count, 0);
    const activeDays = reflections.filter(r => r.voyage_count > 0).length;

    if (totalTime === 0) {
      return "A week of preparation and reflection. Like tides, focus ebbs and flows. Next week holds new opportunities for discovery.";
    }

    return `This week you sailed ${totalVoyages} voyages across ${activeDays} active days, focusing for ${Math.round(totalTime / 60)} hours total. Your consistent navigation toward your lighthouse is admirable.`;
  }
}