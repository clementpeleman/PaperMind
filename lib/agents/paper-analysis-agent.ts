/**
 * Paper Analysis Agent Implementation
 * Uses LangChain to analyze individual research papers comprehensively
 */

import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { z } from 'zod';
import { BaseAgent, Paper, AgentContext, AgentResult } from './base';
import { 
  PaperAnalysisInput, 
  PaperAnalysisOutput, 
  PaperAnalysisInputSchema,
  PaperAnalysisOutputSchema 
} from './schemas';
import { getOptimalModel } from './config';
import { extractPaperContent, estimateTokens } from './utils';

export class PaperAnalysisAgent extends BaseAgent<PaperAnalysisInput, PaperAnalysisOutput> {
  public name = 'paper-analysis';
  public version = '1.0.0';
  public description = 'Analyzes individual research papers for key findings, methodology, limitations, and significance';

  private outputParser: StructuredOutputParser<PaperAnalysisOutput>;
  private analysisChain: RunnableSequence;

  constructor() {
    super({
      openai: {
        model: getOptimalModel('analysis'),
        temperature: 0.2, // More deterministic for analysis
      }
    });

    // Create structured output parser
    this.outputParser = StructuredOutputParser.fromZodSchema(PaperAnalysisOutputSchema);
    
    // Create the analysis chain
    this.analysisChain = this.createAnalysisChain();
  }

  protected async executeImpl(
    input: PaperAnalysisInput, 
    context?: AgentContext
  ): Promise<PaperAnalysisOutput> {
    // Extract paper content for analysis
    const paperContent = extractPaperContent(input.paper);

    // Prepare collection context
    const collectionContextText = input.collectionContext ? 
      `Collection: ${input.collectionContext.name}
      Description: ${input.collectionContext.description || 'No description available'}
      Total Papers: ${input.collectionContext.totalPapers}
      Common Tags: ${input.collectionContext.commonTags?.join(', ') || 'No tags available'}
      Research Focus: ${input.collectionContext.researchFocus || 'General research'}` :
      'No collection context provided - analyze as standalone paper';

    // Prepare analysis context
    const analysisContext = {
      content: paperContent,
      analysisType: input.analysisType,
      focusAreas: (input.focusAreas || []).join(', ') || 'General analysis',
      collectionContext: collectionContextText,
      format_instructions: this.outputParser.getFormatInstructions()
    };

    // Execute the analysis chain
    const result = await this.analysisChain.invoke(analysisContext);
    
    return result;
  }

