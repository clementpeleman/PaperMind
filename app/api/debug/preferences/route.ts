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
    
    // Get current user from Zotero auth
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Debug: Looking for user preferences for user:', user.id);

    // Get user preferences
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.log('Debug: Error fetching preferences:', error);
      return NextResponse.json({ 
        debug: true,
        user: user,
        error: error.message,
        preferences: null 
      });
    }

    console.log('Debug: Found preferences:', preferences);

    return NextResponse.json({ 
      debug: true,
      user: user,
      preferences: preferences,
      ai_columns: preferences?.ai_columns || [],
      generated_content: preferences?.generated_content || {}
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({ 
      debug: true,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}