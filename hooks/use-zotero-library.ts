"use client";

import { useState, useEffect } from 'react';
import { Paper } from '@/components/papers-table';

interface ZoteroLibrary {
  papers: Paper[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useZoteroLibrary(token: string | null, userId: string | null): ZoteroLibrary {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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