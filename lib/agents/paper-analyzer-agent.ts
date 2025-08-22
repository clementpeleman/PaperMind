import { BaseAgent } from './base';

interface PaperChunk {
  id: string;
  content: string;
  section: string;
  pageNumber?: number;
  embedding?: number[];
  metadata: {
    sectionType: 'abstract' | 'introduction' | 'methodology' | 'results' | 'discussion' | 'conclusion' | 'references' | 'other';
    wordCount: number;
    hasEquations: boolean;
    hasTables: boolean;
    hasFigures: boolean;
  };
}

interface PaperDocument {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  fullText: string;
  chunks: PaperChunk[];
  processingStatus: 'pending' | 'chunked' | 'embedded' | 'analyzed';
}

interface AnalysisCard {
  id: string;
  title: string;
  prompt: string;
  targetSections: string[]; // Which sections to retrieve for this analysis
  maxChunks: number; // How many chunks to use
  result?: string;
  confidence?: number;
}

export class PaperAnalyzerAgent extends BaseAgent<PaperDocument, { [cardId: string]: string }> {
  public name = 'paper-analyzer';
  public version = '1.0.0';
  public description = 'Comprehensive paper analysis using embeddings and semantic search';

  private embeddingModel = "text-embedding-3-small"; // OpenAI embedding model
  private chunkSize = 1000; // Words per chunk
  private chunkOverlap = 200; // Word overlap between chunks

  protected async executeImpl(paper: PaperDocument): Promise<{ [cardId: string]: string }> {
    return this.analyzePaper(paper, DEFAULT_ANALYSIS_CARDS);
  }

