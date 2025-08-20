"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/lib/database.types';

interface ZoteroAuth {
  token: string | null;
  userId: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useZoteroAuth(): ZoteroAuth & {
  login: () => void;
  logout: () => void;
} {
  const [auth, setAuth] = useState<ZoteroAuth>({
    token: null,
    userId: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const supabase = createClient();

  const createOrGetUser = async (zoteroUserId: string, token: string): Promise<User | null> => {
    try {
      // Create a user object with Zotero data
      const user: User = {
        id: zoteroUserId, // Use Zotero ID as temporary ID
        zotero_user_id: zoteroUserId,
        zotero_username: null,
        email: null,
        display_name: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login: new Date().toISOString()
      };

      try {
        // Try to get user info from server-side API to avoid CORS
        const userInfoResponse = await fetch(`/api/zotero/user/${zoteroUserId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          user.zotero_username = userInfo.username || null;
          user.display_name = userInfo.displayName || userInfo.username || null;
        }
      } catch (error) {
        console.log('Could not fetch user info from server, using defaults');
      }

      try {
        // Use server-side API with service role key for database operations
        const userResponse = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            zoteroUserId,
            zoteroUsername: user.zotero_username,
            displayName: user.display_name
          })
        });

        if (userResponse.ok) {
          const { user } = await userResponse.json();
          return user;
        } else {
          console.log('Database operation failed, using local user data');
        }
      } catch (dbError) {
        console.log('Database not available, using local user data');
      }

      // Return user if database operations fail
      return user;
    } catch (error) {
      console.error('Error in createOrGetUser:', error);
      return null;
    }
  };

  useEffect(() => {
    // Check for token in URL params (from OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('zotero_token');
    const userId = urlParams.get('zotero_user_id');

    if (token && userId) {
      // Store in localStorage (in production, use more secure storage)
      localStorage.setItem('zotero_token', token);
      localStorage.setItem('zotero_user_id', userId);
      
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('zotero_token');
      url.searchParams.delete('zotero_user_id');
      window.history.replaceState({}, '', url.toString());
      
      // Create or get user from database
      createOrGetUser(userId, token).then((user) => {
        setAuth({
          token,
          userId,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: user ? null : 'Failed to create user account',
        });
      });
    } else {
      // Check localStorage for existing token
      const storedToken = localStorage.getItem('zotero_token');
      const storedUserId = localStorage.getItem('zotero_user_id');
      
      if (storedToken && storedUserId) {
        // Get user from database
        createOrGetUser(storedUserId, storedToken).then((user) => {
          setAuth({
            token: storedToken,
            userId: storedUserId,
            user,
            isAuthenticated: true,
            isLoading: false,
            error: user ? null : 'Failed to load user account',
          });
        });
      } else {
        setAuth(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, []);

  const login = () => {
    // Redirect to our OAuth route
    window.location.href = '/api/auth/zotero';
  };

  const logout = () => {
    localStorage.removeItem('zotero_token');
    localStorage.removeItem('zotero_user_id');
    setAuth({
      token: null,
      userId: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

  return {
    ...auth,
    login,
    logout,
  };
}