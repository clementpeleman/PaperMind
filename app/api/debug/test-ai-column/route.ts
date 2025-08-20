import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Helper function to get user from Zotero auth headers
async function getCurrentUser(request: NextRequest) {
  const zoteroUserId = request.headers.get('x-zotero-user-id');
  
  if (!zoteroUserId) {
    return null;
  }

  const supabase = createAdminClient();
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('zotero_user_id', zoteroUserId)
    .single();

  if (error) {
    return null;
  }

  return user;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Get current user from Zotero auth
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧪 TEST: Starting manual AI column test for user:', user.id);

    // Get current preferences
    const { data: currentPrefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    console.log('🧪 TEST: Current preferences:', currentPrefs);
    console.log('🧪 TEST: Current ai_columns:', currentPrefs?.ai_columns);

    if (prefsError && prefsError.code !== 'PGRST116') {
      console.error('🧪 TEST: Error fetching preferences:', prefsError);
      return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
    }

    // Create a test AI column
    const testColumn = {
      id: 'test-' + Date.now().toString(),
      name: 'Test Column',
      prompt: 'This is a test column prompt'
    };

    // Update AI columns array
    const currentAiColumns = currentPrefs?.ai_columns || [];
    console.log('🧪 TEST: Current AI columns array:', currentAiColumns);
    
    const updatedAiColumns = [...currentAiColumns, testColumn];
    console.log('🧪 TEST: Updated AI columns array:', updatedAiColumns);

    // Prepare the full upsert data
    const upsertData = {
      ...currentPrefs,
      user_id: user.id,
      ai_columns: updatedAiColumns,
      updated_at: new Date().toISOString(),
    };

    console.log('🧪 TEST: Full upsert data:', JSON.stringify(upsertData, null, 2));

    // Try the upsert
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(upsertData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    console.log('🧪 TEST: Upsert result data:', data);
    console.log('🧪 TEST: Upsert result error:', error);

    if (error) {
      console.error('🧪 TEST: Upsert failed:', error);
      return NextResponse.json({ 
        error: 'Test upsert failed', 
        details: error.message,
        code: error.code,
        hint: error.hint
      }, { status: 500 });
    }

    // Verify the save by reading it back
    const { data: verifyPrefs } = await supabase
      .from('user_preferences')
      .select('ai_columns')
      .eq('user_id', user.id)
      .single();

    console.log('🧪 TEST: Verification read:', verifyPrefs);

    return NextResponse.json({ 
      success: true,
      testColumn: testColumn,
      beforeSave: currentAiColumns,
      afterSave: data?.ai_columns,
      verification: verifyPrefs?.ai_columns
    });

  } catch (error) {
    console.error('🧪 TEST: Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}