  public validateInput(paper: PaperDocument): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!paper.title?.trim()) {
      errors.push('Paper must have a title');
    }
    
    if (!paper.fullText?.trim()) {
      errors.push('Paper must have full text content');
    }
    
    return { valid: errors.length === 0, errors };
  }

  protected getMaxRetries(): number {
    return 2;
  }

  /**
   * Main method: Analyze a paper with selected analysis cards
   */
  async analyzePaper(
    paper: PaperDocument, 
    analysisCards: AnalysisCard[]
  ): Promise<{ [cardId: string]: string }> {
    console.log(`🔬 Starting comprehensive analysis for: ${paper.title}`);
    
    // Step 1: Ensure paper is chunked and embedded
    await this.preparePaperForAnalysis(paper);
    
    // Step 2: Run analysis for each active card
    const results: { [cardId: string]: string } = {};
    
    for (const card of analysisCards) {
      console.log(`📊 Analyzing: ${card.title}`);
      try {
        results[card.id] = await this.runCardAnalysis(paper, card);
      } catch (error) {
        console.error(`Error analyzing ${card.title}:`, error);
        results[card.id] = `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
    
    return results;
  }

  /**
   * Prepare paper: chunk text and generate embeddings
   */
  private async preparePaperForAnalysis(paper: PaperDocument): Promise<void> {
    if (paper.processingStatus === 'analyzed') return;
    
    // Step 1: Chunk the paper if not already done
    if (paper.processingStatus === 'pending') {
      paper.chunks = await this.chunkPaper(paper);
      paper.processingStatus = 'chunked';
    }
    
    // Step 2: Generate embeddings if not already done
    if (paper.processingStatus === 'chunked') {
      await this.generateEmbeddings(paper.chunks);
      paper.processingStatus = 'embedded';
    }
  }

  /**
   * Chunk paper into semantic sections with metadata
   */
  private async chunkPaper(paper: PaperDocument): Promise<PaperChunk[]> {
    const chunks: PaperChunk[] = [];
    const text = paper.fullText;
    
    // First, try to identify major sections
    const sections = this.identifySections(text);
    
    let chunkId = 0;
    for (const section of sections) {
      const sectionChunks = this.createChunksFromSection(section, chunkId);
      chunks.push(...sectionChunks);
      chunkId += sectionChunks.length;
    }
    
    console.log(`📄 Created ${chunks.length} chunks for paper: ${paper.title}`);
    return chunks;
  }

  /**
   * Identify major sections in the paper using heuristics and patterns
   */
  private identifySections(text: string) {
    const sections: Array<{content: string, type: PaperChunk['metadata']['sectionType'], title?: string}> = [];
    
    // Common section patterns in research papers
    const sectionPatterns = [
      { pattern: /\b(?:abstract|summary)\b/i, type: 'abstract' as const },
      { pattern: /\b(?:introduction|background)\b/i, type: 'introduction' as const },
      { pattern: /\b(?:method(?:ology)?|approach|experimental setup|materials and methods)\b/i, type: 'methodology' as const },
      { pattern: /\b(?:results?|findings|analysis|experiments?)\b/i, type: 'results' as const },
      { pattern: /\b(?:discussion|interpretation|implications)\b/i, type: 'discussion' as const },
      { pattern: /\b(?:conclusion|summary|future work)\b/i, type: 'conclusion' as const },
      { pattern: /\b(?:references?|bibliography|citations?)\b/i, type: 'references' as const }
    ];

    // Split by common section headers (1., 2., I., II., etc.)
    const sectionSplits = text.split(/\n(?=\s*(?:\d+\.|\b[IVX]+\.|\b[A-Z][A-Z\s]{1,50}(?:\n|$)))/);
    
    for (const split of sectionSplits) {
      if (split.trim().length < 100) continue; // Skip very short sections
      
      let sectionType: PaperChunk['metadata']['sectionType'] = 'other';
      
      // Determine section type based on content
      for (const {pattern, type} of sectionPatterns) {
        if (pattern.test(split.substring(0, 200))) { // Check first 200 chars
          sectionType = type;
          break;
        }
      }
      
      sections.push({
        content: split.trim(),
        type: sectionType
      });
    }
    
    return sections;
  }

  /**
   * Create chunks from a section with proper overlap
   */
  private createChunksFromSection(
    section: {content: string, type: PaperChunk['metadata']['sectionType']}, 
    startId: number
  ): PaperChunk[] {
    const chunks: PaperChunk[] = [];
    const words = section.content.split(/\s+/);
    
    for (let i = 0; i < words.length; i += this.chunkSize - this.chunkOverlap) {
      const chunkWords = words.slice(i, i + this.chunkSize);
      const chunkContent = chunkWords.join(' ');
      
      chunks.push({
        id: `chunk_${startId + chunks.length}`,
        content: chunkContent,
        section: section.type,
        metadata: {
          sectionType: section.type,
          wordCount: chunkWords.length,
          hasEquations: /\$[^$]+\$|\\\([^)]+\\\)|\\\[[^\]]+\\\]/.test(chunkContent),
          hasTables: /table \d+|tabular|thead|tbody/i.test(chunkContent),
          hasFigures: /figure \d+|fig\. \d+|image|chart/i.test(chunkContent)
        }
      });
    }
    
    return chunks;
  }

  /**
   * Generate embeddings for all chunks
   */
  private async generateEmbeddings(chunks: PaperChunk[]): Promise<void> {
    console.log(`🧮 Generating embeddings for ${chunks.length} chunks...`);
    
    const batchSize = 100; // Process in batches to avoid rate limits
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(chunk => chunk.content);
      
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.embeddingModel,
            input: texts
          })
        });
        
        const data = await response.json();
        
        batch.forEach((chunk, index) => {
          chunk.embedding = data.data[index].embedding;
        });
        
        console.log(`✅ Embedded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
        
      } catch (error) {
        console.error('Error generating embeddings:', error);
        throw error;
      }
    }
  }

  /**
   * Run analysis for a specific card using relevant paper chunks
   */
  private async runCardAnalysis(paper: PaperDocument, card: AnalysisCard): Promise<string> {
    // Step 1: Retrieve relevant chunks for this analysis
    const relevantChunks = await this.retrieveRelevantChunks(
      paper.chunks, 
      card.prompt, 
      card.targetSections,
      card.maxChunks
    );
    
    // Step 2: Prepare context from chunks
    const context = this.prepareAnalysisContext(relevantChunks, paper);
    
    // Step 3: Run the analysis with focused context
    const analysisPrompt = this.buildAnalysisPrompt(card, context, paper);
    
    const result = await this.callLLM({
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 200
    });
    
    return result;
  }

  /**
   * Retrieve most relevant chunks for the analysis using similarity search
   */
  private async retrieveRelevantChunks(
    chunks: PaperChunk[], 
    query: string,
    targetSections: string[],
    maxChunks: number
  ): Promise<PaperChunk[]> {
    
    // First, filter by section type if specified
    let candidateChunks = chunks;
    if (targetSections.length > 0) {
      candidateChunks = chunks.filter(chunk => 
        targetSections.includes(chunk.metadata.sectionType)
      );
    }
    
    if (candidateChunks.length === 0) {
      candidateChunks = chunks; // Fallback to all chunks
    }
    
    // Generate embedding for the query
    const queryEmbedding = await this.generateQueryEmbedding(query);
    
    // Calculate similarities
    const similarities = candidateChunks.map(chunk => ({
      chunk,
      similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding!)
    }));
    
    // Sort by similarity and return top chunks
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities.slice(0, maxChunks).map(item => item.chunk);
  }

  /**
   * Generate embedding for analysis query
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: query
      })
    });
    
    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Prepare focused context from relevant chunks
   */
  private prepareAnalysisContext(chunks: PaperChunk[], paper: PaperDocument): string {
    let context = `Research Paper Content:\n\n`;
    
    chunks.forEach((chunk, index) => {
      context += `--- Section ${index + 1} (${chunk.metadata.sectionType}) ---\n`;
      context += chunk.content;
      context += '\n\n';
    });
    
    return context;
  }

  /**
   * Build the final analysis prompt with context
   */
  private buildAnalysisPrompt(card: AnalysisCard, context: string, paper: PaperDocument): string {
    return `Analyze this research paper content and provide a brief, focused response.

${context}

Question: ${card.prompt}

Instructions:
- Keep response under 150 words
- Focus only on key insights, don't repeat title/authors
- Be direct and specific
- Use bullet points if helpful
- Skip generic statements

Response:`;
  }
}

