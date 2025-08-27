/**
 * Base Agent Classes and Interfaces
 * Provides common functionality and structure for all PaperMind agents
 */

import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { AgentConfig, getAgentConfig } from './config';

// Paper type (matching the existing type from papers-table.tsx)
export interface Paper {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  fullText?: string;
  year: number;
  doi?: string;
  tags: string[];
  notes: string;
  dateAdded: string;
  collections: string[];
  status: "unread" | "reading" | "read" | "archived";
  url?: string;
  zoteroKey?: string;
  zoteroVersion?: number;
  itemType?: string;
  aiColumns?: Record<string, string>;
}

// Base agent result interface
export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    processingTime?: number;
    model?: string;
    retryCount?: number;
    agentName?: string;
  };
}

// Agent execution context
export interface AgentContext {
  userId?: string;
  sessionId?: string;
  preferences?: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp?: string;
}

// Base agent interface that all agents must implement
export interface IAgent<TInput, TOutput> {
  name: string;
  version: string;
  description: string;
  
  execute(input: TInput, context?: AgentContext): Promise<AgentResult<TOutput>>;
  validateInput(input: TInput): { valid: boolean; errors: string[] };
}

// Base agent metrics for monitoring
export interface AgentMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalTokensUsed: number;
  lastExecuted?: Date;
}

/**
 * Abstract base class for all PaperMind agents
 * Provides common functionality like error handling, retries, and metrics
 */
export abstract class BaseAgent<TInput, TOutput> implements IAgent<TInput, TOutput> {
  public abstract name: string;
  public abstract version: string;
  public abstract description: string;

  protected config: AgentConfig;
  protected llm: ChatOpenAI;
  protected metrics: AgentMetrics;

  constructor(config?: Partial<AgentConfig>) {
    this.config = { ...getAgentConfig(), ...config };
    this.llm = new ChatOpenAI({
      apiKey: this.config.openai.apiKey,
      model: this.config.openai.model,
      temperature: this.config.openai.temperature,
      maxTokens: this.config.openai.maxTokens,
      timeout: this.config.openai.timeout,
    });
    
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalTokensUsed: 0,
    };
  }

  /**
   * Main execution method with error handling and retry logic
   */
  public async execute(input: TInput, context?: AgentContext): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    this.metrics.totalExecutions++;

    // Validate input first
    const validation = this.validateInput(input);
    if (!validation.valid) {
      this.metrics.failedExecutions++;
      return {
        success: false,
        error: `Input validation failed: ${validation.errors.join(', ')}`,
        metadata: {
          processingTime: Date.now() - startTime,
          model: this.config.openai.model,
          retryCount: 0,
        }
      };
    }

    let lastError: Error | null = null;
    const maxRetries = this.getMaxRetries();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeImpl(input, context);
        
        // Update metrics on success
        const executionTime = Date.now() - startTime;
        this.updateMetrics(true, executionTime, 0);
        
        return {
          success: true,
          data: result,
          metadata: {
            processingTime: executionTime,
            model: this.config.openai.model,
            retryCount: attempt,
            tokensUsed: 0, // Will be calculated at API level
          }
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on validation errors or permanent failures
        if (this.isPermanentError(lastError) || attempt === maxRetries) {
          break;
        }
        
        // Wait before retry with exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    // Update metrics on failure
    const executionTime = Date.now() - startTime;
    this.updateMetrics(false, executionTime, 0);

    return {
      success: false,
      error: lastError?.message || 'Unknown error occurred',
      metadata: {
        processingTime: executionTime,
        model: this.config.openai.model,
        retryCount: maxRetries,
      }
    };
  }

  /**
   * Abstract method that subclasses must implement
   */
  protected abstract executeImpl(input: TInput, context?: AgentContext): Promise<TOutput>;

  /**
   * Abstract method for input validation
   */
  public abstract validateInput(input: TInput): { valid: boolean; errors: string[] };

  /**
   * Get max retries for this agent type
   */
  protected abstract getMaxRetries(): number;

  /**
   * Determine if an error is permanent (shouldn't retry)
   */
  protected isPermanentError(error: Error): boolean {
    const permanentErrorPatterns = [
      'Invalid API key',
      'Rate limit exceeded',
      'Model not found',
      'Input validation',
      'Insufficient quota',
    ];
    
    return permanentErrorPatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Update agent metrics
   */
  private updateMetrics(success: boolean, executionTime: number, tokensUsed: number): void {
    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }
    
    // Update average execution time
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1);
    this.metrics.averageExecutionTime = (totalTime + executionTime) / this.metrics.totalExecutions;
    
    this.metrics.totalTokensUsed += tokensUsed;
    this.metrics.lastExecuted = new Date();
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current agent metrics
   */
  public getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset agent metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalTokensUsed: 0,
    };
  }

  /**
   * Call the LLM with a simple prompt and return the response
   */
  protected async callLLM(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>;
    temperature?: number;
    max_tokens?: number;
  }): Promise<string> {
    try {
      // Convert messages to LangChain format
      const langchainMessages = params.messages.map(msg => {
        switch (msg.role) {
          case 'system':
            return ['system', msg.content] as [string, string];
          case 'user':
            return ['human', msg.content] as [string, string];
          case 'assistant':
            return ['ai', msg.content] as [string, string];
          default:
            return ['human', msg.content] as [string, string];
        }
      });

      // Create LLM with custom parameters
      const llm = new ChatOpenAI({
        apiKey: this.config.openai.apiKey,
        model: this.config.openai.model,
        temperature: params.temperature ?? this.config.openai.temperature,
        maxTokens: params.max_tokens ?? this.config.openai.maxTokens,
        timeout: this.config.openai.timeout,
      });

      const response = await llm.invoke(langchainMessages);
      return response.content as string;
    } catch (error) {
      console.error('Error calling LLM:', error);
      throw error;
    }
  }

  /**
   * Create a structured output chain with Zod validation
   */
  protected createStructuredChain<T>(schema: z.ZodSchema<T>, prompt: string) {
    // This will be implemented when we create specific agents
    // For now, this is a placeholder that shows the intended pattern
    return {
      schema,
      prompt,
      invoke: async (input: any): Promise<T> => {
        // TODO: Implement structured output with LangChain
        throw new Error('Structured chain not yet implemented');
      }
    };
  }
}

/**
 * Agent Registry for managing all available agents
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, IAgent<any, any>> = new Map();

  private constructor() {}

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  public register<TInput, TOutput>(agent: IAgent<TInput, TOutput>): void {
    const key = `${agent.name}:${agent.version}`;
    this.agents.set(key, agent);
  }

  public get<TInput, TOutput>(name: string, version?: string): IAgent<TInput, TOutput> | null {
    const key = version ? `${name}:${version}` : this.getLatestVersion(name);
    return this.agents.get(key) || null;
  }

  public list(): Array<{ name: string; version: string; description: string }> {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      version: agent.version,
      description: agent.description,
    }));
  }

  private getLatestVersion(name: string): string {
    const versions = Array.from(this.agents.keys())
      .filter(key => key.startsWith(`${name}:`))
      .map(key => key.split(':')[1])
      .sort((a, b) => b.localeCompare(a)); // Sort descending
    
    return versions.length > 0 ? `${name}:${versions[0]}` : '';
  }
}

// Export convenience function for getting agent registry
export const getAgentRegistry = () => AgentRegistry.getInstance();