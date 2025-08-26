"use client";

import { useState, useEffect } from 'react';
import { Paper } from '@/components/papers-table';
import { useTimelineInvalidation } from '@/hooks/use-real-timeline-data';

interface ZoteroLibrary {
  papers: Paper[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useZoteroLibrary(token: string | null, userId: string | null, dbUser?: { id: string } | null): ZoteroLibrary {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidateTimeline = useTimelineInvalidation();

  const fetchLibrary = async () => {
    if (!token || !userId) {
      setPapers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        token,
        userId,
        libraryType: 'user',
        libraryId: userId,
      });

      const response = await fetch(`/api/zotero/library?${params}`);
      
      if (!response.ok) {
        let errorMessage = 'Failed to fetch library';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          if (errorData.details) {
            errorMessage += ': ' + errorData.details;
          }
        } catch {
          // If we can't parse error response, use status text
          errorMessage = `${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const fetchedPapers = data.papers || [];
      setPapers(fetchedPapers);

      // Automatically sync papers to database for persistence
      if (fetchedPapers.length > 0) {
        try {
          console.log(`🔄 Syncing ${fetchedPapers.length} papers to database...`);
          const syncResponse = await fetch('/api/papers/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ papers: fetchedPapers }),
          });

          if (syncResponse.ok) {
            const syncData = await syncResponse.json();
            console.log(`✅ Papers synced: ${syncData.synced} successful, ${syncData.errors} errors`);
            
            // Invalidate timeline cache if any papers were synced/updated
            if (syncData.synced > 0 && dbUser?.id) {
              console.log('🔄 Fetching internal user ID for cache invalidation, Supabase user:', dbUser.id);
              
              // Fetch internal user ID for cache invalidation
              try {
                const userResponse = await fetch('/api/users', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    supabaseUserId: dbUser.id,
                  }),
                });
                
                if (userResponse.ok) {
                  const { user: internalUser } = await userResponse.json();
                  console.log('🔄 Invalidating timeline cache for internal user:', internalUser.id);
                  invalidateTimeline(internalUser.id);
                } else {
                  console.warn('Failed to fetch internal user for cache invalidation');
                }
              } catch (cacheError) {
                console.warn('Error fetching internal user for cache invalidation:', cacheError);
              }
            }
          } else {
            console.warn('Failed to sync papers to database:', syncResponse.statusText);
          }
        } catch (syncError) {
          console.warn('Error syncing papers:', syncError);
          // Don't throw - this is a background operation that shouldn't break the UI
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching Zotero library:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, [token, userId]);

  return {
    papers,
    isLoading,
    error,
    refetch: fetchLibrary,
  };
}