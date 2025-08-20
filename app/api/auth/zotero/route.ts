import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const ZOTERO_OAUTH_BASE_URL = 'https://www.zotero.org/oauth';
const ZOTERO_CLIENT_KEY = process.env.ZOTERO_CLIENT_ID;
const ZOTERO_CLIENT_SECRET = process.env.ZOTERO_CLIENT_SECRET;
const CALLBACK_URL = process.env.NEXTAUTH_URL || 'http://localhost:3002';

// OAuth 1.0a helper functions
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

function generateTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function percentEncode(str: string) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function generateSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  tokenSecret: string = ''
) {
  // Sort parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
  
  const signingKey = `${percentEncode(ZOTERO_CLIENT_SECRET || '')}&${percentEncode(tokenSecret)}`;
  
  return crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get('oauth_token');
  const oauthVerifier = searchParams.get('oauth_verifier');

  if (!ZOTERO_CLIENT_KEY || !ZOTERO_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Zotero OAuth credentials not configured' }, { status: 500 });
  }

  // Step 1: Get request token or Step 3: Exchange for access token
  if (!oauthToken) {
    // Step 1: Get request token
    try {
      const nonce = generateNonce();
      const timestamp = generateTimestamp();
      const callbackUri = `${CALLBACK_URL}/api/auth/zotero`;

      const params: Record<string, string> = {
        oauth_callback: callbackUri,
        oauth_consumer_key: ZOTERO_CLIENT_KEY,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_version: '1.0',
      };

      const signature = generateSignature('POST', `${ZOTERO_OAUTH_BASE_URL}/request`, params);
      params['oauth_signature'] = signature;

      const authHeader = 'OAuth ' + Object.keys(params)
        .map(key => `${percentEncode(key)}="${percentEncode(params[key])}"`)
        .join(', ');

      console.log('OAuth Request Token - URL:', `${ZOTERO_OAUTH_BASE_URL}/request`);
      console.log('OAuth Request Token - Auth Header:', authHeader);
      console.log('OAuth Request Token - Callback URI:', callbackUri);

      const requestTokenResponse = await fetch(`${ZOTERO_OAUTH_BASE_URL}/request`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!requestTokenResponse.ok) {
        const errorText = await requestTokenResponse.text();
        console.error('OAuth Request Token Error Response:', errorText);
        throw new Error(`Request token failed: ${requestTokenResponse.statusText} - ${errorText}`);
      }

      const responseText = await requestTokenResponse.text();
      const responseParams = new URLSearchParams(responseText);
      const requestToken = responseParams.get('oauth_token');
      const requestTokenSecret = responseParams.get('oauth_token_secret');

      if (!requestToken) {
        throw new Error('Failed to get request token');
      }

      // Store token secret in a secure cookie
      const redirectResponse = NextResponse.redirect(`${ZOTERO_OAUTH_BASE_URL}/authorize?oauth_token=${requestToken}&library_access=1&notes_access=0&all_groups=read&write_access=1`);
      
      // Set httpOnly cookie to store the token secret securely
      redirectResponse.cookies.set('zotero_token_secret', requestTokenSecret || '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
        path: '/'
      });

      return redirectResponse;
    } catch (error) {
      console.error('Zotero OAuth Step 1 error:', error);
      return NextResponse.json({ 
        error: 'Failed to initiate Zotero OAuth',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } else if (oauthVerifier) {
    // Step 3: Exchange for access token
    try {
      // Retrieve token secret from cookie
      const tokenSecret = request.cookies.get('zotero_token_secret')?.value || '';
      
      if (!tokenSecret) {
        throw new Error('Missing OAuth token secret. Please restart the authentication process.');
      }

      const nonce = generateNonce();
      const timestamp = generateTimestamp();

      const params: Record<string, string> = {
        oauth_consumer_key: ZOTERO_CLIENT_KEY,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_token: oauthToken,
        oauth_verifier: oauthVerifier,
        oauth_version: '1.0',
      };

      // Use the stored token secret for signature generation
      const signature = generateSignature('POST', `${ZOTERO_OAUTH_BASE_URL}/access`, params, tokenSecret);
      params['oauth_signature'] = signature;

      const authHeader = 'OAuth ' + Object.keys(params)
        .map(key => `${percentEncode(key)}="${percentEncode(params[key])}"`)
        .join(', ');

      const tokenResponse = await fetch(`${ZOTERO_OAUTH_BASE_URL}/access`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!tokenResponse.ok) {
        throw new Error(`Access token failed: ${tokenResponse.statusText}`);
      }

      const responseText = await tokenResponse.text();
      const responseParams = new URLSearchParams(responseText);
      const accessToken = responseParams.get('oauth_token');
      const userId = responseParams.get('userID');

      if (!accessToken || !userId) {
        throw new Error('Failed to get access token or user ID');
      }

      // Check if user is already logged into Supabase
      const { createClient } = await import('@/lib/supabase/server');
      const { createAdminClient } = await import('@/lib/supabase/admin');
      
      const { supabase } = createClient(request);
      const { data: { user } } = await supabase.auth.getUser();

      // Check if we already have this Zotero user in our database
      const adminSupabase = createAdminClient();
      const { data: existingUser } = await adminSupabase
        .from('users')
        .select('*')
        .eq('zotero_user_id', userId)
        .single();

      if (existingUser) {
        console.log('Found existing user for Zotero ID:', userId);
        
        // Always update the access token (Zotero OAuth 1.0a tokens don't expire but may change)
        await adminSupabase
          .from('users')
          .update({
            zotero_access_token: accessToken,
            updated_at: new Date().toISOString(),
          })
          .eq('zotero_user_id', userId);

        if (existingUser.supabase_user_id) {
          // User has Supabase Auth account - create session
          console.log('Creating session for existing Supabase user:', existingUser.supabase_user_id);
          
          // Get the user's email from Supabase Auth
          const { data: authUser } = await adminSupabase.auth.admin.getUserById(existingUser.supabase_user_id);
          
          if (authUser.user) {
            // Create a new session for the user
            const redirectUrl = new URL('/', CALLBACK_URL);
            redirectUrl.searchParams.set('zotero', 'linked');
            redirectUrl.searchParams.set('existing', 'true');
            const response = NextResponse.redirect(redirectUrl.toString());
            
            // Store the user ID for the frontend to handle session creation
            response.cookies.set('zotero_supabase_user_id', existingUser.supabase_user_id, {
              httpOnly: false, // Allow frontend access
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 300, // 5 minutes
            });
            
            return response;
          }
        }
        
        // Legacy user without Supabase Auth - convert them
        console.log('Converting legacy user to Supabase Auth');
        const email = `zotero_${userId}@temp.papermind.app`;
        const password = crypto.randomBytes(32).toString('hex');
        
        const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            zotero_user_id: userId,
            auth_provider: 'zotero',
            converted_from_legacy: true,
          },
        });

        if (!authError && authUser.user) {
          // Link the existing user record to the new Supabase Auth user
          await adminSupabase
            .from('users')
            .update({
              supabase_user_id: authUser.user.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id);

          console.log('Successfully converted legacy user to Supabase Auth');
        }
      }

      if (user) {
        // User is already logged in - just link Zotero account
        await linkZoteroToUser(user.id, accessToken, userId);
      } else if (!existingUser) {
        // Create completely new user
        const newUser = await createUserWithZotero(accessToken, userId);
        if (newUser) {
          const redirectUrl = new URL('/', CALLBACK_URL);
          redirectUrl.searchParams.set('zotero', 'linked');
          redirectUrl.searchParams.set('new', 'true');
          const response = NextResponse.redirect(redirectUrl.toString());
          
          // Store session data for frontend
          response.cookies.set('zotero_supabase_user_id', newUser.user.id, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 300, // 5 minutes
          });
          
          return response;
        }
      }

      const redirectUrl = new URL('/', CALLBACK_URL);
      redirectUrl.searchParams.set('zotero', 'linked');
      
      const response = NextResponse.redirect(redirectUrl.toString());
      
      // Clear the token secret cookie
      response.cookies.delete('zotero_token_secret');
      
      return response;
    } catch (error) {
      console.error('Zotero OAuth Step 3 error:', error);
      return NextResponse.json({ 
        error: 'Failed to complete Zotero OAuth',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 });
  }
}

