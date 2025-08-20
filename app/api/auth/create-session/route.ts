import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { supabase_user_id } = await request.json();

    if (!supabase_user_id) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    
    // Get the user from Supabase Auth
    const { data: authUser, error: getUserError } = await adminSupabase.auth.admin.getUserById(supabase_user_id);
    
    if (getUserError || !authUser.user) {
      console.error('Failed to get user:', getUserError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate a new session for the user
    const { data: sessionData, error: sessionError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email!,
    });

    if (sessionError || !sessionData.properties?.action_link) {
      console.error('Failed to generate session link:', sessionError);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    // Extract the token from the magic link
    const url = new URL(sessionData.properties.action_link);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({ error: 'No token in magic link' }, { status: 500 });
    }

    // Verify the token to create a valid session
    const { data: verifyData, error: verifyError } = await adminSupabase.auth.verifyOtp({
      token_hash: token,
      type: 'magiclink',
    });

    if (verifyError || !verifyData.session) {
      console.error('Failed to verify token:', verifyError);
      return NextResponse.json({ error: 'Failed to verify token' }, { status: 500 });
    }

    console.log('Successfully created session for user:', supabase_user_id);
    
    // Return the session data for the frontend to use
    return NextResponse.json({ 
      success: true,
      session: {
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
        expires_in: verifyData.session.expires_in,
        expires_at: verifyData.session.expires_at,
        user: verifyData.user,
      }
    });

  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}