import { create } from 'zustand';
import { supabase } from '@/db/supabase';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (user: User | null) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    set({ isLoading: true });

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      set({ isLoading: false });
    }, 5000); // 5 second timeout

    try {
      // 1. Try Supabase session with timeout
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout')), 3000)
      );

      const { data: { session } } = await Promise.race([
        sessionPromise,
        timeoutPromise,
      ]) as any;

      if (session?.user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          if (profile) {
            clearTimeout(timeout);
            set({ user: profile as User, isAuthenticated: true, isLoading: false });
            return;
          }
        } catch (profileError) {
          console.warn('Profile fetch failed:', profileError);
        }
      }

      // 2. Check local session fallback (for resilient admin access)
      const cached = localStorage.getItem('camsort_custom_session');
      if (cached) {
        try {
          const profile = JSON.parse(cached);
          if (profile?.id) {
            clearTimeout(timeout);
            set({ user: profile as User, isAuthenticated: true, isLoading: false });
            return;
          }
        } catch (cacheError) {
          console.warn('Cache parse failed:', cacheError);
        }
      }
    } catch (error) {
      console.warn('Auth initialization failed:', error);
    } finally {
      clearTimeout(timeout);
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        set({ isLoading: false });
        throw new Error(error.message);
      }
      if (data?.user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();
          if (profile) {
            set({ user: profile as User, isAuthenticated: true, isLoading: false });
            localStorage.setItem('camsort_custom_session', JSON.stringify(profile));
          } else {
            // Profile doesn't exist, create it
            const { data: newProfile } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.name || data.user.email,
                role: data.user.user_metadata?.role || 'ADMIN',
              })
              .select('*')
              .single();
            set({ user: newProfile as User, isAuthenticated: true, isLoading: false });
            localStorage.setItem('camsort_custom_session', JSON.stringify(newProfile));
          }
        } catch (profileError) {
          console.warn('Profile fetch failed, using user data:', profileError);
          // Fallback to user data if profile fetch fails
          const fallbackProfile = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || data.user.email,
            role: data.user.user_metadata?.role || 'ADMIN',
            studio_name: 'Dhruvil Studio',
          };
          set({ user: fallbackProfile as User, isAuthenticated: true, isLoading: false });
          localStorage.setItem('camsort_custom_session', JSON.stringify(fallbackProfile));
        }
      }
    } catch (err: any) {
      set({ isLoading: false });
      throw new Error(err.message || 'Invalid email or password');
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    localStorage.removeItem('camsort_custom_session');
    set({ user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        if (profile) {
          set({ user: profile as User, isAuthenticated: true });
          return;
        }
      }

      const cached = localStorage.getItem('camsort_custom_session');
      if (cached) {
        const profile = JSON.parse(cached);
        if (profile?.id) {
          set({ user: profile as User, isAuthenticated: true });
          return;
        }
      }

      set({ user: null, isAuthenticated: false });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));