  public validateInput(input: PaperAnalysisInput): { valid: boolean; errors: string[] } {
    try {
      PaperAnalysisInputSchema.parse(input);
      
      // Additional validation
      const errors: string[] = [];
      
      if (!input.paper.title?.trim()) {
        errors.push('Paper must have a non-empty title');
      }
      
      if (!input.paper.notes?.trim() && !input.paper.url) {
        errors.push('Paper must have either notes/abstract content or a URL');
      }
      
      if (input.paper.notes && input.paper.notes.length < 50) {
        errors.push('Paper notes/abstract should be at least 50 characters for meaningful analysis');
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          valid: false, 
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`) 
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  protected getMaxRetries(): number {
    return this.config.agents.paperAnalysis.maxRetries;
  }

  /**
   * Create the LangChain analysis pipeline
   */
  private createAnalysisChain(): RunnableSequence {
    const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert research analyst specializing in academic paper analysis. Analyze the following research paper thoroughly and provide structured insights.

Paper Information:
{content}

Analysis Type: {analysisType}
Focus Areas: {focusAreas}

Collection Context:
{collectionContext}

Please provide a comprehensive analysis following this exact JSON structure:

{format_instructions}

Analysis Guidelines:
1. **Key Findings**: Extract 3-5 most significant findings, discoveries, or results from the paper
2. **Methodology**: Describe the research approach, methods, data collection, and analysis techniques used
3. **Limitations**: Identify 2-4 specific limitations, biases, or constraints acknowledged by authors or evident in the study
4. **Future Work**: Suggest 3-5 concrete future research directions based on the paper's gaps and potential extensions
5. **Relevant Citations**: Extract key papers, theories, or frameworks this work builds upon (if mentioned)
6. **Research Gaps**: Identify specific gaps in knowledge that this paper addresses or reveals
7. **Significance**: Assess the overall contribution and impact of this work to its field
8. **Reliability**: Score from 0-10 based on methodology rigor, sample size, reproducibility, and peer review status
9. **Relevance**: Score from 0-10 how relevant this paper is to the collection's research focus. Consider thematic alignment, methodological relevance, and conceptual connections. Provide specific connection points.
10. **Tags**: Generate 5-8 relevant tags for categorization and searchability

**Collection-Aware Analysis**:
When analyzing relevance, consider how this paper fits within the broader collection theme. Look for:
- Methodological similarities with the collection focus
- Theoretical frameworks that align with the collection's research area  
- Results that contribute to or contradict the collection's main themes
- Cross-references or citations that connect to the collection's domain

Be specific, objective, and evidence-based in your analysis. Focus on actionable insights that would help researchers understand the paper's contribution and place in the literature, especially within the context of this research collection.
    `);

    return RunnableSequence.from([
      promptTemplate,
      this.llm,
      this.outputParser
    ]);
  }

  /**
   * Analyze multiple papers in batch
   */
  async analyzeBatch(
    papers: Paper[], 
    analysisType: PaperAnalysisInput['analysisType'] = 'comprehensive',
    context?: AgentContext,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Array<{ paperId: string; result: AgentResult<PaperAnalysisOutput> }>> {
    const results: Array<{ paperId: string; result: AgentResult<PaperAnalysisOutput> }> = [];
    
    // Process in batches to respect rate limits
    const batchSize = 3;
    
    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (paper) => {
        const input: PaperAnalysisInput = {
          paper,
          analysisType,
          focusAreas: paper.tags?.slice(0, 3) // Use existing tags as focus areas
        };
        
        const result = await this.execute(input, context);
        return { paperId: paper.id, result };
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Report progress
      onProgress?.(results.length, papers.length);
      
      // Rate limiting delay between batches
      if (i + batchSize < papers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Get analysis suggestions based on paper type
   */
  getSuggestedAnalysisType(paper: Paper): PaperAnalysisInput['analysisType'] {
    const content = paper.notes?.toLowerCase() || '';
    const title = paper.title?.toLowerCase() || '';
    const combined = `${title} ${content}`;

    // Simple heuristics for analysis type suggestion
    if (combined.includes('method') || combined.includes('approach') || combined.includes('technique')) {
      return 'methodology';
    }
    if (combined.includes('finding') || combined.includes('result') || combined.includes('conclusion')) {
      return 'findings';
    }
    if (combined.includes('limitation') || combined.includes('constraint') || combined.includes('bias')) {
      return 'limitations';
    }
    if (combined.includes('future') || combined.includes('direction') || combined.includes('recommendation')) {
      return 'future_work';
    }
    
    return 'comprehensive';
  }

  /**
   * Extract specific insights for smart columns
   */
  async extractColumnInsight(
    paper: Paper, 
    columnType: 'methodology' | 'limitations' | 'findings' | 'future_work' | 'significance',
    context?: AgentContext
  ): Promise<AgentResult<string>> {
    const input: PaperAnalysisInput = {
      paper,
      analysisType: columnType === 'significance' ? 'comprehensive' : columnType,
      focusAreas: [columnType]
    };

    const analysis = await this.execute(input, context);
    
    if (!analysis.success || !analysis.data) {
      return {
        success: false,
        error: analysis.error || 'Analysis failed',
        metadata: analysis.metadata
      };
    }

    // Extract relevant section based on column type
    let content = '';
    switch (columnType) {
      case 'methodology':
        content = analysis.data.methodology;
        break;
      case 'limitations':
        content = analysis.data.limitations.join('; ');
        break;
      case 'findings':
        content = analysis.data.keyFindings.join('; ');
        break;
      case 'future_work':
        content = analysis.data.futureWork.join('; ');
        break;
      case 'significance':
        content = analysis.data.significance;
        break;
    }

    return {
      success: true,
      data: content,
      metadata: analysis.metadata
    };
  }
}