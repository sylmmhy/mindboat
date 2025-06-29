import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useNotificationStore } from './notificationStore';
import type { User } from '../types';

interface UserState {
  user: User | null;
  lighthouseGoal: string;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  authMode: 'demo' | 'supabase';

  // Actions
  setUser: (user: User | null) => void;
  setLighthouseGoal: (goal: string) => void;
  saveLighthouseGoal: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  clearError: () => void;
  enterDemoMode: () => void;
}

// Check if Supabase is configured
const isSupabaseConfigured = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  lighthouseGoal: '',
  isLoading: false,
  error: null,
  isAuthenticated: false,
  authMode: isSupabaseConfigured ? 'supabase' : 'demo',

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setLighthouseGoal: (goal) => set({ lighthouseGoal: goal }),

  clearError: () => set({ error: null }),

  enterDemoMode: () => {
    const demoUser: User = {
      id: 'demo-user-' + Date.now(),
      email: 'demo@mindboat.app',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set({
      user: demoUser,
      isAuthenticated: true,
      authMode: 'demo',
      error: null
    });
  },

  saveLighthouseGoal: async () => {
    const { user, lighthouseGoal, authMode } = get();
    if (!user) return;

    set({ isLoading: true, error: null });

    try {
      if (authMode === 'demo' || !isSupabaseConfigured) {
        // In demo mode, just store locally
        localStorage.setItem('demo-lighthouse-goal', lighthouseGoal);
        set({ isLoading: false });

        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          lighthouse_goal: lighthouseGoal,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save lighthouse goal:', error);
      // Fallback to local storage
      localStorage.setItem('demo-lighthouse-goal', lighthouseGoal);

      useNotificationStore.getState().showWarning(
        'Database unavailable. Goal saved locally instead.',
        'Fallback Save'
      );
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      // If Supabase is not configured, automatically enter demo mode
      if (!isSupabaseConfigured) {
        console.warn('Supabase not configured, entering demo mode');
        get().enterDemoMode();
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please check your email and click the confirmation link before signing in.');
        } else if (error.message.includes('Too many requests')) {
          throw new Error('Too many sign-in attempts. Please wait a few minutes and try again.');
        } else {
          throw new Error(`Sign in failed: ${error.message}`);
        }
      }

      if (data.user) {
        set({ user: data.user as User, isAuthenticated: true, authMode: 'supabase' });

        // Load user profile
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('lighthouse_goal')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profile?.lighthouse_goal) {
            set({ lighthouseGoal: profile.lighthouse_goal });
          }
        } catch (profileError) {
          console.warn('Failed to load user profile:', profileError);
          // Don't fail the sign-in for this
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);

      if (error instanceof Error) {
        set({ error: error.message });
      } else {
        set({ error: 'An unexpected error occurred during sign in. Please try again.' });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      // If Supabase is not configured, automatically enter demo mode
      if (!isSupabaseConfigured) {
        console.warn('Supabase not configured, entering demo mode');
        get().enterDemoMode();
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address.');
      }

      // Validate password strength
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        } else if (error.message.includes('Invalid email')) {
          throw new Error('Please enter a valid email address.');
        } else if (error.message.includes('Password should be')) {
          throw new Error('Password must be at least 6 characters long.');
        } else {
          throw new Error(`Sign up failed: ${error.message}`);
        }
      }

      if (data.user) {
        // Only show notification if email confirmation is required
        if (!data.user.email_confirmed_at) {
          useNotificationStore.getState().showInfo(
            'Please check your email and click the confirmation link to complete your account setup.',
            'Confirmation Email Sent',
            { duration: 8000 }
          );
        } else {
          // Auto sign-in successful
          set({ user: data.user as User, isAuthenticated: true, authMode: 'supabase' });
        }
      }
    } catch (error) {
      console.error('Sign up error:', error);

      if (error instanceof Error) {
        set({ error: error.message });
      } else {
        set({ error: 'An unexpected error occurred during sign up. Please try again.' });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });

    try {
      const { authMode } = get();

      if (authMode === 'supabase' && isSupabaseConfigured) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }

      // Clear local storage
      localStorage.removeItem('demo-lighthouse-goal');

      set({
        user: null,
        lighthouseGoal: '',
        isAuthenticated: false,
        authMode: isSupabaseConfigured ? 'supabase' : 'demo'
      });

      useNotificationStore.getState().showSuccess(
        'You have been signed out successfully.',
        'Sign Out Complete'
      );
    } catch (error) {
      console.error('Sign out error:', error);
      // Force sign out locally even if server call fails
      set({
        user: null,
        lighthouseGoal: '',
        isAuthenticated: false,
        authMode: isSupabaseConfigured ? 'supabase' : 'demo',
        error: 'Sign out completed locally. You may need to clear your browser cache.'
      });

      useNotificationStore.getState().showWarning(
        'Sign out completed locally. You may need to clear your browser cache.',
        'Partial Sign Out'
      );
    } finally {
      set({ isLoading: false });
    }
  },

  initialize: async () => {
    set({ isLoading: true, error: null });

    try {
      // If Supabase is not configured, set demo mode and load local data
      if (!isSupabaseConfigured) {
        console.warn('Supabase not configured, running in demo mode');
        const demoGoal = localStorage.getItem('demo-lighthouse-goal');
        if (demoGoal) {
          set({ lighthouseGoal: demoGoal });
        }
        set({ isLoading: false, authMode: 'demo' });
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session error:', error);
        set({ error: 'Failed to restore session. Please sign in again.' });
        return;
      }

      if (session?.user) {
        set({
          user: session.user as User,
          isAuthenticated: true,
          authMode: 'supabase'
        });

        // Load user profile
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('lighthouse_goal')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile?.lighthouse_goal) {
            set({ lighthouseGoal: profile.lighthouse_goal });
          }
        } catch (profileError) {
          console.warn('Failed to load user profile:', profileError);
          // Don't fail initialization for this
        }
      } else {
        // Check for demo mode data
        const demoGoal = localStorage.getItem('demo-lighthouse-goal');
        if (demoGoal) {
          set({ lighthouseGoal: demoGoal });
        }
      }
    } catch (error) {
      console.error('Failed to initialize user:', error);
      set({ error: 'Failed to initialize application. Please refresh the page.' });
    } finally {
      set({ isLoading: false });
    }
  },
}));