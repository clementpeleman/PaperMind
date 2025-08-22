import { NextRequest, NextResponse } from 'next/server';
import { PaperAnalyzerAgent, DEFAULT_ANALYSIS_CARDS } from '@/lib/agents/paper-analyzer-agent';
import { paperAnalysisService, ANALYSIS_TYPE_LABELS } from '@/lib/services/paper-analysis-service';
import { AnalysisType } from '@/lib/database.types';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface AnalyzeCompleteRequest {
  paperId: string;
  title: string;
  authors: string[];
  abstract: string;
  fullText?: string; // If available
  url?: string; // For fetching full text
  activeCardIds: string[]; // Which analysis cards to run
}

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
    const body = await request.json() as AnalyzeCompleteRequest;
    const { paperId, title, authors, abstract, fullText, url, activeCardIds } = body;

    // Initialize the agent
    const agent = new PaperAnalyzerAgent();

    // Get full text (either provided or fetch from URL)
    let paperFullText = fullText;
    if (!paperFullText && url) {
      try {
        paperFullText = await fetchFullTextFromURL(url);
      } catch (error) {
        console.log('Could not fetch full text, using abstract only');
        paperFullText = abstract; // Fallback to abstract
      }
    }

    if (!paperFullText) {
      return NextResponse.json(
        { error: 'No full text available for analysis' },
        { status: 400 }
      );
    }

    // Create paper document
    const paperDocument = {
      id: paperId,
      title,
      authors,
      abstract,
      fullText: paperFullText,
      chunks: [],
      processingStatus: 'pending' as const
    };

    // Filter analysis cards based on active cards
    const selectedCards = DEFAULT_ANALYSIS_CARDS.filter(card => 
      activeCardIds.includes(card.id)
    );

    if (selectedCards.length === 0) {
      return NextResponse.json(
        { error: 'No analysis cards selected' },
        { status: 400 }
      );
    }

    console.log(`🔬 Starting comprehensive analysis for: ${title}`);
    console.log(`📊 Running ${selectedCards.length} analysis cards`);

    const startTime = Date.now();

    // Run the comprehensive analysis
    const analysisResults = await agent.analyzePaper(paperDocument, selectedCards);

    const processingTime = Date.now() - startTime;
    const chunksUsed = paperDocument.chunks.length;

    // Save results to database directly using our existing auth and supabase client
    const savePromises = selectedCards.map(async (card) => {
      const analysisContent = analysisResults[card.id];
      if (!analysisContent) return null;

      try {
        // Get current user using the same pattern as other APIs
        const userInfo = await getCurrentUser(request);
        if (!userInfo) {
          console.error('No user found for saving analysis');
          return { success: false, error: 'Unauthorized' };
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
            console.error('User not found in database for analysis save');
            return { success: false, error: 'User not found' };
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
          console.error('Paper not found for analysis save:', paperId);
          return { success: false, error: 'Paper not found' };
        }

        const actualPaperId = paperData.id;

        // Save analysis using the database function
        const { data: analysisId, error: saveError } = await supabase.rpc('save_paper_analysis', {
          p_user_id: userId,
          p_paper_id: actualPaperId,
          p_analysis_type: card.id as AnalysisType,
          p_analysis_title: ANALYSIS_TYPE_LABELS[card.id as AnalysisType] || card.title,
          p_content: analysisContent,
          p_prompt_used: card.prompt,
          p_processing_time_ms: Math.floor(processingTime / selectedCards.length),
          p_chunks_used: chunksUsed,
          p_model_used: 'gpt-4'
        });

        if (saveError) {
          console.error('Error saving analysis:', saveError);
          return { success: false, error: saveError.message };
        }

        return { success: true, analysisId };

      } catch (error) {
        console.error('Error in save analysis:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Wait for all saves to complete
    const saveResults = await Promise.allSettled(savePromises);
    const successfulSaves = saveResults.filter(result => 
      result.status === 'fulfilled' && result.value?.success
    ).length;

    console.log(`💾 Saved ${successfulSaves}/${selectedCards.length} analysis results to database`);

    // Return results
    return NextResponse.json({
      success: true,
      paperId,
      title,
      results: analysisResults,
      cardsAnalyzed: selectedCards.length,
      savedToDatabase: successfulSaves,
      processingInfo: {
        chunksCreated: paperDocument.chunks.length,
        fullTextLength: paperFullText.length,
        processingStatus: paperDocument.processingStatus,
        totalProcessingTimeMs: processingTime
      }
    });

  } catch (error: any) {
    console.error('Error in complete paper analysis:', error);
    
    return NextResponse.json(
      { 
        error: 'Analysis failed',
        details: error.message,
        type: error.constructor.name
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch full text from paper URL
 * This is a simplified version - in production you'd want more robust PDF parsing
 */
async function fetchFullTextFromURL(url: string): Promise<string> {
  // Check if it's a PDF URL
  if (url.toLowerCase().includes('.pdf')) {
    // In a real implementation, you'd use a PDF parser here
    throw new Error('PDF parsing not implemented in this demo');
  }

  // For web pages, try to fetch and extract text
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PaperMind/1.0; Research Analysis Bot)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Basic HTML to text conversion (in production, use a proper parser)
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (textContent.length < 100) {
      throw new Error('Extracted text too short');
    }

    return textContent;
    
  } catch (error) {
    console.error('Error fetching full text from URL:', error);
    throw error;
  }
}

// GET endpoint to retrieve available analysis cards
export async function GET() {
  return NextResponse.json({
    availableCards: DEFAULT_ANALYSIS_CARDS.map(card => ({
      id: card.id,
      title: card.title,
      prompt: card.prompt,
      targetSections: card.targetSections,
      maxChunks: card.maxChunks
    }))
  });
}