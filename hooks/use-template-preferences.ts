import { useState, useEffect, useCallback } from 'react';
import { useSupabaseZoteroAuth } from '@/hooks/use-supabase-zotero-auth';

export interface UserPreferences {
  row_height_preset: 'compact' | 'spacious' | 'custom';
  custom_row_height: number;
  column_widths: Record<string, number>;
  column_visibility: Record<string, boolean>;
  ai_columns: Array<{
    id: string;
    name: string;
    prompt: string;
  }>;
  generated_content: Record<string, Record<string, string>>;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  row_height_preset: 'spacious',
  custom_row_height: 80,
  column_widths: {
    select: 40,
    status: 100,
    title: 350,
    journal: 160,
    tags: 120,
    actions: 200,
  },
  column_visibility: {
    select: true,
    status: true,
    title: true,
    journal: true,
    tags: true,
    actions: true,
  },
  ai_columns: [],
  generated_content: {},
};

export function useTemplatePreferences() {
  const { user, session, zoteroCredentials, isAuthenticated, userId: legacyUserId, token: legacyToken } = useSupabaseZoteroAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create auth headers helper - prefer Supabase Auth but fallback to legacy
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Use Supabase session if available
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else if (legacyUserId && legacyToken) {
      // Fallback to legacy Zotero auth
      headers['x-zotero-user-id'] = legacyUserId;
      headers['Authorization'] = `Bearer ${legacyToken}`;
    }
    
    return headers;
  }, [session, legacyUserId, legacyToken]);

  // Load preferences on mount
  const loadPreferences = useCallback(async () => {
    if (!isAuthenticated || (!user && !legacyUserId)) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/user/preferences', {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load preferences: ${response.status}`);
      }

      const data = await response.json();
      const loadedPrefs = data.preferences;
      
      // Use loaded preferences or defaults
      const finalPrefs: UserPreferences = {
        row_height_preset: loadedPrefs?.row_height_preset || DEFAULT_PREFERENCES.row_height_preset,
        custom_row_height: loadedPrefs?.custom_row_height || DEFAULT_PREFERENCES.custom_row_height,
        column_widths: loadedPrefs?.column_widths || DEFAULT_PREFERENCES.column_widths,
        column_visibility: loadedPrefs?.column_visibility || DEFAULT_PREFERENCES.column_visibility,
        ai_columns: loadedPrefs?.ai_columns || DEFAULT_PREFERENCES.ai_columns,
        generated_content: loadedPrefs?.generated_content || DEFAULT_PREFERENCES.generated_content,
      };
      
      setPreferences(finalPrefs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
      setPreferences(DEFAULT_PREFERENCES);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, legacyUserId, getAuthHeaders]);

  // Save all preferences to database
  const savePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    try {
      setError(null);
      
      // First, get the latest preferences from the server to avoid overwriting other changes
      const currentResponse = await fetch('/api/user/preferences', {
        headers: getAuthHeaders(),
      });
      
      let currentPreferences = preferences;
      if (currentResponse.ok) {
        const currentData = await currentResponse.json();
        currentPreferences = currentData.preferences;
      }
      
      // Merge updates with current preferences
      const updatedPreferences = { ...currentPreferences, ...updates };
      
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedPreferences),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save preferences: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setPreferences(data.preferences);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
      return false;
    }
  }, [preferences, getAuthHeaders]);

  // Load preferences when user changes
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    loading,
    error,
    savePreferences,
    refreshPreferences: loadPreferences,
  };
}