/**
 * Research Gap Analysis Agent API Endpoint  
 * Identifies research gaps and opportunities across paper collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAgentEnvironment } from '@/lib/agents/config';
import { ResearchGapInputSchema } from '@/lib/agents/schemas';
import { ResearchGapAgent } from '@/lib/agents/research-gap-agent';
import { AgentRegistry } from '@/lib/agents/registry';

// Request validation schema
const RequestSchema = z.object({
  papers: z.array(z.object({
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
  })).min(1, 'At least one paper is required'),
  domain: z.string().describe('Research domain or field of study'),
  timeframe: z.object({
    startYear: z.number().optional(),
    endYear: z.number().optional(),
  }).optional(),
  focusAreas: z.array(z.string()).optional(),
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

    const { papers, domain, timeframe, focusAreas } = validationResult.data;

    // Extract user context from headers
    const userId = request.headers.get('x-user-id') || undefined;
    const sessionId = request.headers.get('x-session-id') || undefined;

    // Get or create the research gap agent
    let agent = AgentRegistry.getAgent('research-gap') as ResearchGapAgent;
    if (!agent) {
      agent = new ResearchGapAgent();
      AgentRegistry.registerAgent(agent);
    }

    // Prepare agent input
    const agentInput = {
      papers,
      domain,
      timeframe,
      focusAreas
    };

    // Execute gap analysis
    const startTime = Date.now();
    const result = await agent.execute(agentInput, {
      userId,
      sessionId,
      timestamp: new Date().toISOString()
    });

    const processingTime = Date.now() - startTime;

    if (result.success && result.data) {
      return NextResponse.json({
        success: true,
        data: result.data,
        metadata: {
          ...result.metadata,
          domain,
          timeframe,
          focusAreas,
          paperCount: papers.length,
          processingTime
        }
      });
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Gap analysis failed',
          metadata: {
            ...result.metadata,
            processingTime
          }
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in research gap analysis API:', error);
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
    agent: 'research-gap-analysis',
    version: '1.0.0',
    description: 'Identifies research gaps and opportunities across collections of papers',
    endpoints: {
      POST: '/api/agents/research-gaps'
    },
    inputSchema: {
      papers: 'Array of paper objects to analyze',
      domain: 'Research domain or field of study',
      timeframe: 'Optional time range for analysis',
      focusAreas: 'Optional specific areas to focus analysis on'
    },
    outputSchema: {
      identifiedGaps: 'Array of research gaps with importance and suggestions',
      emergingOpportunities: 'Array of emerging research opportunities',
      trendAnalysis: 'Analysis of growing, declining, and stable research areas',
      recommendations: 'Specific recommendations for future research'
    }
  });
}