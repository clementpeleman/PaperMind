import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Helper function to get user from Supabase Auth
async function getCurrentUser(request: NextRequest) {
  // Try Supabase Auth first
  const { supabase } = createClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  console.log('🔍 AI Columns - Supabase Auth check:', { user: user?.id, error: authError?.message });

  if (user && !authError) {
    console.log('✅ AI Columns - Using Supabase Auth user:', user.id);
    return { supabase_user_id: user.id, legacy: false };
  }

  // Fallback to legacy Zotero auth headers for existing users
  const zoteroUserId = request.headers.get('x-zotero-user-id');
  console.log('🔍 AI Columns - Checking legacy Zotero headers:', { zoteroUserId });
  
  if (!zoteroUserId) {
    console.log('❌ AI Columns - No auth found');
    return null;
  }

  const adminSupabase = createAdminClient();
  
  const { data: legacyUser, error } = await adminSupabase
    .from('users')
    .select('*')
    .eq('zotero_user_id', zoteroUserId)
    .single();

  console.log('🔍 AI Columns - Legacy user lookup:', { legacyUser: legacyUser?.id, error: error?.message });

  if (error) {
    return null;
  }

  // If user has supabase_user_id, use that; otherwise use legacy ID
  const result = { 
    supabase_user_id: (legacyUser as any).supabase_user_id || legacyUser.id, 
    legacy: !(legacyUser as any).supabase_user_id 
  };
  
  console.log('📋 AI Columns - Final user info:', result);
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Get current user
    const userInfo = await getCurrentUser(request);
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get AI columns from user preferences using appropriate column
    const query = userInfo.legacy 
      ? supabase.from('user_preferences').select('ai_columns').eq('user_id', userInfo.supabase_user_id)
      : supabase.from('user_preferences').select('ai_columns').eq('supabase_user_id', userInfo.supabase_user_id);
    
    const { data: preferences, error } = await query.single<{ ai_columns: Array<{ id: string; name: string; prompt: string }> }>();

    if (error && error.code !== 'PGRST116') { // Not found error
      console.error('Error fetching AI columns:', error);
      return NextResponse.json({ error: 'Failed to fetch AI columns' }, { status: 500 });
    }

    return NextResponse.json({ aiColumns: preferences?.ai_columns || [] });

  } catch (error) {
    console.error('Error in AI columns GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Get current user
    const userInfo = await getCurrentUser(request);
    console.log('🔐 AI Columns API - Found user:', userInfo);
    if (!userInfo) {
      console.log('🔐 AI Columns API - No user found, unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, prompt } = body;

    if (!name || !prompt) {
      return NextResponse.json({ error: 'Name and prompt are required' }, { status: 400 });
    }

    // Get current preferences (all fields to preserve them) using appropriate column
    console.log('💾 AI Columns API - Looking for preferences for user:', userInfo.supabase_user_id);
    const query = userInfo.legacy 
      ? supabase.from('user_preferences').select('*').eq('user_id', userInfo.supabase_user_id)
      : supabase.from('user_preferences').select('*').eq('supabase_user_id', userInfo.supabase_user_id);
    
    const { data: preferences, error: prefsError } = await query.single<Preferences>();

    console.log('💾 AI Columns API - Preferences query result:', { preferences, error: prefsError });

    if (prefsError && prefsError.code !== 'PGRST116') {
      console.error('💾 AI Columns API - Error fetching preferences:', prefsError);
      return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
    }
    
    // Create new AI column
    const newColumn = {
      id: Date.now().toString(),
      name,
      prompt,
    };

    // Update AI columns
    const currentAiColumns = preferences?.ai_columns || [];
    console.log('💾 AI Columns API - Current AI columns:', currentAiColumns);
    const updatedAiColumns = [...currentAiColumns, newColumn];
    console.log('💾 AI Columns API - Updated AI columns:', updatedAiColumns);

    // Define a type for upsertData and preferences
    interface UpsertPreferences {
      id?: string;
      user_id?: string;
      supabase_user_id?: string;
      ai_columns: Array<{ id: string; name: string; prompt: string }>;
      updated_at: string;
      [key: string]: unknown; // For any additional fields from preferences
    }

    // Extend the preferences type to include ai_columns
    type Preferences = {
      id: string;
      user_id: string;
      row_height_preset: string;
      custom_row_height: number | null;
      column_widths: unknown;
      column_visibility: unknown;
      zotero_user_id: string | null;
      zotero_api_key: string | null;
      last_zotero_sync: string | null;
      ai_provider: string;
      created_at: string;
      updated_at: string;
      ai_columns?: Array<{ id: string; name: string; prompt: string }>;
    };

    // Save back to preferences (preserve all existing fields)
    const upsertData: UpsertPreferences = {
      ...preferences,
      ai_columns: updatedAiColumns,
      updated_at: new Date().toISOString(),
    };

    if (userInfo.legacy) {
      upsertData.user_id = userInfo.supabase_user_id;
      console.log('💾 AI Columns - Using legacy user_id:', userInfo.supabase_user_id);
    } else {
      upsertData.supabase_user_id = userInfo.supabase_user_id;
      console.log('💾 AI Columns - Using supabase_user_id:', userInfo.supabase_user_id);
    }
    
    console.log('💾 AI Columns API - About to upsert:', upsertData);
    
    // Upsert with appropriate conflict resolution
    const conflictColumn = userInfo.legacy ? 'user_id' : 'supabase_user_id';
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(upsertData, {
        onConflict: conflictColumn
      })
      .select()
      .single();

    console.log('💾 AI Columns API - Upsert result:', { data, error });

    if (error) {
      console.error('💾 AI Columns API - Error saving AI column:', error);
      return NextResponse.json({ error: 'Failed to save AI column', details: error.message }, { status: 500 });
    }

    if (!data) {
      console.error('💾 AI Columns API - No data returned from upsert');
      return NextResponse.json({ error: 'Failed to save AI column - no data returned' }, { status: 500 });
    }

    console.log('💾 AI Columns API - Successfully saved column, returning:', newColumn);
    return NextResponse.json({ aiColumn: newColumn });

  } catch (error) {
    console.error('Error in AI columns POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Get current user
    const userInfo = await getCurrentUser(request);
    console.log('🗑️ AI Columns DELETE - Found user:', userInfo);
    if (!userInfo) {
      console.log('🗑️ AI Columns DELETE - No user found, unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { columnId } = body;

    if (!columnId) {
      return NextResponse.json({ error: 'Column ID is required' }, { status: 400 });
    }

    // Get current preferences (all fields to preserve them) using appropriate column
    console.log('🗑️ AI Columns DELETE - Looking for preferences for user:', userInfo.supabase_user_id);
    const query = userInfo.legacy 
      ? supabase.from('user_preferences').select('*').eq('user_id', userInfo.supabase_user_id)
      : supabase.from('user_preferences').select('*').eq('supabase_user_id', userInfo.supabase_user_id);
    
    const { data: preferences, error: prefsError } = await query.single<Preferences>();

    console.log('🗑️ AI Columns DELETE - Preferences query result:', { preferences, error: prefsError });

    if (prefsError && prefsError.code !== 'PGRST116') {
      console.error('🗑️ AI Columns DELETE - Error fetching preferences:', prefsError);
      return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
    }
    
    // Remove AI column
    const currentAiColumns = preferences?.ai_columns || [];
    console.log('🗑️ AI Columns DELETE - Current AI columns:', currentAiColumns);
    const updatedAiColumns = currentAiColumns.filter(col => col.id !== columnId);
    console.log('🗑️ AI Columns DELETE - Updated AI columns:', updatedAiColumns);

    if (currentAiColumns.length === updatedAiColumns.length) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    }

    interface UpsertPreferences {
      id?: string;
      user_id?: string;
      supabase_user_id?: string;
      ai_columns: Array<{ id: string; name: string; prompt: string }>;
      updated_at: string;
      column_widths?: Json | null;
      column_visibility?: Json | null;
      generated_content?: Json | null;
      [key: string]: unknown; // Voor extra velden
    }

    // Extend the preferences type to include ai_columns
    type Preferences = {
      id: string;
      user_id: string;
      row_height_preset: string;
      custom_row_height: number | null;
      column_widths: Json | null;       // ✅ aangepast
      column_visibility: Json | null;   // ✅ aangepast
      zotero_user_id: string | null;
      zotero_api_key: string | null;
      last_zotero_sync: string | null;
      ai_provider: string;
      created_at: string;
      updated_at: string;
      ai_columns?: Array<{ id: string; name: string; prompt: string }>;
      generated_content?: Json | null;  // ✅ aangepast
};

    // Clean up generated content for this column
    const currentGeneratedContent = preferences?.generated_content as Record<string, Record<string, string>> || {};
    const cleanedGeneratedContent: Record<string, Record<string, string>> = {};
    
    Object.keys(currentGeneratedContent).forEach(paperId => {
      const paperContent = currentGeneratedContent[paperId];
      const cleanedPaperContent = { ...paperContent };
      delete cleanedPaperContent[columnId];
      if (Object.keys(cleanedPaperContent).length > 0) {
        cleanedGeneratedContent[paperId] = cleanedPaperContent;
      }
    });

    // Clean up column widths for this column
    const currentColumnWidths = preferences?.column_widths as Record<string, number> || {};
    const cleanedColumnWidths = { ...currentColumnWidths };
    delete cleanedColumnWidths[`ai-${columnId}`];

    // Save back to preferences (preserve all existing fields)
    const upsertData: UpsertPreferences = {
      ...preferences,
      ai_columns: updatedAiColumns,
      generated_content: cleanedGeneratedContent,
      column_widths: cleanedColumnWidths,
      updated_at: new Date().toISOString(),
    };

    if (userInfo.legacy) {
      upsertData.user_id = userInfo.supabase_user_id;
      console.log('🗑️ AI Columns DELETE - Using legacy user_id:', userInfo.supabase_user_id);
    } else {
      upsertData.supabase_user_id = userInfo.supabase_user_id;
      console.log('🗑️ AI Columns DELETE - Using supabase_user_id:', userInfo.supabase_user_id);
    }
    
    console.log('🗑️ AI Columns DELETE - About to upsert:', upsertData);
    
    // Upsert with appropriate conflict resolution
    const conflictColumn = userInfo.legacy ? 'user_id' : 'supabase_user_id';
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(upsertData, {
        onConflict: conflictColumn
      })
      .select()
      .single();

    console.log('🗑️ AI Columns DELETE - Upsert result:', { data, error });

    if (error) {
      console.error('🗑️ AI Columns DELETE - Error removing AI column:', error);
      return NextResponse.json({ error: 'Failed to remove AI column', details: error.message }, { status: 500 });
    }

    if (!data) {
      console.error('🗑️ AI Columns DELETE - No data returned from upsert');
      return NextResponse.json({ error: 'Failed to remove AI column - no data returned' }, { status: 500 });
    }

    console.log('🗑️ AI Columns DELETE - Successfully removed column');
    return NextResponse.json({ success: true, columnId });

  } catch (error) {
    console.error('Error in AI columns DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}