'use client';

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

  const createOrGetUser = async (zoteroUserId: string, token: string): Promise<User | null> => {
    const user: Partial<User> = {
      zotero_user_id: zoteroUserId,
      zotero_username: null,
      display_name: null,
    };

    try {
      // Fetch Zotero user info from server API
      const userInfoResponse = await fetch(`/api/zotero/user/${zoteroUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        user.zotero_username = userInfo.username || null;
        user.display_name = userInfo.displayName || userInfo.username || null;
      }
    } catch {
      console.log('Could not fetch Zotero user info, using defaults');
    }

    try {
      // Upsert user in database via server API
      const userResponse = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoteroUserId,
          zoteroUsername: user.zotero_username,
          displayName: user.display_name,
        }),
      });

      if (userResponse.ok) {
        const { user: dbUser } = await userResponse.json();
        return dbUser;
      } else {
        console.log('Database operation failed, using local user data');
      }
    } catch {
      console.log('Database not available, using local user data');
    }

    return user as User;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('zotero_token');
      const userId = urlParams.get('zotero_user_id');

      if (token && userId) {
        localStorage.setItem('zotero_token', token);
        localStorage.setItem('zotero_user_id', userId);

        const url = new URL(window.location.href);
        url.searchParams.delete('zotero_token');
        url.searchParams.delete('zotero_user_id');
        window.history.replaceState({}, '', url.toString());

        const user = await createOrGetUser(userId, token);
        setAuth({
          token,
          userId,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: user ? null : 'Failed to create user account',
        });
      } else {
        const storedToken = localStorage.getItem('zotero_token');
        const storedUserId = localStorage.getItem('zotero_user_id');

        if (storedToken && storedUserId) {
          const user = await createOrGetUser(storedUserId, storedToken);
          setAuth({
            token: storedToken,
            userId: storedUserId,
            user,
            isAuthenticated: true,
            isLoading: false,
            error: user ? null : 'Failed to load user account',
          });
        } else {
          setAuth(prev => ({ ...prev, isLoading: false }));
        }
      }
    };

    initializeAuth();
  }, []);

  const login = () => {
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

  return { ...auth, login, logout };
}
