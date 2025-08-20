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

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // For debugging, let's check what auth headers we have
    const zoteroUserId = request.headers.get('x-zotero-user-id');
    const authHeader = request.headers.get('authorization');
    
    // Get current user from Zotero auth
    const user = await getCurrentUser(request);
    
    // If no user found, still show debug info
    if (!user) {
      // Still show debug info even without auth
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, zotero_user_id, zotero_username')
        .limit(10);

      const { data: allPrefs } = await supabase
        .from('user_preferences')
        .select('user_id, ai_columns')
        .limit(10);

      return NextResponse.json({ 
        debug: true,
        error: 'No user found',
        authInfo: {
          zoteroUserId: zoteroUserId,
          authHeaderPresent: !!authHeader
        },
        allUsers: allUsers,
        allUserPreferences: allPrefs
      });
    }

    console.log('Debug AI Columns: Looking for user preferences for user:', user.id);

    // Get user preferences with AI columns
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    console.log('Debug AI Columns: Preferences result:', { preferences, error });

    // Also check what users exist in the database
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, zotero_user_id, zotero_username')
      .limit(10);

    // And check all user_preferences entries
    const { data: allPrefs } = await supabase
      .from('user_preferences')
      .select('user_id, ai_columns')
      .limit(10);

    return NextResponse.json({ 
      debug: true,
      currentUser: user,
      userPreferences: preferences,
      preferencesError: error,
      allUsers: allUsers,
      allUserPreferences: allPrefs,
      requestHeaders: {
        zoteroUserId: request.headers.get('x-zotero-user-id'),
        authorization: request.headers.get('authorization') ? 'present' : 'missing'
      }
    });

  } catch (error) {
    console.error('Debug AI Columns API error:', error);
    return NextResponse.json({ 
      debug: true,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}