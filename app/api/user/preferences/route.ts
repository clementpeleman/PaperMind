import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Helper function to get user from Supabase Auth
async function getCurrentUser(request: NextRequest) {
  // Try Supabase Auth first
  const { supabase } = createClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (user && !authError) {
    return { supabase_user_id: user.id, legacy: false };
  }

  // Fallback to legacy Zotero auth headers for existing users
  const zoteroUserId = request.headers.get('x-zotero-user-id');
  
  if (!zoteroUserId) {
    return null;
  }

  const adminSupabase = createAdminClient();
  
  const { data: legacyUser, error } = await adminSupabase
    .from('users')
    .select('*, supabase_user_id')
    .eq('zotero_user_id', zoteroUserId)
    .single();

  if (error) {
    return null;
  }

  // If user has supabase_user_id, use that; otherwise use legacy ID
  const typedLegacyUser = legacyUser as unknown as { id: string; supabase_user_id?: string | null };
  return { 
    supabase_user_id: typedLegacyUser.supabase_user_id || typedLegacyUser.id, 
    legacy: !typedLegacyUser.supabase_user_id 
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Get current user
    const userInfo = await getCurrentUser(request);
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user preferences using appropriate column
    const query = userInfo.legacy 
      ? supabase.from('user_preferences').select('*').eq('user_id', userInfo.supabase_user_id)
      : supabase.from('user_preferences').select('*').eq('supabase_user_id', userInfo.supabase_user_id);
    
    const { data: preferences, error } = await query.single();

    if (error && error.code !== 'PGRST116') { // Not found error
      console.error('Error fetching preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Return preferences or default values
    const finalPreferences = preferences || {
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
    
    return NextResponse.json({
      preferences: finalPreferences
    });

  } catch (error) {
    console.error('Error in preferences GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Get current user
    const userInfo = await getCurrentUser(request);
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      row_height_preset,
      custom_row_height,
      column_widths,
      column_visibility,
      ai_columns,
      generated_content,
    } = body;

    // Prepare upsert data based on auth type
    const upsertData: { [key: string]: unknown } = {
      row_height_preset,
      custom_row_height,
      column_widths,
      column_visibility,
      ai_columns,
      generated_content,
      updated_at: new Date().toISOString(),
    };

    if (userInfo.legacy) {
      upsertData.user_id = userInfo.supabase_user_id;
    } else {
      upsertData.supabase_user_id = userInfo.supabase_user_id;
    }

    // Upsert user preferences with appropriate conflict resolution
    const conflictColumn = userInfo.legacy ? 'user_id' : 'supabase_user_id';
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(upsertData, {
        onConflict: conflictColumn
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving preferences:', error);
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    return NextResponse.json({ preferences: data });

  } catch (error) {
    console.error('Error in preferences POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}