// Predefined analysis cards with their retrieval strategies
export const DEFAULT_ANALYSIS_CARDS: AnalysisCard[] = [
  {
    id: 'overview',
    title: 'Research Overview',
    prompt: 'What are the main objectives and key contributions? Why is this research significant?',
    targetSections: ['abstract', 'introduction'],
    maxChunks: 5
  },
  {
    id: 'methodology',
    title: 'Methodology & Approach',
    prompt: 'What methods were used? Include study design, sample size, and key procedures.',
    targetSections: ['methodology'],
    maxChunks: 8
  },
  {
    id: 'findings',
    title: 'Key Findings & Results',
    prompt: 'What are the most important results and discoveries? Include key statistics if relevant.',
    targetSections: ['results', 'discussion'],
    maxChunks: 6
  },
  {
    id: 'assessment',
    title: 'Critical Assessment',
    prompt: 'What are the main strengths and limitations? Rate overall quality (1-10) with brief justification.',
    targetSections: ['methodology', 'discussion', 'conclusion'],
    maxChunks: 7
  },
  {
    id: 'impact',
    title: 'Impact & Applications',
    prompt: 'What practical applications and future research directions does this enable?',
    targetSections: ['discussion', 'conclusion'],
    maxChunks: 5
  },
  {
    id: 'personal',
    title: 'Research Connections',
    prompt: 'How does this connect to other research areas? What broader trends does it relate to?',
    targetSections: ['introduction', 'discussion', 'references'],
    maxChunks: 4
  }
];