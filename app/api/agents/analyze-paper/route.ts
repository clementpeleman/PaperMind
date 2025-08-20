/**
 * Paper Analysis Agent API Endpoint
 * Provides comprehensive analysis of individual research papers
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAgentEnvironment } from '@/lib/agents/config';
import { PaperAnalysisInputSchema } from '@/lib/agents/schemas';
import { PaperAnalysisAgent } from '@/lib/agents/paper-analysis-agent';
import { getAgentRegistry } from '@/lib/agents/base';
import { createAgentContext } from '@/lib/agents/utils';
import { createAgentCollectionContext } from '@/lib/agents/collection-utils';

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
  analysisType: z.enum(['comprehensive', 'methodology', 'limitations', 'findings', 'future_work']).default('comprehensive'),
  focusAreas: z.array(z.string()).optional(),
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

    const { paper, analysisType, focusAreas, collectionContext } = validationResult.data;

    // Get user context from headers
    const userId = request.headers.get('x-user-id') || undefined;
    const sessionId = request.headers.get('x-session-id') || undefined;
    const context = createAgentContext(userId, sessionId);

    // Create collection context for analysis if provided
    let agentCollectionContext = undefined;
    if (collectionContext) {
      agentCollectionContext = createAgentCollectionContext(
        collectionContext.name,
        collectionContext.allPapers as any[]
      );
    }

    // Create and execute the paper analysis agent
    const agent = new PaperAnalysisAgent();
    
    // Register the agent if not already registered
    const registry = getAgentRegistry();
    registry.register(agent);

    const analysisInput = {
      paper,
      analysisType,
      focusAreas,
      collectionContext: agentCollectionContext
    };

    const result = await agent.execute(analysisInput, context);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Paper analysis failed',
          details: result.error,
          metadata: result.metadata
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      metadata: {
        ...result.metadata,
        agentName: agent.name,
        agentVersion: agent.version,
        analysisType,
        focusAreas,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Error in paper analysis API:', error);
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
    agent: 'paper-analysis',
    version: '1.0.0',
    description: 'Analyzes individual research papers for key findings, methodology, limitations, and more',
    endpoints: {
      POST: '/api/agents/analyze-paper'
    },
    inputSchema: {
      paper: 'Paper object with title, authors, content, etc.',
      analysisType: 'Type of analysis: comprehensive, methodology, limitations, findings, future_work',
      focusAreas: 'Optional array of specific areas to focus on'
    },
    outputSchema: {
      keyFindings: 'Array of main findings',
      methodology: 'Research methodology description',
      limitations: 'Array of limitations',
      futureWork: 'Array of future research suggestions',
      relevantCitations: 'Array of relevant citations',
      researchGaps: 'Array of identified gaps',
      significance: 'Overall significance assessment',
      reliability: 'Reliability score and reasoning',
      tags: 'Auto-generated tags'
    }
  });
}