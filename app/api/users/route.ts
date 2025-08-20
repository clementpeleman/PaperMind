import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { zoteroUserId, zoteroUsername, displayName } = await request.json();

    if (!zoteroUserId) {
      return NextResponse.json({ error: 'Missing zoteroUserId' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Try to get existing user
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('zotero_user_id', zoteroUserId)
      .single();

    if (existingUser && !selectError) {
      // Update last_login
      const { data: updatedUser } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', existingUser.id)
        .select('*')
        .single();
      
      return NextResponse.json({ user: updatedUser || existingUser });
    }

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        zotero_user_id: zoteroUserId,
        zotero_username: zoteroUsername,
        display_name: displayName,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error creating user:', insertError);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    return NextResponse.json({ user: newUser });
  } catch (error) {
    console.error('Error in user API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const zoteroUserId = searchParams.get('zoteroUserId');

  if (!zoteroUserId) {
    return NextResponse.json({ error: 'Missing zoteroUserId parameter' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('zotero_user_id', zoteroUserId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}