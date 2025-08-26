import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { directTimelineActivityService } from '@/lib/services/timeline-activity-direct';

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

    // Get existing papers to check what's new
    const { data: existingPapers } = await supabase
      .from('papers')
      .select('zotero_key, title, status, tags, collections, notes')
      .eq('user_id', userId);

    const existingPapersMap = new Map(
      (existingPapers || []).map(p => [p.zotero_key, p])
    );

    // Process papers in batches to avoid overwhelming the database
    const batchSize = 10;
    let synced = 0;
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

          const existingPaper = existingPapersMap.get(paper.id);
          const isNewPaper = !existingPaper;

          // Use upsert to handle both insert and update
          const { data: upsertedPaper, error: upsertError } = await supabase
            .from('papers')
            .upsert(paperData, { 
              onConflict: 'user_id,zotero_key',
              ignoreDuplicates: false 
            })
            .select('id, title')
            .single();

          if (upsertError) {
            console.error(`Error upserting paper ${paper.id}:`, upsertError);
            errors++;
          } else {
            synced++;

            // Log timeline activities for new papers and changes
            if (upsertedPaper) {
              if (isNewPaper) {
                console.log('📝 Logging new paper activity:', {
                  userId,
                  paperId: upsertedPaper.id,
                  title: paperData.title
                });
                
                // Log paper added activity
                const logResult = await directTimelineActivityService.logPaperAdded(
                  userId,
                  upsertedPaper.id,
                  paperData.title
                );
                
                console.log('📝 Timeline log result:', logResult);

                // Log initial tags if present
                if (paperData.tags.length > 0) {
                  await directTimelineActivityService.logTagsAdded(
                    userId,
                    upsertedPaper.id,
                    paperData.title,
                    paperData.tags
                  );
                }

                // Log initial collections if present
                if (paperData.collections.length > 0) {
                  await directTimelineActivityService.logCollectionChanged(
                    userId,
                    upsertedPaper.id,
                    paperData.title,
                    paperData.collections
                  );
                }

                // Log initial notes if present
                if (paperData.notes.trim()) {
                  await directTimelineActivityService.logNoteAdded(
                    userId,
                    upsertedPaper.id,
                    paperData.title,
                    paperData.notes
                  );
                }
              } else {
                // Check for changes in existing papers
                if (existingPaper.status !== paperData.status) {
                  await directTimelineActivityService.logStatusChanged(
                    userId,
                    upsertedPaper.id,
                    paperData.title,
                    existingPaper.status,
                    paperData.status
                  );
                }

                // Check for new tags
                const existingTags = new Set(existingPaper.tags || []);
                const newTags = (paperData.tags || []).filter((tag: string) => !existingTags.has(tag));
                if (newTags.length > 0) {
                  await directTimelineActivityService.logTagsAdded(
                    userId,
                    upsertedPaper.id,
                    paperData.title,
                    newTags
                  );
                }

                // Check for collection changes
                const existingCollections = new Set(existingPaper.collections || []);
                const newCollections = (paperData.collections || []).filter((col: string) => !existingCollections.has(col));
                if (newCollections.length > 0) {
                  await directTimelineActivityService.logCollectionChanged(
                    userId,
                    upsertedPaper.id,
                    paperData.title,
                    newCollections
                  );
                }

                // Check for new notes
                if (paperData.notes && paperData.notes.trim() && 
                    paperData.notes !== existingPaper.notes) {
                  await directTimelineActivityService.logNoteAdded(
                    userId,
                    upsertedPaper.id,
                    paperData.title,
                    paperData.notes
                  );
                }
              }
            }
          }

        } catch (error) {
          console.error(`Error processing paper ${paper.id}:`, error);
          errors++;
        }
      }
    }

    // Handle paper deletions - find papers that exist in DB but not in Zotero
    const zoteroKeysSet = new Set(papers.map(p => p.id));
    const papersToDelete = (existingPapers || []).filter(p => !zoteroKeysSet.has(p.zotero_key));
    
    let deleted = 0;
    if (papersToDelete.length > 0) {
      console.log(`🗑️ Found ${papersToDelete.length} papers to delete`);
      
      for (const paperToDelete of papersToDelete) {
        try {
          if (!paperToDelete.zotero_key) {
            throw new Error("Paper is missing zotero_key");
          }
          // Get the paper ID before deletion for timeline logging
          const { data: paperToDeleteFull, error: fetchError } = await supabase
            .from('papers')
            .select('id, title')
            .eq('user_id', userId)
            .eq('zotero_key', paperToDelete.zotero_key)
            .single();

          if (fetchError) {
            console.error(`Error fetching paper to delete ${paperToDelete.zotero_key}:`, fetchError);
            continue;
          }

          // Log timeline activity for paper deletion BEFORE deleting the paper
          // (to avoid foreign key constraint violation)
          const logResult = await directTimelineActivityService.logStatusChanged(
            userId,
            paperToDeleteFull.id,
            paperToDeleteFull.title,
            'active',
            'deleted'
          );
          
          console.log('📝 Timeline deletion log result:', logResult);

          // Delete the paper from database
          const { error: deleteError } = await supabase
            .from('papers')
            .delete()
            .eq('user_id', userId)
            .eq('zotero_key', paperToDelete.zotero_key);

          if (deleteError) {
            console.error(`Error deleting paper ${paperToDelete.zotero_key}:`, deleteError);
            errors++;
          } else {
            deleted++;
            console.log(`🗑️ Deleted paper: ${paperToDelete.title}`);
          }
        } catch (error) {
          console.error(`Error processing deletion of paper ${paperToDelete.zotero_key}:`, error);
          errors++;
        }
      }
    }

    console.log(`✅ Paper sync complete: ${synced} synced, ${deleted} deleted, ${errors} errors`);

    return NextResponse.json({
      success: true,
      synced,
      deleted,
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