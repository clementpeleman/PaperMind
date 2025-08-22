import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AnalysisType } from '@/lib/database.types';

interface SaveAnalysisRequest {
  analysisType: AnalysisType;
  analysisTitle: string;
  content: string;
  promptUsed?: string;
  confidenceScore?: number;
  processingTimeMs?: number;
  chunksUsed?: number;
  modelUsed?: string;
}

interface AnalysisResponse {
  id: string;
  analysisType: AnalysisType;
  analysisTitle: string;
  content: string;
  confidenceScore: number | null;
  generatedAt: string;
  version: number;
  modelUsed: string;
}

// Helper function to get user from Supabase Auth (same as ai-columns route)
async function getCurrentUser(request: NextRequest) {
  // Try Supabase Auth first
  const { supabase } = createClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  console.log('🔍 Paper Analysis - Supabase Auth check:', { user: user?.id, error: authError?.message });

  if (user && !authError) {
    console.log('✅ Paper Analysis - Using Supabase Auth user:', user.id);
    return { supabase_user_id: user.id, legacy: false };
  }

  // Fallback to legacy Zotero auth headers for existing users
  const zoteroUserId = request.headers.get('x-zotero-user-id');
  console.log('🔍 Paper Analysis - Checking legacy Zotero headers:', { zoteroUserId });
  
  if (!zoteroUserId) {
    console.log('❌ Paper Analysis - No auth found');
    return null;
  }

  const adminSupabase = createAdminClient();
  
  const { data: legacyUser, error } = await adminSupabase
    .from('users')
    .select('*')
    .eq('zotero_user_id', zoteroUserId)
    .single();

  console.log('🔍 Paper Analysis - Legacy user lookup:', { legacyUser: legacyUser?.id, error: error?.message });

  if (error) {
    return null;
  }

  // If user has supabase_user_id, use that; otherwise use legacy ID
  const result = { 
    supabase_user_id: (legacyUser as any).supabase_user_id || legacyUser.id, 
    legacy: !(legacyUser as any).supabase_user_id 
  };
  
  console.log('📋 Paper Analysis - Final user info:', result);
  return result;
}

// GET - Retrieve analysis for a paper
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    
    // Get current user
    const userInfo = await getCurrentUser(request);
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    
    // Get actual user ID for database operations
    let userId: string;
    if (userInfo.legacy) {
      // For legacy users, supabase_user_id is actually the user.id
      userId = userInfo.supabase_user_id;
    } else {
      // For Supabase Auth users, look up the user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('supabase_user_id', userInfo.supabase_user_id)
        .single();

      if (userError || !userData) {
        return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
      }
      userId = userData.id;
    }
    // Look up paper by zotero_key to get actual UUID
    const { data: paperData, error: paperError } = await supabase
      .from('papers')
      .select('id')
      .eq('zotero_key', paperId)
      .eq('user_id', userId)
      .single();

    if (paperError || !paperData) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    const actualPaperId = paperData.id;
    
    const url = new URL(request.url);
    const analysisType = url.searchParams.get('type') as AnalysisType | null;

    if (analysisType) {
      // Get specific analysis type
      const { data, error } = await supabase.rpc('get_latest_paper_analysis', {
        p_user_id: userId,
        p_paper_id: actualPaperId,
        p_analysis_type: analysisType
      });

      if (error) {
        console.error('Error retrieving analysis:', error);
        return NextResponse.json({ error: 'Failed to retrieve analysis' }, { status: 500 });
      }

      const result = data?.[0];
      if (!result) {
        return NextResponse.json({ analysis: null });
      }

      return NextResponse.json({
        analysis: {
          id: result.id,
          content: result.content,
          confidenceScore: result.confidence_score,
          generatedAt: result.generated_at,
          version: result.version
        }
      });
    } else {
      // Get all analysis for the paper
      const { data, error } = await supabase.rpc('get_paper_analysis_summary', {
        p_user_id: userId,
        p_paper_id: actualPaperId
      });

      if (error) {
        console.error('Error retrieving analysis summary:', error);
        return NextResponse.json({ error: 'Failed to retrieve analysis summary' }, { status: 500 });
      }

      const analyses: Record<string, AnalysisResponse> = {};
      
      data?.forEach((item: any) => {
        analyses[item.analysis_type] = {
          id: item.id || '',
          analysisType: item.analysis_type,
          analysisTitle: item.analysis_title,
          content: item.content,
          confidenceScore: item.confidence_score,
          generatedAt: item.generated_at,
          version: item.version,
          modelUsed: item.model_used
        };
      });

      return NextResponse.json({ analyses });
    }

  } catch (error: any) {
    console.error('Error in GET paper analysis:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Save new analysis for a paper
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    const body = await request.json() as SaveAnalysisRequest;

    const {
      analysisType,
      analysisTitle,
      content,
      promptUsed,
      confidenceScore,
      processingTimeMs,
      chunksUsed,
      modelUsed = 'gpt-4'
    } = body;

    // Validate required fields
    if (!analysisType || !analysisTitle || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: analysisType, analysisTitle, content' },
        { status: 400 }
      );
    }

    // Get current user
    const userInfo = await getCurrentUser(request);
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    
    // Get actual user ID for database operations
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

    // Verify paper belongs to user - look up by zotero_key since paperId is a Zotero key
    const { data: paperData, error: paperError } = await supabase
      .from('papers')
      .select('id')
      .eq('zotero_key', paperId)
      .eq('user_id', userId)
      .single();

    if (paperError || !paperData) {
      return NextResponse.json({ error: 'Paper not found or access denied' }, { status: 404 });
    }
    
    // Use the actual UUID for database operations
    const actualPaperId = paperData.id;

    // Save analysis using the database function
    const { data: analysisId, error: saveError } = await supabase.rpc('save_paper_analysis', {
      p_user_id: userId,
      p_paper_id: actualPaperId,
      p_analysis_type: analysisType,
      p_analysis_title: analysisTitle,
      p_content: content,
      p_prompt_used: promptUsed || null,
      p_confidence_score: confidenceScore || null,
      p_processing_time_ms: processingTimeMs || null,
      p_chunks_used: chunksUsed || null,
      p_model_used: modelUsed
    });

    if (saveError) {
      console.error('Error saving analysis:', saveError);
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      analysisId,
      message: 'Analysis saved successfully'
    });

  } catch (error: any) {
    console.error('Error in POST paper analysis:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete analysis for a paper
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    
    const url = new URL(request.url);
    const analysisType = url.searchParams.get('type') as AnalysisType;

    if (!analysisType) {
      return NextResponse.json(
        { error: 'Analysis type is required' },
        { status: 400 }
      );
    }

    // Get current user
    const userInfo = await getCurrentUser(request);
    if (!userInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    
    // Get actual user ID for database operations
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

    // Look up paper by zotero_key to get actual UUID
    const { data: paperData, error: paperError } = await supabase
      .from('papers')
      .select('id')
      .eq('zotero_key', paperId)
      .eq('user_id', userId)
      .single();

    if (paperError || !paperData) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    const actualPaperId = paperData.id;

    // Soft delete by setting is_active to false
    const { error: deleteError } = await supabase
      .from('paper_analysis')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('paper_id', actualPaperId)
      .eq('analysis_type', analysisType)
      .eq('is_active', true);

    if (deleteError) {
      console.error('Error deleting analysis:', deleteError);
      return NextResponse.json({ error: 'Failed to delete analysis' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Analysis deleted successfully'
    });

  } catch (error: any) {
    console.error('Error in DELETE paper analysis:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}