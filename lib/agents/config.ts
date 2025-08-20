/**
 * Agent Configuration
 * Centralized configuration for all LangChain agents in PaperMind
 */

export interface AgentConfig {
  // OpenAI Configuration
  openai: {
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
  };
  
  // Agent Behavior Configuration
  agents: {
    paperAnalysis: {
      temperature: number;
      maxRetries: number;
      timeout: number;
    };
    researchGap: {
      temperature: number;
      maxRetries: number;
      timeout: number;
    };
    literatureReview: {
      temperature: number;
      maxRetries: number;
      timeout: number;
    };
    smartColumn: {
      temperature: number;
      maxRetries: number;
      timeout: number;
    };
  };
  
  // Vector Database Configuration (for future RAG implementation)
  vectorDb: {
    provider: 'supabase' | 'pinecone';
    dimensions: number;
    similarity: 'cosine' | 'euclidean' | 'dot_product';
  };
  
  // Memory Configuration
  memory: {
    maxMessages: number;
    ttl: number; // Time to live in milliseconds
  };
}

export const getAgentConfig = (): AgentConfig => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for agent functionality');
  }
  
  return {
    openai: {
      apiKey: openaiApiKey,
      model: process.env.AGENT_MODEL || 'gpt-4o-mini', // Cost-effective for most tasks
      temperature: parseFloat(process.env.AGENT_TEMPERATURE || '0.3'),
      maxTokens: parseInt(process.env.AGENT_MAX_TOKENS || '2000'),
      timeout: parseInt(process.env.AGENT_TIMEOUT || '30000'), // 30 seconds
    },
    
    agents: {
      paperAnalysis: {
        temperature: 0.2, // More deterministic for analysis
        maxRetries: 3,
        timeout: 45000, // 45 seconds for complex analysis
      },
      researchGap: {
        temperature: 0.4, // Slightly more creative for identifying gaps
        maxRetries: 3,
        timeout: 60000, // 60 seconds for comprehensive gap analysis
      },
      literatureReview: {
        temperature: 0.3, // Balanced for comprehensive reviews
        maxRetries: 2,
        timeout: 90000, // 90 seconds for detailed reviews
      },
      smartColumn: {
        temperature: 0.1, // Very deterministic for consistent columns
        maxRetries: 3,
        timeout: 30000, // 30 seconds for quick column generation
      },
    },
    
    vectorDb: {
      provider: 'supabase', // Using existing Supabase infrastructure
      dimensions: 1536, // OpenAI text-embedding-ada-002 dimensions
      similarity: 'cosine',
    },
    
    memory: {
      maxMessages: 50, // Keep last 50 messages in memory
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    },
  };
};

// Environment validation
export const validateAgentEnvironment = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required for agent functionality');
  }
  
  // Check if OpenAI API key has the correct format
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && !apiKey.startsWith('sk-')) {
    errors.push('OPENAI_API_KEY appears to be invalid (should start with "sk-")');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Agent Model Selection Helper
export const getOptimalModel = (taskType: 'analysis' | 'creative' | 'reasoning' | 'classification'): string => {
  switch (taskType) {
    case 'analysis':
      return 'gpt-4o-mini'; // Good balance of cost and capability for analysis
    case 'creative':
      return 'gpt-4o'; // More capable for creative tasks
    case 'reasoning':
      return 'gpt-4o'; // Best reasoning capabilities
    case 'classification':
      return 'gpt-4o-mini'; // Sufficient for classification tasks
    default:
      return 'gpt-4o-mini';
  }
};