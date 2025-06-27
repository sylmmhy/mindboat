import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface UserState {
  user: User | null;
  lighthouseGoal: string;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setLighthouseGoal: (goal: string) => void;
  saveLighthouseGoal: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  lighthouseGoal: '',
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  
  setLighthouseGoal: (goal) => set({ lighthouseGoal: goal }),

  saveLighthouseGoal: async () => {
    const { user, lighthouseGoal } = get();
    if (!user) return;

    set({ isLoading: true, error: null });
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          lighthouse_goal: lighthouseGoal,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save goal' });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      if (data.user) {
        set({ user: data.user as User });
        
        // Load user profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('lighthouse_goal')
          .eq('id', data.user.id)
          .single();
        
        if (profile?.lighthouse_goal) {
          set({ lighthouseGoal: profile.lighthouse_goal });
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Sign in failed' });
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email, password) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      
      if (data.user) {
        set({ user: data.user as User });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Sign up failed' });
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      set({ user: null, lighthouseGoal: '' });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Sign out failed' });
    } finally {
      set({ isLoading: false });
    }
  },

  initialize: async () => {
    set({ isLoading: true });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        set({ user: session.user as User });
        
        // Load user profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('lighthouse_goal')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.lighthouse_goal) {
          set({ lighthouseGoal: profile.lighthouse_goal });
        }
      }
    } catch (error) {
      console.error('Failed to initialize user:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));