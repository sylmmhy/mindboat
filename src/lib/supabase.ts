import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a fallback client if environment variables are missing
let supabase: any;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. Running in demo mode.');
  
  // Create a mock client for demo purposes
  supabase = {
    auth: {
      signInWithPassword: async () => ({ 
        data: { user: null }, 
        error: new Error('Database connection not configured. Please set up Supabase or continue in demo mode.') 
      }),
      signUp: async () => ({ 
        data: { user: null }, 
        error: new Error('Database connection not configured. Please set up Supabase or continue in demo mode.') 
      }),
      signOut: async () => ({ error: null }),
      getSession: async () => ({ 
        data: { session: null },
        error: null
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ data: [], error: new Error('Demo mode: Database not connected') }),
          maybeSingle: () => ({ data: null, error: new Error('Demo mode: Database not connected') }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => ({ data: null, error: new Error('Demo mode: Database not connected') }),
        }),
      }),
      upsert: () => ({ error: new Error('Demo mode: Database not connected') }),
      delete: () => ({
        eq: () => ({ error: new Error('Demo mode: Database not connected') }),
      }),
    }),
    functions: {
      invoke: async () => ({ 
        data: null, 
        error: new Error('Demo mode: Edge functions not available') 
      }),
    },
  };
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          lighthouse_goal: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          lighthouse_goal?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lighthouse_goal?: string | null;
          updated_at?: string;
        };
      };
      destinations: {
        Row: {
          id: string;
          user_id: string;
          original_task: string;
          destination_name: string;
          description: string;
          related_apps: string[];
          color_theme: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          original_task: string;
          destination_name: string;
          description: string;
          related_apps: string[];
          color_theme?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          original_task?: string;
          destination_name?: string;
          description?: string;
          related_apps?: string[];
          color_theme?: string;
        };
      };
      voyages: {
        Row: {
          id: string;
          user_id: string;
          destination_id: string;
          start_time: string;
          end_time: string | null;
          planned_duration: number | null;
          actual_duration: number | null;
          distraction_count: number;
          status: 'active' | 'completed' | 'abandoned';
          weather_mood: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          destination_id: string;
          start_time: string;
          end_time?: string | null;
          planned_duration?: number | null;
          actual_duration?: number | null;
          distraction_count?: number;
          status?: 'active' | 'completed' | 'abandoned';
          weather_mood?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          destination_id?: string;
          start_time?: string;
          end_time?: string | null;
          planned_duration?: number | null;
          actual_duration?: number | null;
          distraction_count?: number;
          status?: 'active' | 'completed' | 'abandoned';
          weather_mood?: string;
        };
      };
      distraction_events: {
        Row: {
          id: string;
          voyage_id: string;
          detected_at: string;
          duration_seconds: number | null;
          type: string;
          user_response: string | null;
        };
        Insert: {
          id?: string;
          voyage_id: string;
          detected_at?: string;
          duration_seconds?: number | null;
          type: string;
          user_response?: string | null;
        };
        Update: {
          id?: string;
          voyage_id?: string;
          detected_at?: string;
          duration_seconds?: number | null;
          type?: string;
          user_response?: string | null;
        };
      };
      daily_reflections: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          reflection_text: string | null;
          total_focus_time: number;
          voyage_count: number;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          reflection_text?: string | null;
          total_focus_time: number;
          voyage_count: number;
          generated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          reflection_text?: string | null;
          total_focus_time?: number;
          voyage_count?: number;
          generated_at?: string;
        };
      };
    };
  };
};