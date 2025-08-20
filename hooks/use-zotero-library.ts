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
      setPapers(data.papers || []);
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