/**
 * Agent Utilities
 * Helper functions for agent operations and integrations
 */

import { AgentResult, AgentContext } from './base';
import { validateAgentEnvironment } from './config';

/**
 * Agent execution wrapper with error handling and metrics
 */
export async function executeAgent<TInput, TOutput>(
  agentName: string,
  endpoint: string, 
  input: TInput,
  context?: AgentContext
): Promise<AgentResult<TOutput>> {
  const startTime = Date.now();
  
  try {
    // Validate environment first
    const envValidation = validateAgentEnvironment();
    if (!envValidation.valid) {
      return {
        success: false,
        error: `Agent environment not configured: ${envValidation.errors.join(', ')}`,
        metadata: {
          processingTime: Date.now() - startTime,
          retryCount: 0,
        }
      };
    }

    // Prepare request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add user context if available
    if (context?.userId) {
      headers['x-user-id'] = context.userId;
    }
    if (context?.sessionId) {
      headers['x-session-id'] = context.sessionId;
    }

    // Make API request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...input,
        context
      }),
    });

    const processingTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Agent request failed with status ${response.status}`,
        metadata: {
          processingTime,
          retryCount: 0,
        }
      };
    }

    const result = await response.json();
    
    return {
      success: true,
      data: result.data,
      metadata: {
        ...result.metadata,
        processingTime,
        agentName,
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      metadata: {
        processingTime: Date.now() - startTime,
        retryCount: 0,
        agentName,
      }
    };
  }
}

/**
 * Batch process multiple papers through an agent
 */
export async function batchProcess<TInput extends { paper: any }, TOutput>(
  agentEndpoint: string,
  papers: any[],
  getInputForPaper: (paper: any) => Omit<TInput, 'paper'>,
  context?: AgentContext,
  options?: {
    batchSize?: number;
    delayBetweenBatches?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<Array<{ paperId: string; result: AgentResult<TOutput> }>> {
  const batchSize = options?.batchSize || 3;
  const delay = options?.delayBetweenBatches || 1000;
  const results: Array<{ paperId: string; result: AgentResult<TOutput> }> = [];

  for (let i = 0; i < papers.length; i += batchSize) {
    const batch = papers.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (paper) => {
      const input = {
        paper,
        ...getInputForPaper(paper)
      } as TInput;

      const result = await executeAgent<TInput, TOutput>(
        'batch-agent',
        agentEndpoint,
        input,
        context
      );

      return { paperId: paper.id, result };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Report progress
    options?.onProgress?.(results.length, papers.length);

    // Delay between batches to respect rate limits
    if (i + batchSize < papers.length && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return results;
}

/**
 * Format paper data for agent consumption
 */
export function formatPaperForAgent(paper: any) {
  return {
    id: paper.id,
    title: paper.title || '',
    authors: paper.authors || [],
    journal: paper.journal || '',
    year: paper.year || new Date().getFullYear(),
    doi: paper.doi,
    tags: paper.tags || [],
    notes: paper.notes || '',
    dateAdded: paper.dateAdded || new Date().toISOString(),
    collections: paper.collections || [],
    status: paper.status || 'unread',
    url: paper.url,
    zoteroKey: paper.zoteroKey,
    zoteroVersion: paper.zoteroVersion,
    itemType: paper.itemType,
    aiColumns: paper.aiColumns,
  };
}

/**
 * Extract text content from paper for analysis
 */
export function extractPaperContent(paper: any): string {
  const parts: string[] = [];
  
  if (paper.title) {
    parts.push(`Title: ${paper.title}`);
  }
  
  if (paper.authors?.length) {
    parts.push(`Authors: ${paper.authors.join(', ')}`);
  }
  
  if (paper.journal) {
    parts.push(`Journal: ${paper.journal}`);
  }
  
  if (paper.year) {
    parts.push(`Year: ${paper.year}`);
  }
  
  if (paper.notes) {
    parts.push(`Abstract/Notes: ${paper.notes}`);
  }
  
  if (paper.tags?.length) {
    parts.push(`Tags: ${paper.tags.join(', ')}`);
  }

  return parts.join('\n\n');
}

/**
 * Create agent context from user session
 */
export function createAgentContext(
  userId?: string,
  sessionId?: string,
  preferences?: any
): AgentContext {
  return {
    userId,
    sessionId: sessionId || `session_${Date.now()}`,
    preferences: preferences || {},
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'papermind-ui'
    }
  };
}

/**
 * Validate agent result and provide user-friendly error messages
 */
export function validateAgentResult<T>(result: AgentResult<T>): {
  valid: boolean;
  data?: T;
  userMessage: string;
  techMessage?: string;
} {
  if (result.success && result.data) {
    return {
      valid: true,
      data: result.data,
      userMessage: 'Analysis completed successfully'
    };
  }

  // Map technical errors to user-friendly messages
  let userMessage = 'Analysis failed. Please try again.';
  
  if (result.error) {
    if (result.error.includes('Rate limit')) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (result.error.includes('API key')) {
      userMessage = 'Service configuration error. Please contact support.';
    } else if (result.error.includes('timeout')) {
      userMessage = 'Analysis took too long. Please try with a shorter text.';
    } else if (result.error.includes('validation')) {
      userMessage = 'Invalid input data. Please check your paper information.';
    }
  }

  return {
    valid: false,
    userMessage,
    techMessage: result.error
  };
}

/**
 * Calculate token usage estimate for text
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Format processing time for display
 */
export function formatProcessingTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = Math.round(milliseconds / 100) / 10;
  return `${seconds}s`;
}

/**
 * Agent performance metrics aggregation
 */
export function aggregateAgentMetrics(results: AgentResult<any>[]): {
  totalExecutions: number;
  successRate: number;
  averageProcessingTime: number;
  totalTokensUsed: number;
  errorsByType: Record<string, number>;
} {
  const total = results.length;
  const successful = results.filter(r => r.success).length;
  const totalTime = results.reduce((sum, r) => sum + (r.metadata?.processingTime || 0), 0);
  const totalTokens = results.reduce((sum, r) => sum + (r.metadata?.tokensUsed || 0), 0);
  
  const errorsByType: Record<string, number> = {};
  results.filter(r => !r.success).forEach(r => {
    if (r.error) {
      const errorType = r.error.split(':')[0] || 'Unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    }
  });

  return {
    totalExecutions: total,
    successRate: total > 0 ? successful / total : 0,
    averageProcessingTime: total > 0 ? totalTime / total : 0,
    totalTokensUsed: totalTokens,
    errorsByType
  };
}