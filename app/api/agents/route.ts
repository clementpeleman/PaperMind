/**
 * Agent Registry API Endpoint
 * Lists all available agents and their capabilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentEnvironment } from '@/lib/agents/config';

export async function GET() {
  try {
    // Validate environment
    const envValidation = validateAgentEnvironment();
    
    const agents = [
      {
        name: 'paper-analysis',
        version: '1.0.0',
        description: 'Analyzes individual research papers for key findings, methodology, limitations, and significance',
        endpoint: '/api/agents/analyze-paper',
        status: envValidation.valid ? 'available' : 'unavailable',
        capabilities: [
          'Key findings extraction',
          'Methodology analysis',
          'Limitation identification',
          'Future work suggestions',
          'Research gap identification',
          'Significance assessment',
          'Reliability scoring'
        ],
        inputTypes: ['single-paper'],
        outputTypes: ['structured-analysis']
      },
      {
        name: 'research-gap-analysis',
        version: '1.0.0',
        description: 'Identifies research gaps and opportunities across collections of papers',
        endpoint: '/api/agents/research-gaps',
        status: envValidation.valid ? 'available' : 'unavailable',
        capabilities: [
          'Gap identification',
          'Opportunity analysis',
          'Trend analysis',
          'Research recommendations',
          'Domain expertise mapping'
        ],
        inputTypes: ['paper-collection', 'domain-specification'],
        outputTypes: ['gap-analysis', 'recommendations']
      },
      {
        name: 'smart-column',
        version: '1.0.0', 
        description: 'Generates intelligent column content using specialized sub-agents',
        endpoint: '/api/agents/smart-column',
        status: envValidation.valid ? 'available' : 'unavailable',
        capabilities: [
          'Methodology extraction',
          'Limitation analysis', 
          'Key findings summarization',
          'Future work identification',
          'Significance assessment',
          'Custom analysis'
        ],
        inputTypes: ['single-paper', 'column-specification'],
        outputTypes: ['formatted-content', 'tagged-analysis']
      },
      {
        name: 'literature-review',
        version: '1.0.0',
        description: 'Generates comprehensive literature reviews from paper collections',
        endpoint: '/api/agents/literature-review',
        status: 'planned',
        capabilities: [
          'Systematic review generation',
          'Theme identification',
          'Methodological comparison',
          'Citation formatting',
          'Gap synthesis'
        ],
        inputTypes: ['paper-collection', 'research-question'],
        outputTypes: ['formatted-review', 'citation-list']
      },
      {
        name: 'research-assistant',
        version: '1.0.0',
        description: 'Interactive chat interface with multi-agent orchestration',
        endpoint: '/api/agents/chat',
        status: 'planned',
        capabilities: [
          'Natural language queries',
          'Paper search and retrieval',
          'Comparative analysis',
          'Research question generation',
          'Multi-agent coordination'
        ],
        inputTypes: ['natural-language', 'paper-context'],
        outputTypes: ['conversational', 'actionable-insights']
      }
    ];

    return NextResponse.json({
      success: true,
      environment: {
        configured: envValidation.valid,
        errors: envValidation.errors
      },
      agents,
      statistics: {
        total: agents.length,
        available: agents.filter(a => a.status === 'available').length,
        planned: agents.filter(a => a.status === 'planned').length,
        unavailable: agents.filter(a => a.status === 'unavailable').length
      },
      capabilities: {
        paperAnalysis: ['methodology', 'limitations', 'findings', 'future_work', 'significance'],
        outputFormats: ['paragraph', 'bullet_points', 'keywords', 'score'],
        inputTypes: ['single-paper', 'paper-collection', 'natural-language'],
        processingModes: ['synchronous', 'batch']
      }
    });

  } catch (error) {
    console.error('Error in agents registry API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check for agent system
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'health-check') {
      const envValidation = validateAgentEnvironment();
      
      return NextResponse.json({
        success: true,
        status: envValidation.valid ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: {
          openaiConfigured: !!process.env.OPENAI_API_KEY,
          supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
        },
        errors: envValidation.errors
      });
    }

    return NextResponse.json(
      { error: 'Unknown action. Supported actions: health-check' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in agents health check:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}