import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    // Get the current user from Supabase Auth
    const { supabase } = createClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get Zotero credentials for this user
    const adminSupabase = createAdminClient();
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('zotero_user_id, zotero_access_token, zotero_refresh_token, zotero_token_expires_at')
      .eq('supabase_user_id', user.id)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        // No Zotero credentials found
        return NextResponse.json({ 
          zoteroUserId: null,
          zoteroAccessToken: null,
          zoteroRefreshToken: null,
          expiresAt: null
        });
      }
      throw userError;
    }

    return NextResponse.json({
      zoteroUserId: userData.zotero_user_id,
      zoteroAccessToken: userData.zotero_access_token,
      zoteroRefreshToken: userData.zotero_refresh_token,
      expiresAt: userData.zotero_token_expires_at,
    });

  } catch (error) {
    console.error('Error getting Zotero credentials:', error);
    return NextResponse.json(
      { error: 'Failed to get Zotero credentials' },
      { status: 500 }
    );
  }
}