import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const oauthToken = searchParams.get('oauth_token');
    const oauthVerifier = searchParams.get('oauth_verifier');

    if (!oauthToken || !oauthVerifier) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}?error=${encodeURIComponent('Missing OAuth parameters')}`
      );
    }

    // Handle Zotero OAuth 1.0a callback - this is called after user approves
    // We need to exchange the verifier for an access token
    console.log('Processing Zotero OAuth callback with token:', oauthToken);

    // This should redirect to the main Zotero route which handles token exchange
    const callbackUrl = new URL('/api/auth/zotero', request.nextUrl.origin);
    callbackUrl.searchParams.set('oauth_token', oauthToken);
    callbackUrl.searchParams.set('oauth_verifier', oauthVerifier);

    return NextResponse.redirect(callbackUrl.toString());

  } catch (error) {
    console.error('Zotero callback error:', error);
    return NextResponse.redirect(
      `${request.nextUrl.origin}?error=${encodeURIComponent('Authentication failed')}`
    );
  }
}

async function linkZoteroToUser(supabaseUserId: string, tokens: any, zoteroUsername: string | null) {
  const adminSupabase = createAdminClient();

  // Store/update Zotero credentials for this user
  const { error } = await adminSupabase
    .from('users')
    .upsert({
      supabase_user_id: supabaseUserId,
      zotero_user_id: tokens.userID,
      zotero_username: zoteroUsername,
      zotero_access_token: tokens.access_token,
      zotero_refresh_token: tokens.refresh_token,
      zotero_token_expires_at: tokens.expires_in ? 
        new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'supabase_user_id'
    });

  if (error) {
    console.error('Error linking Zotero to user:', error);
    throw error;
  }
}

async function createUserWithZotero(tokens: any, zoteroUsername: string | null) {
  const adminSupabase = createAdminClient();
  
  // Create a Supabase Auth user
  const email = `zotero_${tokens.userID}@temp.papermind.app`;
  const password = `zotero_${tokens.userID}_${Date.now()}`;
  
  const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
  });

  if (authError) {
    console.error('Error creating Supabase user:', authError);
    throw authError;
  }

  if (!authUser.user) {
    throw new Error('No user returned from Supabase Auth');
  }

  // Link Zotero credentials to the new user
  await linkZoteroToUser(authUser.user.id, tokens, zoteroUsername);

  return {
    email,
    password,
    supabaseUserId: authUser.user.id
  };
}