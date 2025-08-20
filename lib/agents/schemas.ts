/**
 * Zod Schemas for Agent Inputs and Outputs
 * Provides type-safe validation for all agent interactions
 */

import { z } from 'zod';

// Base Paper Schema
export const PaperSchema = z.object({
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
});

export type PaperType = z.infer<typeof PaperSchema>;

// Collection Context Schema
export const CollectionContextSchema = z.object({
  name: z.string().describe('Name of the collection'),
  description: z.string().optional().describe('Description of the collection topic/theme'),
  totalPapers: z.number().describe('Total number of papers in collection'),
  commonTags: z.array(z.string()).optional().describe('Most common tags in the collection'),
  researchFocus: z.string().optional().describe('Primary research focus of the collection'),
});

export type CollectionContext = z.infer<typeof CollectionContextSchema>;

// Paper Analysis Agent Schemas
export const PaperAnalysisInputSchema = z.object({
  paper: PaperSchema,
  analysisType: z.enum(['comprehensive', 'methodology', 'limitations', 'findings', 'future_work']).default('comprehensive'),
  focusAreas: z.array(z.string()).optional().describe('Specific areas to focus the analysis on'),
  collectionContext: CollectionContextSchema.optional().describe('Context of the collection this paper belongs to'),
});

export const PaperAnalysisOutputSchema = z.object({
  keyFindings: z.array(z.string()).describe('Main findings and conclusions from the paper'),
  methodology: z.string().describe('Research methodology and approach used'),
  limitations: z.array(z.string()).describe('Study limitations and potential biases'),
  futureWork: z.array(z.string()).describe('Suggested future research directions'),
  relevantCitations: z.array(z.string()).describe('Key papers and works this research builds upon'),
  researchGaps: z.array(z.string()).describe('Identified gaps in current research'),
  significance: z.string().describe('Overall significance and contribution of the work'),
  reliability: z.object({
    score: z.number().min(0).max(10).describe('Reliability score from 0-10'),
    reasoning: z.string().describe('Explanation of the reliability assessment'),
  }),
  relevance: z.object({
    score: z.number().min(0).max(10).describe('Relevance score to collection topic from 0-10'),
    reasoning: z.string().describe('Explanation of relevance to the collection theme'),
    connectionPoints: z.array(z.string()).describe('Specific points connecting paper to collection focus'),
  }),
  tags: z.array(z.string()).describe('Automatically generated tags based on content'),
});

export type PaperAnalysisInput = z.infer<typeof PaperAnalysisInputSchema>;
export type PaperAnalysisOutput = z.infer<typeof PaperAnalysisOutputSchema>;

// Research Gap Agent Schemas  
export const ResearchGapInputSchema = z.object({
  papers: z.array(PaperSchema).min(1, 'At least one paper is required'),
  domain: z.string().describe('Research domain or field of study'),
  timeframe: z.object({
    startYear: z.number().optional(),
    endYear: z.number().optional(),
  }).optional(),
  focusAreas: z.array(z.string()).optional().describe('Specific research areas to focus on'),
});

export const ResearchGapOutputSchema = z.object({
  identifiedGaps: z.array(z.object({
    title: z.string().describe('Gap title/summary'),
    description: z.string().describe('Detailed description of the research gap'),
    importance: z.enum(['high', 'medium', 'low']).describe('Importance level of addressing this gap'),
    relatedPapers: z.array(z.string()).describe('Paper IDs that relate to this gap'),
    suggestedApproaches: z.array(z.string()).describe('Potential research approaches to address the gap'),
  })),
  emergingOpportunities: z.array(z.object({
    area: z.string().describe('Emerging research area'),
    description: z.string().describe('Description of the opportunity'),
    potentialImpact: z.enum(['transformative', 'significant', 'incremental']),
    timeToMarket: z.enum(['short', 'medium', 'long']).describe('Expected time for research to mature'),
  })),
  trendAnalysis: z.object({
    growingAreas: z.array(z.string()).describe('Research areas showing growth'),
    decliningAreas: z.array(z.string()).describe('Research areas showing decline'),
    stableAreas: z.array(z.string()).describe('Research areas with consistent activity'),
    emergingKeywords: z.array(z.string()).describe('New keywords/terms appearing in recent research'),
  }),
  recommendations: z.array(z.object({
    type: z.enum(['methodology', 'application', 'theory', 'interdisciplinary']),
    title: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    requiredResources: z.array(z.string()).describe('Resources needed to pursue this recommendation'),
  })),
});

export type ResearchGapInput = z.infer<typeof ResearchGapInputSchema>;
export type ResearchGapOutput = z.infer<typeof ResearchGapOutputSchema>;