async function linkZoteroToUser(supabaseUserId: string, accessToken: string, zoteroUserId: string) {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminSupabase = createAdminClient();

  // Store/update Zotero credentials for this user
  const { error } = await adminSupabase
    .from('users')
    .upsert({
      supabase_user_id: supabaseUserId,
      zotero_user_id: zoteroUserId,
      zotero_access_token: accessToken,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'supabase_user_id'
    });

  if (error) {
    console.error('Error linking Zotero to user:', error);
    throw error;
  }

  console.log('Successfully linked Zotero account to Supabase user:', supabaseUserId);
}

async function createUserWithZotero(accessToken: string, zoteroUserId: string) {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminSupabase = createAdminClient();
  
  // Create a Supabase Auth user
  const email = `zotero_${zoteroUserId}@temp.papermind.app`;
  const password = crypto.randomBytes(32).toString('hex'); // Secure random password
  
  const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      zotero_user_id: zoteroUserId,
      auth_provider: 'zotero',
    },
  });

  if (authError) {
    console.error('Error creating Supabase user:', authError);
    throw authError;
  }

  if (!authUser.user) {
    throw new Error('No user returned from Supabase Auth');
  }

  // Link Zotero credentials to the new user
  await linkZoteroToUser(authUser.user.id, accessToken, zoteroUserId);

  console.log('Successfully created new Supabase user with Zotero:', authUser.user.id);

  return {
    user: authUser.user,
  };
}