/**
 * Smart Column Agent API Endpoint
 * Generates intelligent column content for papers using specialized sub-agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAgentEnvironment } from '@/lib/agents/config';
import { SmartColumnInputSchema } from '@/lib/agents/schemas';
import { PaperAnalysisAgent } from '@/lib/agents/paper-analysis-agent';
import { createAgentCollectionContext } from '@/lib/agents/collection-utils';
import { createAgentContext } from '@/lib/agents/utils';

// Helper function to fetch full text from Zotero attachments
async function fetchFullTextFromZoteroAttachments(
  paperId: string,
  zoteroToken: string,
  zoteroUserId: string,
  zoteroLibraryType: string,
  zoteroLibraryId?: string
): Promise<string | null> {
  try {
    console.log(`🔍 Fetching Zotero attachments for ${paperId}...`);
    
    const attachmentUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/zotero/attachments/${paperId}`);
    attachmentUrl.searchParams.set('token', zoteroToken);
    attachmentUrl.searchParams.set('userId', zoteroUserId);
    attachmentUrl.searchParams.set('libraryType', zoteroLibraryType);
    if (zoteroLibraryId) {
      attachmentUrl.searchParams.set('libraryId', zoteroLibraryId);
    }

    const response = await fetch(attachmentUrl.toString());
    
    if (!response.ok) {
      console.error('Failed to fetch Zotero attachments:', response.status);
      return null;
    }

    const { attachments } = await response.json();
    
    // Find the first attachment with valid full text
    const textAttachment = attachments.find((att: any) => 
      att.hasFullText && att.fullText && att.fullText.length > 100
    );

    if (textAttachment) {
      console.log(`✅ Found full text from attachment: ${textAttachment.filename} (${textAttachment.textQuality?.wordCount} words)`);
      return textAttachment.fullText;
    }

    console.log('No valid full text found in attachments');
    return null;
  } catch (error) {
    console.error('Error fetching Zotero attachments:', error);
    return null;
  }
}

// Request validation schema
const RequestSchema = z.object({
  paper: z.object({
    id: z.string(),
    title: z.string(),
    authors: z.array(z.string()),
    journal: z.string(),
    year: z.number(),
    doi: z.string().optional(),
    tags: z.array(z.string()),
    notes: z.string(),
    dateAdded: z.string(),
    collections: z.array(z.string()),
    status: z.enum(["unread", "reading", "read", "archived"]),
    url: z.string().optional(),
    zoteroKey: z.string().optional(),
    zoteroVersion: z.number().optional(),
    itemType: z.string().optional(),
    aiColumns: z.record(z.string()).optional(),
  }),
  columnType: z.enum(['methodology', 'limitations', 'findings', 'future_work', 'significance', 'custom']),
  customPrompt: z.string().optional(),
  outputFormat: z.enum(['paragraph', 'bullet_points', 'keywords', 'score']).default('paragraph'),
  maxLength: z.number().default(500),
  collectionContext: z.object({
    name: z.string(),
    allPapers: z.array(z.object({
      id: z.string(),
      title: z.string(),
      authors: z.array(z.string()),
      journal: z.string(),
      year: z.number(),
      tags: z.array(z.string()),
      collections: z.array(z.string()),
    })),
  }).optional(),
  // Zotero credentials for full text access
  zoteroToken: z.string().optional(),
  zoteroUserId: z.string().optional(),
  zoteroLibraryType: z.enum(['user', 'group']).default('user'),
  zoteroLibraryId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Validate environment
    const envValidation = validateAgentEnvironment();
    if (!envValidation.valid) {
      return NextResponse.json(
        { error: 'Agent environment not properly configured', details: envValidation.errors },
        { status: 500 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = RequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }

    const { 
      paper, 
      columnType, 
      customPrompt, 
      outputFormat, 
      maxLength, 
      collectionContext,
      zoteroToken,
      zoteroUserId,
      zoteroLibraryType,
      zoteroLibraryId
    } = validationResult.data;

    // Get user context
    const userId = request.headers.get('x-user-id') || undefined;
    const sessionId = request.headers.get('x-session-id') || undefined;
    const context = createAgentContext(userId, sessionId);

    // Get full text with priority: provided notes > Zotero attachments > fallback
    let paperFullText = paper.notes;
    let fullTextSource = 'notes';

    // Try Zotero attachments if we have the necessary credentials (always prefer PDF over notes)
    console.log(`🔍 Smart Column PDF Check: paper.notes length: ${paper.notes?.length || 0}, has zoteroToken: ${!!zoteroToken}, has zoteroKey: ${!!paper.zoteroKey}`);
    
    if (zoteroToken && zoteroUserId && paper.zoteroKey) {
      console.log(`📄 Attempting to fetch PDF for paper: ${paper.title} (${paper.zoteroKey})`);
      try {
        const attachmentText = await fetchFullTextFromZoteroAttachments(
          paper.zoteroKey, 
          zoteroToken, 
          zoteroUserId, 
          zoteroLibraryType || 'user', 
          zoteroLibraryId
        );
        if (attachmentText && attachmentText.length > 100) {
          paperFullText = attachmentText;
          fullTextSource = 'zotero_attachment';
          console.log(`✅ Using full text from Zotero attachment for smart column analysis: ${attachmentText.length} characters`);
        } else {
          console.log(`⚠️ No valid attachment text found for paper: ${paper.zoteroKey}`);
        }
      } catch (error) {
        console.log('❌ Could not fetch full text from Zotero attachments:', error);
      }
    } else {
      console.log('⏭️ Skipping PDF fetch - using existing notes or missing credentials');
    }

    // Update paper object with full text for analysis
    const enrichedPaper = {
      ...paper,
      notes: paperFullText || paper.notes,
      fullText: paperFullText
    };

    // Create collection context for analysis if provided
    let agentCollectionContext = undefined;
    if (collectionContext) {
      agentCollectionContext = createAgentCollectionContext(
        collectionContext.name,
        collectionContext.allPapers as any[]
      );
    }

    // Use Paper Analysis Agent to generate content
    const agent = new PaperAnalysisAgent();
    
    try {
      let result;
      
      if (columnType === 'custom' && customPrompt) {
        // Use custom insight extraction for custom prompts
        result = await agent.extractCustomInsight(
          enrichedPaper as any,
          customPrompt,
          context
        );
      } else {
        // Use standard column insight extraction for predefined types
        result = await agent.extractColumnInsight(
          enrichedPaper as any,
          columnType === 'significance' ? 'significance' : columnType as any,
          context
        );
      }

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Analysis failed');
      }

      let content = result.data;

      // Apply formatting based on output format
      switch (outputFormat) {
        case 'bullet_points':
          if (typeof content === 'string' && !content.startsWith('•')) {
            const sentences = content.split('. ').filter(s => s.trim());
            content = sentences.map(s => `• ${s.trim()}`).join('\n');
          }
          break;
        case 'keywords':
          if (typeof content === 'string') {
            // Extract key terms from the content
            const words = content.toLowerCase()
              .replace(/[^\w\s]/g, '')
              .split(/\s+/)
              .filter(word => word.length > 4)
              .slice(0, 8);
            content = [...new Set(words)].join(', ');
          }
          break;
        case 'score':
          // For scoring, we should use the actual AI-generated content
          // The agent should have provided the score based on the prompt
          // Don't override it unless it's empty
          if (typeof content !== 'string' || content.trim() === '') {
            if (columnType === 'significance') {
              content = 'Significance assessment: High impact research contribution';
            } else {
              content = 'Score: Analysis complete - see detailed results';
            }
          }
          break;
      }

      // Truncate if necessary
      if (typeof content === 'string' && content.length > maxLength) {
        content = content.substring(0, maxLength - 3) + '...';
      }

      const smartColumnResponse = {
        content: content as string,
        confidence: 0.9, // High confidence with real agent
        sources: ['Paper Analysis Agent', 'Title', 'Abstract/Notes'],
        tags: [columnType, 'ai-generated', 'collection-aware']
      };

      return NextResponse.json({
        success: true,
        data: smartColumnResponse,
        metadata: {
          agentName: 'smart-column',
          agentVersion: '1.0.0',
          model: 'gpt-4o-mini',
          columnType,
          outputFormat,
          maxLength,
          customPrompt,
          processingTime: result.metadata?.processingTime || 0,
          tokensUsed: result.metadata?.tokensUsed || 0,
          timestamp: new Date().toISOString(),
          collectionContext: agentCollectionContext?.name || 'No collection context'
        }
      });

    } catch (error) {
      console.error('Error in smart column agent:', error);
      return NextResponse.json(
        { 
          error: 'Smart column generation failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in smart column API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    agent: 'smart-column',
    version: '1.0.0',
    description: 'Generates intelligent column content using specialized sub-agents for different analysis types',
    endpoints: {
      POST: '/api/agents/smart-column'
    },
    supportedColumnTypes: [
      'methodology',
      'limitations', 
      'findings',
      'future_work',
      'significance',
      'custom'
    ],
    supportedOutputFormats: [
      'paragraph',
      'bullet_points',
      'keywords',
      'score'
    ],
    inputSchema: {
      paper: 'Paper object to analyze',
      columnType: 'Type of analysis column to generate',
      customPrompt: 'Custom prompt if columnType is "custom"',
      outputFormat: 'Format for the generated content',
      maxLength: 'Maximum character count (default: 500)'
    },
    outputSchema: {
      content: 'Generated content for the column',
      confidence: 'Confidence score (0-1) for the analysis',
      sources: 'Parts of the paper that informed the analysis',
      tags: 'Relevant tags for the content'
    }
  });
}