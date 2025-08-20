/**
 * Research Gap Agent Implementation
 * Uses LangChain to analyze collections of papers to identify research gaps,
 * emerging opportunities, and trend analysis across research domains
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { z } from 'zod';
import { BaseAgent, Paper, AgentContext, AgentResult } from './base';
import { 
  ResearchGapInput, 
  ResearchGapOutput, 
  ResearchGapInputSchema,
  ResearchGapOutputSchema 
} from './schemas';
import { getOptimalModel } from './config';
import { extractPaperContent } from './utils';

export class ResearchGapAgent extends BaseAgent<ResearchGapInput, ResearchGapOutput> {
  public name = 'research-gap';
  public version = '1.0.0';
  public description = 'Analyzes collections of research papers to identify gaps, emerging opportunities, and research trends';

  private outputParser: StructuredOutputParser<any>;
  private analysisChain: RunnableSequence;

  constructor() {
    super();

    // Create structured output parser
    this.outputParser = StructuredOutputParser.fromZodSchema(ResearchGapOutputSchema);
    
    // Create the analysis chain
    this.analysisChain = this.createAnalysisChain();
  }

  protected async executeImpl(
    input: ResearchGapInput, 
    context?: AgentContext
  ): Promise<ResearchGapOutput> {
    // Prepare paper collection analysis
    const paperSummaries = input.papers.map((paper, index) => {
      const content = extractPaperContent(paper);
      return `
Paper ${index + 1}:
Title: ${paper.title}
Authors: ${paper.authors.join(', ')}
Year: ${paper.year}
Journal: ${paper.journal}
Tags: ${paper.tags.join(', ')}
Key Content: ${content.substring(0, 500)}...
Collections: ${paper.collections.join(', ')}
      `.trim();
    }).join('\n\n---\n\n');

    // Prepare domain context
    const domainContext = input.domain || this.inferDomainFromPapers(input.papers);
    
    // Prepare timeframe analysis
    const timeframeContext = this.prepareTimeframeContext(input);
    
    // Prepare focus areas
    const focusAreasContext = (input.focusAreas || []).join(', ') || 'General research analysis';

    // Prepare analysis context
    const analysisContext = {
      papers: paperSummaries,
      domain: domainContext,
      timeframe: timeframeContext,
      focusAreas: focusAreasContext,
      paperCount: input.papers.length,
      format_instructions: this.outputParser.getFormatInstructions()
    };

    // Execute the analysis chain
    const result = await this.analysisChain.invoke(analysisContext);
    
    return result;
  }

  public validateInput(input: ResearchGapInput): { valid: boolean; errors: string[] } {
    try {
      ResearchGapInputSchema.parse(input);
      
      // Additional validation
      const errors: string[] = [];
      
      if (input.papers.length === 0) {
        errors.push('At least one paper is required for gap analysis');
      }
      
      if (input.papers.length > 50) {
        errors.push('Maximum 50 papers supported for gap analysis to ensure performance');
      }
      
      // Check if papers have sufficient content
      const papersWithContent = input.papers.filter(paper => 
        paper.notes?.trim() || paper.title?.length > 10
      );
      
      if (papersWithContent.length < input.papers.length * 0.7) {
        errors.push('At least 70% of papers should have meaningful content (title and notes/abstract)');
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
    return this.config.agents.researchGap?.maxRetries || 2;
  }

  /**
   * Create the LangChain analysis pipeline
   */
  private createAnalysisChain(): RunnableSequence {
    const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert research strategist and trend analyst specializing in identifying research gaps and emerging opportunities across academic domains. Analyze the following collection of research papers to provide comprehensive insights.

Research Domain: {domain}
Number of Papers: {paperCount}
Timeframe Context: {timeframe}
Focus Areas: {focusAreas}

Paper Collection:
{papers}

Please provide a comprehensive research gap analysis following this exact JSON structure:

{format_instructions}

Analysis Guidelines:

**1. Identified Gaps**: Look for areas where:
- Important questions remain unanswered across multiple papers
- Methodological limitations are consistently mentioned
- Data or sample size constraints are frequently cited
- Theoretical frameworks are underdeveloped
- Cross-disciplinary connections are missing
- Recent technological advances haven't been applied
- Demographic or geographic coverage is limited

**2. Emerging Opportunities**: Identify:
- Novel applications of existing methods
- Convergence points between different research streams  
- Technology-enabled research possibilities
- Interdisciplinary collaboration potential
- Policy or practical implementation needs
- Scaling opportunities for proven concepts

**3. Trend Analysis**: Examine:
- Research volume trends by topic area
- Methodological shifts over time
- Emerging terminology and concepts
- Declining research interest areas
- Stable, foundational research areas
- Geographic or institutional research patterns

**4. Strategic Recommendations**: Provide:
- Methodological innovations needed
- Application domains to explore
- Theoretical development opportunities
- Interdisciplinary collaboration suggestions
- Resource requirements and priorities

**Analysis Principles**:
- Be specific and evidence-based in identifying gaps
- Consider both incremental and transformative opportunities  
- Assess practical feasibility and impact potential
- Look for patterns across the entire paper collection
- Consider temporal evolution of research themes
- Identify underexplored intersections between topics
- Evaluate methodological maturity and advancement needs

Focus on actionable insights that would guide future research strategy and funding decisions. Prioritize gaps and opportunities based on potential impact and feasibility.
    `);

    return RunnableSequence.from([
      promptTemplate,
      this.llm,
      this.outputParser
    ]);
  }

  /**
   * Infer research domain from paper collection
   */
  private inferDomainFromPapers(papers: Paper[]): string {
    // Collect all tags and analyze for common themes
    const allTags = papers.flatMap(paper => paper.tags);
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag.toLowerCase()] = (acc[tag.toLowerCase()] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Find most common tags
    const topTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);

    // Analyze journals for domain hints
    const journals = papers.map(paper => paper.journal.toLowerCase());
    const uniqueJournals = [...new Set(journals)];
    
    // Simple domain inference based on common patterns
    const combinedText = `${topTags.join(' ')} ${uniqueJournals.join(' ')}`;
    
    if (combinedText.includes('computer') || combinedText.includes('ai') || combinedText.includes('machine learning')) {
      return 'Computer Science & AI';
    }
    if (combinedText.includes('medicine') || combinedText.includes('health') || combinedText.includes('medical')) {
      return 'Medicine & Healthcare';
    }
    if (combinedText.includes('engineering') || combinedText.includes('technical')) {
      return 'Engineering & Technology';
    }
    if (combinedText.includes('social') || combinedText.includes('psychology') || combinedText.includes('sociology')) {
      return 'Social Sciences';
    }
    if (combinedText.includes('business') || combinedText.includes('management') || combinedText.includes('economics')) {
      return 'Business & Economics';
    }
    
    return 'Interdisciplinary Research';
  }

  /**
   * Prepare timeframe context for analysis
   */
  private prepareTimeframeContext(input: ResearchGapInput): string {
    const years = input.papers.map(paper => paper.year).filter(Boolean);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    
    const inputTimeframe = input.timeframe;
    
    let context = `Paper collection spans ${minYear}-${maxYear}`;
    
    if (inputTimeframe?.startYear || inputTimeframe?.endYear) {
      context += `, focus period: ${inputTimeframe.startYear || 'earliest'} to ${inputTimeframe.endYear || 'latest'}`;
    }
    
    // Add temporal analysis hints
    const currentYear = new Date().getFullYear();
    if (maxYear >= currentYear - 2) {
      context += '. Collection includes recent research suitable for current trend analysis.';
    } else {
      context += `. Collection represents historical research (oldest: ${currentYear - maxYear} years ago).`;
    }
    
    return context;
  }

  /**
   * Analyze research gaps for a specific focus area
   */
  async analyzeSpecificDomain(
    papers: Paper[],
    domain: string,
    focusAreas: string[],
    context?: AgentContext
  ): Promise<AgentResult<ResearchGapOutput>> {
    const input: ResearchGapInput = {
      papers,
      domain,
      focusAreas,
      timeframe: {
        startYear: Math.min(...papers.map(p => p.year)),
        endYear: Math.max(...papers.map(p => p.year))
      }
    };

    return this.execute(input, context);
  }

  /**
   * Get gap analysis for papers published in specific timeframe
   */
  async analyzeTemporalGaps(
    papers: Paper[],
    startYear: number,
    endYear: number,
    context?: AgentContext
  ): Promise<AgentResult<ResearchGapOutput>> {
    // Filter papers by timeframe
    const filteredPapers = papers.filter(paper => 
      paper.year >= startYear && paper.year <= endYear
    );

    if (filteredPapers.length === 0) {
      return {
        success: false,
        error: `No papers found in the timeframe ${startYear}-${endYear}`,
        metadata: {
          agentName: this.name,
          processingTime: 0,
          model: this.config.openai.model,
          retryCount: 0
        }
      };
    }

    const input: ResearchGapInput = {
      papers: filteredPapers,
      domain: this.inferDomainFromPapers(filteredPapers),
      timeframe: { startYear, endYear }
    };

    return this.execute(input, context);
  }

  /**
   * Compare research gaps between different paper collections
   */
  async compareCollectionGaps(
    collection1: { name: string; papers: Paper[] },
    collection2: { name: string; papers: Paper[] },
    context?: AgentContext
  ): Promise<{
    collection1: AgentResult<ResearchGapOutput>;
    collection2: AgentResult<ResearchGapOutput>;
    comparison: {
      uniqueToCollection1: string[];
      uniqueToCollection2: string[];
      commonGaps: string[];
      recommendations: string[];
    }
  }> {
    // Analyze both collections
    const [result1, result2] = await Promise.all([
      this.analyzeSpecificDomain(
        collection1.papers, 
        `${collection1.name} Research Domain`,
        [],
        context
      ),
      this.analyzeSpecificDomain(
        collection2.papers,
        `${collection2.name} Research Domain`, 
        [],
        context
      )
    ]);

    // Compare results if both succeeded
    const comparison = {
      uniqueToCollection1: [] as string[],
      uniqueToCollection2: [] as string[],
      commonGaps: [] as string[],
      recommendations: [] as string[]
    };

    if (result1.success && result2.success && result1.data && result2.data) {
      const gaps1 = result1.data.identifiedGaps.map(g => g.title);
      const gaps2 = result2.data.identifiedGaps.map(g => g.title);

      comparison.uniqueToCollection1 = gaps1.filter(gap => !gaps2.includes(gap));
      comparison.uniqueToCollection2 = gaps2.filter(gap => !gaps1.includes(gap));
      comparison.commonGaps = gaps1.filter(gap => gaps2.includes(gap));
      
      comparison.recommendations = [
        `${collection1.name} has ${comparison.uniqueToCollection1.length} unique gaps`,
        `${collection2.name} has ${comparison.uniqueToCollection2.length} unique gaps`,
        `${comparison.commonGaps.length} gaps are common to both collections`,
        'Consider cross-collection collaboration for common gaps',
        'Explore unique gaps as collection-specific research opportunities'
      ];
    }

    return {
      collection1: result1,
      collection2: result2,
      comparison
    };
  }
}