// Literature Review Agent Schemas
export const LiteratureReviewInputSchema = z.object({
  papers: z.array(PaperSchema).min(1, 'At least one paper is required'),
  researchQuestion: z.string().describe('The research question to address'),
  reviewType: z.enum(['systematic', 'narrative', 'scoping', 'meta_analysis']).default('narrative'),
  includeSections: z.array(z.enum(['introduction', 'methodology', 'findings', 'discussion', 'conclusion', 'future_work'])).default(['introduction', 'findings', 'discussion', 'conclusion']),
  citationStyle: z.enum(['apa', 'mla', 'chicago', 'harvard']).default('apa'),
  maxLength: z.number().default(5000).describe('Maximum word count for the review'),
});

export const LiteratureReviewOutputSchema = z.object({
  title: z.string().describe('Generated title for the literature review'),
  sections: z.record(z.string()).describe('Review sections with their content'),
  keyThemes: z.array(z.object({
    theme: z.string(),
    description: z.string(),
    supportingPapers: z.array(z.string()).describe('Paper IDs supporting this theme'),
  })),
  methodologicalApproaches: z.array(z.object({
    approach: z.string(),
    description: z.string(),
    frequency: z.number().describe('Number of papers using this approach'),
    papers: z.array(z.string()).describe('Paper IDs using this approach'),
  })),
  gaps: z.array(z.string()).describe('Research gaps identified in the literature'),
  futureDirections: z.array(z.string()).describe('Suggested future research directions'),
  wordCount: z.number().describe('Actual word count of the generated review'),
  citations: z.array(z.object({
    paperId: z.string(),
    citation: z.string(),
  })),
});

export type LiteratureReviewInput = z.infer<typeof LiteratureReviewInputSchema>;
export type LiteratureReviewOutput = z.infer<typeof LiteratureReviewOutputSchema>;

// Smart Column Agent Schemas
export const SmartColumnInputSchema = z.object({
  paper: PaperSchema,
  columnType: z.enum(['methodology', 'limitations', 'findings', 'future_work', 'significance', 'custom']),
  customPrompt: z.string().optional().describe('Custom prompt for analysis if columnType is custom'),
  outputFormat: z.enum(['paragraph', 'bullet_points', 'keywords', 'score']).default('paragraph'),
  maxLength: z.number().default(500).describe('Maximum character count for output'),
});

export const SmartColumnOutputSchema = z.object({
  content: z.string().describe('Generated content for the column'),
  confidence: z.number().min(0).max(1).describe('Confidence score for the generated content'),
  sources: z.array(z.string()).describe('Specific parts of the paper that informed this analysis'),
  tags: z.array(z.string()).describe('Relevant tags for the generated content'),
});

export type SmartColumnInput = z.infer<typeof SmartColumnInputSchema>;
export type SmartColumnOutput = z.infer<typeof SmartColumnOutputSchema>;

// Research Assistant Chat Schemas
export const ChatInputSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  papers: z.array(PaperSchema).optional().describe('Papers available for analysis'),
  sessionId: z.string().optional().describe('Chat session ID for context'),
  userId: z.string().optional().describe('User ID for personalization'),
});

export const ChatOutputSchema = z.object({
  response: z.string().describe('Assistant response'),
  suggestedFollowUps: z.array(z.string()).describe('Suggested follow-up questions'),
  citedPapers: z.array(z.string()).describe('Paper IDs referenced in the response'),
  actionItems: z.array(z.object({
    type: z.enum(['search', 'analyze', 'compare', 'generate']),
    description: z.string(),
    papersInvolved: z.array(z.string()).optional(),
  })).optional(),
});

export type ChatInput = z.infer<typeof ChatInputSchema>;
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

// Agent Error Schema
export const AgentErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  retryable: z.boolean(),
  timestamp: z.string(),
});

export type AgentError = z.infer<typeof AgentErrorSchema>;

// Agent Metadata Schema
export const AgentMetadataSchema = z.object({
  agentName: z.string(),
  agentVersion: z.string(),
  executionTime: z.number(),
  tokensUsed: z.number().optional(),
  model: z.string(),
  temperature: z.number(),
  retryCount: z.number(),
  timestamp: z.string(),
});

export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

// Validation helper functions
export const validatePaper = (paper: unknown): { valid: boolean; errors: string[] } => {
  try {
    PaperSchema.parse(paper);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        valid: false, 
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`) 
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
};

export const validatePaperArray = (papers: unknown): { valid: boolean; errors: string[] } => {
  if (!Array.isArray(papers)) {
    return { valid: false, errors: ['Input must be an array'] };
  }
  
  const errors: string[] = [];
  papers.forEach((paper, index) => {
    const validation = validatePaper(paper);
    if (!validation.valid) {
      errors.push(...validation.errors.map(e => `Paper ${index}: ${e}`));
    }
  });
  
  return { valid: errors.length === 0, errors };
};