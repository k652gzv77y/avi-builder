/**
 * Auth Store
 *
 * Manages authentication state using Supabase Auth
 */

import { create } from 'zustand';
import { projectsPath } from '@/lib/project-url';
import { builderReturnPath, resolveSignInResult, shouldApplyAuthEvent } from '@/lib/auth-flow';
import { createBrowserClient } from '../lib/supabase-browser';
import { extractRoleFromUser } from '@/lib/roles';
import type { Provider, User, Session } from '@supabase/supabase-js';

let authInitializeTask: Promise<void> | null = null;

interface AuthState {
  user: User | null;
  session: Session | null;
  role: string | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: Provider) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  confirmSession: () => Promise<boolean>;
  setError: (error: string | null) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  role: null,
  loading: false,
  initialized: false,
  error: null,

  /**
   * Initialize auth state and listen for auth changes
   * Gracefully handles missing Supabase config (expected during setup)
   */
  initialize: () => {
    if (get().initialized) return Promise.resolve();
    if (authInitializeTask) return authInitializeTask;

    authInitializeTask = (async () => {
      try {
        const supabase = await createBrowserClient();

        // If Supabase is not configured, skip initialization (expected during setup)
        if (!supabase) {
          set({
            initialized: true,
            error: null,
          });
          return;
        }

        // Register before reading the session so SIGNED_IN is not missed.
        // Ignore a late empty INITIAL_SESSION so it cannot wipe a sign-in
        // that already stored the user.
        supabase.auth.onAuthStateChange((event, session) => {
          if (!shouldApplyAuthEvent(event, session, get().user)) return;
          set({
            user: session?.user ?? null,
            session,
            role: extractRoleFromUser(session?.user ?? null),
          });
        });

        // getUser verifies the JWT. One refresh afterwards picks up role
        // changes in app_metadata. A second overlapping refresh rotates the
        // refresh token twice and the loser clears the session.
        const { data: { user } } = await supabase.auth.getUser();
        let session: Session | null = null;

        if (user) {
          const refreshed = await supabase.auth.refreshSession();
          session = refreshed.data.session;
        }

        if (!session?.user) {
          const stored = await supabase.auth.getSession();
          session = stored.data.session;
        }

        const resolvedUser = session?.user ?? null;
        set({
          user: resolvedUser,
          session: resolvedUser ? session : null,
          role: extractRoleFromUser(resolvedUser),
          initialized: true,
          error: null,
        });
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        try {
          const supabase = await createBrowserClient();
          const stored = await supabase?.auth.getSession();
          if (stored?.data.session?.user) {
            set({
              user: stored.data.session.user,
              session: stored.data.session,
              role: extractRoleFromUser(stored.data.session.user),
              initialized: true,
              error: null,
            });
            return;
          }
        } catch {
          // The original failure is reported below.
        }
        set({
          error: error instanceof Error ? error.message : 'Failed to initialize auth',
          initialized: true,
        });
      } finally {
        authInitializeTask = null;
      }
    })();

    return authInitializeTask;
  },

  /**
   * Sign up a new user
   */
  signUp: async (email, password) => {
    set({ loading: true, error: null });

    try {
      const supabase = await createBrowserClient();

      if (!supabase) {
        set({ loading: false, error: 'Supabase not configured. Please complete setup first.' });
        return { error: 'Supabase not configured. Please complete setup first.' };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${projectsPath('')}`,
          // Note: Email confirmation should be disabled in Supabase Dashboard
          // (Authentication → Providers → Email → Disable "Confirm email")
          // This is recommended for self-hosted single-admin setups
        },
      });

      if (error) {
        set({ loading: false, error: error.message });
        return { error: error.message };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        const message = 'Email confirmation required. Please disable email confirmation in your Supabase project settings (Authentication → Providers → Email).';
        set({ loading: false, error: message });
        return { error: message };
      }

      set({
        user: data.user,
        session: data.session,
        role: extractRoleFromUser(data.user),
        loading: false,
      });

      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      set({ loading: false, error: message });
      return { error: message };
    }
  },

  /**
   * Sign in existing user
   */
  signIn: async (email, password) => {
    set({ loading: true, error: null });

    try {
      const supabase = await createBrowserClient();

      if (!supabase) {
        set({ loading: false, error: 'Supabase not configured. Please complete setup first.' });
        return { error: 'Supabase not configured. Please complete setup first.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // The password grant can persist cookies and then surface a follow-up
      // error (lock, notify, or a stale session read). Trust the stored session.
      let session = data.session;
      if (!session?.user) {
        const stored = await supabase.auth.getSession();
        session = stored.data.session;
      }

      const resolved = resolveSignInResult(error?.message ?? null, data.session, session);
      if (resolved.error || !session?.user) {
        const message = resolved.error || 'Sign in failed';
        set({ loading: false, error: message });
        return { error: message };
      }

      set({
        user: session.user,
        session,
        role: extractRoleFromUser(session.user),
        loading: false,
        error: null,
        initialized: true,
      });

      return { error: null };
    } catch (error) {
      try {
        const supabase = await createBrowserClient();
        const stored = await supabase?.auth.getSession();
        if (stored?.data.session?.user) {
          set({
            user: stored.data.session.user,
            session: stored.data.session,
            role: extractRoleFromUser(stored.data.session.user),
            loading: false,
            error: null,
            initialized: true,
          });
          return { error: null };
        }
      } catch {
        // Report the original sign-in failure.
      }
      const message = error instanceof Error ? error.message : 'Sign in failed';
      set({ loading: false, error: message });
      return { error: message };
    }
  },

  /** Start a hosted Supabase OAuth flow and return to the builder afterwards. */
  signInWithOAuth: async (provider) => {
    set({ loading: true, error: null });

    try {
      const supabase = await createBrowserClient();

      if (!supabase) {
        const error = 'Supabase not configured. Please complete setup first.';
        set({ loading: false, error });
        return { error };
      }

      const next = builderReturnPath(window.location.pathname, window.location.search);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // Exchange the PKCE code on the server, then return to the project
          // the user was signing in from. Apple also needs the email/name scopes
          // or the first sign-in can finish without an email identity.
          redirectTo: `${window.location.origin}/projects/auth/callback?next=${encodeURIComponent(next)}`,
          scopes: provider === 'apple' ? 'email name' : undefined,
        },
      });

      if (error) {
        set({ loading: false, error: error.message });
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OAuth sign in failed';
      set({ loading: false, error: message });
      return { error: message };
    }
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    set({ loading: true, error: null });

    try {
      const supabase = await createBrowserClient();

      if (!supabase) {
        set({
          user: null,
          session: null,
          role: null,
          loading: false,
        });
        return;
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        set({ loading: false, error: error.message });
        return;
      }

      set({
        user: null,
        session: null,
        role: null,
        loading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      set({ loading: false, error: message });
    }
  },

  /**
   * Check current session
   */
  /**
   * Re-read the cookie session and adopt it when present.
   * Used when an API call races the cookie write after sign-in.
   */
  confirmSession: async () => {
    try {
      const supabase = await createBrowserClient();
      if (!supabase) return false;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;

      set({
        user: session.user,
        session,
        role: extractRoleFromUser(session.user),
        error: null,
        initialized: true,
      });
      return true;
    } catch (error) {
      console.error('Failed to confirm session:', error);
      return false;
    }
  },

  checkSession: async () => {
    try {
      const supabase = await createBrowserClient();

      if (!supabase) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      set({
        user: session?.user ?? null,
        session,
      });
    } catch (error) {
      console.error('Failed to check session:', error);
    }
  },

  /**
   * Set error message
   */
  setError: (error) => {
    set({ error });
  },
}));
