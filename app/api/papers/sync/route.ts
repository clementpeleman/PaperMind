import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Helper function to get user (same as other routes)
async function getCurrentUser(request: NextRequest) {
  const { supabase } = createClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (user && !authError) {
    return { supabase_user_id: user.id, legacy: false };
  }

  const zoteroUserId = request.headers.get('x-zotero-user-id');
  if (!zoteroUserId) {
    return null;
  }

  const adminSupabase = createAdminClient();
  const { data: legacyUser, error } = await adminSupabase
    .from('users')
    .select('*')
    .eq('zotero_user_id', zoteroUserId)
    .single();

  if (error) {
    return null;
  }

  return { 
    supabase_user_id: (legacyUser as any).supabase_user_id || legacyUser.id, 
    legacy: !(legacyUser as any).supabase_user_id 
  };
}

export async function POST(request: NextRequest) {
  try {
    const userInfo = await getCurrentUser(request);
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    
    // Get actual user ID
    let userId: string;
    if (userInfo.legacy) {
      userId = userInfo.supabase_user_id;
    } else {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('supabase_user_id', userInfo.supabase_user_id)
        .single();

      if (userError || !userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      userId = userData.id;
    }

    const body = await request.json();
    const { papers } = body;

    if (!papers || !Array.isArray(papers)) {
      return NextResponse.json({ error: 'Papers array is required' }, { status: 400 });
    }

    console.log(`📚 Syncing ${papers.length} papers for user ${userId}`);

    // Process papers in batches to avoid overwhelming the database
    const batchSize = 10;
    let synced = 0;
    // let updated = 0;
    let errors = 0;

    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize);
      
      for (const paper of batch) {
        try {
          const paperData = {
            user_id: userId,
            title: paper.title || 'Untitled',
            authors: paper.authors || [],
            journal: paper.journal || '',
            year: paper.year || null,
            doi: paper.doi || null,
            url: paper.url || null,
            zotero_key: paper.id, // paper.id from Zotero is the key
            zotero_version: paper.zoteroVersion || null,
            tags: paper.tags || [],
            collections: paper.collections || [],
            notes: paper.notes || '',
            status: paper.status || 'unread',
            date_added: paper.dateAdded ? new Date(paper.dateAdded).toISOString() : new Date().toISOString()
          };

          // Use upsert to handle both insert and update
          const { error: upsertError } = await supabase
            .from('papers')
            .upsert(paperData, { 
              onConflict: 'user_id,zotero_key',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            console.error(`Error upserting paper ${paper.id}:`, upsertError);
            errors++;
          } else {
            synced++;
          }

        } catch (error) {
          console.error(`Error processing paper ${paper.id}:`, error);
          errors++;
        }
      }
    }

    console.log(`✅ Paper sync complete: ${synced} synced, ${errors} errors`);

    return NextResponse.json({
      success: true,
      synced,
      errors,
      total: papers.length
    });

  } catch (error: any) {
    console.error('Error in paper sync:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}