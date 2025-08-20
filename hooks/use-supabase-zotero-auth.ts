"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

// Helper function to get cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

interface ZoteroCredentials {
  zoteroUserId: string;
  zoteroAccessToken: string;
  zoteroRefreshToken?: string;
  expiresAt?: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  zoteroCredentials: ZoteroCredentials | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useSupabaseZoteroAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    zoteroCredentials: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const supabase = createClient();

  // Load user's Zotero credentials
  const loadZoteroCredentials = useCallback(async (user: User) => {
    try {
      const response = await fetch('/api/auth/zotero/credentials', {
        headers: {
          'Authorization': `Bearer ${user.session?.access_token}`,
        },
      });

      if (response.ok) {
        const credentials = await response.json();
        return credentials;
      }
      return null;
    } catch (error) {
      console.error('Error loading Zotero credentials:', error);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for Zotero auth callback data
        const params = new URLSearchParams(window.location.search);
        const zoteroLinked = params.get('zotero');
        const zoteroUserId = getCookie('zotero_supabase_user_id');
        
        console.log('🔍 Checking for Zotero callback:', { zoteroLinked, zoteroUserId, url: window.location.href });
        
        if (zoteroLinked === 'linked' && zoteroUserId) {
          // Clear the cookie
          document.cookie = 'zotero_supabase_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          
          try {
            console.log('📞 Requesting session creation for user:', zoteroUserId);
            // Request a session creation via our API
            const response = await fetch('/api/auth/create-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                supabase_user_id: zoteroUserId,
              }),
            });

            console.log('📞 Session API response status:', response.status);
            
            if (response.ok) {
              const data = await response.json();
              console.log('📞 Session API response data:', data);
              
              if (data.session) {
                console.log('🔐 Setting session from response');
                // Set the session using Supabase client
                const { error } = await supabase.auth.setSession({
                  access_token: data.session.access_token,
                  refresh_token: data.session.refresh_token,
                });
                
                if (error) {
                  console.error('❌ Failed to set session on client:', error);
                } else {
                  console.log('✅ Session set successfully, reloading page');
                  // Refresh to pick up the new auth state
                  window.location.reload();
                }
              } else {
                console.error('❌ No session data in response');
              }
            } else {
              const errorText = await response.text();
              console.error('❌ Failed to create session:', response.status, errorText);
            }
          } catch (sessionError) {
            console.error('❌ Session creation error:', sessionError);
          }
          
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        }

        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (session?.user) {
          // Load Zotero credentials for this user
          const zoteroCredentials = await loadZoteroCredentials(session.user);
          
          setAuthState({
            user: session.user,
            session: session,
            zoteroCredentials,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setAuthState(prev => ({
            ...prev,
            isLoading: false,
          }));
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Authentication error',
          isLoading: false,
        }));
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        if (session?.user) {
          const zoteroCredentials = await loadZoteroCredentials(session.user);
          setAuthState({
            user: session.user,
            session: session,
            zoteroCredentials,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setAuthState({
            user: null,
            session: null,
            zoteroCredentials: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth, loadZoteroCredentials]);

  // Sign up with email and password, then link Zotero
  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Sign up failed' 
      };
    }
  }, [supabase.auth]);

  // Sign in with email and password
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Sign in failed' 
      };
    }
  }, [supabase.auth]);

  // Link Zotero account to current user
  const linkZoteroAccount = useCallback(async () => {
    if (!authState.user) {
      return { success: false, error: 'Must be logged in to link Zotero' };
    }

    try {
      // Redirect to Zotero OAuth with user ID
      const callbackUrl = `${window.location.origin}/auth/zotero/callback`;
      const zoteroAuthUrl = `/api/auth/zotero/link?user_id=${authState.user.id}&callback=${encodeURIComponent(callbackUrl)}`;
      
      window.location.href = zoteroAuthUrl;
      return { success: true, error: null };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to link Zotero' 
      };
    }
  }, [authState.user]);

  // Start Zotero-first authentication flow
  const authenticateWithZotero = useCallback(() => {
    // Redirect to Zotero OAuth flow that will create/link Supabase account
    const callbackUrl = `${window.location.origin}/auth/zotero/callback`;
    window.location.href = `/api/auth/zotero?callback=${encodeURIComponent(callbackUrl)}`;
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;

      // Clear any local storage
      localStorage.removeItem('zotero_token');
      localStorage.removeItem('zotero_user_id');

      return { error: null };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Sign out failed' 
      };
    }
  }, [supabase.auth]);

  return {
    ...authState,
    // Auth functions
    signUpWithEmail,
    signInWithEmail,
    signOut,
    // Zotero functions
    authenticateWithZotero,
    linkZoteroAccount,
    // Legacy compatibility
    userId: authState.zoteroCredentials?.zoteroUserId || null,
    token: authState.zoteroCredentials?.zoteroAccessToken || null,
  };
}