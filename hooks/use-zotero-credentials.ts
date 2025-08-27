'use client';

import { useState, useEffect } from 'react';

interface ZoteroCredentials {
  zoteroUserId: string | null;
  zoteroAccessToken: string | null;
  zoteroRefreshToken: string | null;
  expiresAt: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useZoteroCredentials(): ZoteroCredentials {
  const [credentials, setCredentials] = useState<ZoteroCredentials>({
    zoteroUserId: null,
    zoteroAccessToken: null,
    zoteroRefreshToken: null,
    expiresAt: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        console.log('🔑 Fetching Zotero credentials from API...');
        const response = await fetch('/api/auth/zotero/credentials');
        
        if (!response.ok) {
          if (response.status === 401) {
            // User not authenticated with Supabase
            setCredentials(prev => ({ 
              ...prev, 
              isLoading: false, 
              error: 'Not authenticated with Supabase' 
            }));
            return;
          }
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('🔑 Zotero credentials fetched:', {
          hasUserId: !!data.zoteroUserId,
          hasAccessToken: !!data.zoteroAccessToken,
          tokenLength: data.zoteroAccessToken?.length || 0
        });
        
        setCredentials({
          zoteroUserId: data.zoteroUserId,
          zoteroAccessToken: data.zoteroAccessToken,
          zoteroRefreshToken: data.zoteroRefreshToken,
          expiresAt: data.expiresAt,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error('❌ Error fetching Zotero credentials:', error);
        setCredentials(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }));
      }
    };

    fetchCredentials();
  }, []);

  return credentials;
}