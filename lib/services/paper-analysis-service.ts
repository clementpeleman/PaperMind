import { AnalysisType, PaperAnalysisInsert } from '@/lib/database.types';

export interface SaveAnalysisRequest {
  paperId: string;
  analysisType: AnalysisType;
  analysisTitle: string;
  content: string;
  promptUsed?: string;
  confidenceScore?: number;
  processingTimeMs?: number;
  chunksUsed?: number;
  modelUsed?: string;
}

export interface AnalysisResult {
  id: string;
  content: string;
  confidenceScore: number | null;
  generatedAt: string;
  version: number;
}

export interface AnalysisSummary {
  analysisType: AnalysisType;
  analysisTitle: string;
  content: string;
  confidenceScore: number | null;
  generatedAt: string;
  version: number;
  modelUsed: string;
}

export class PaperAnalysisService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    // If we're in the browser and no baseUrl is provided, use empty string for relative URLs
    // If we're on server-side, we need the full URL
    this.baseUrl = baseUrl;
  }

  /**
   * Save analysis result to the database
   */
  async saveAnalysis(request: SaveAnalysisRequest): Promise<{ success: boolean; analysisId?: string; error?: string }> {
    try {
      console.log('🔄 PaperAnalysisService.saveAnalysis called with:', {
        paperId: request.paperId,
        analysisType: request.analysisType,
        analysisTitle: request.analysisTitle,
        contentLength: request.content.length
      });

      const url = this.baseUrl ? `${this.baseUrl}/api/papers/${request.paperId}/analysis` : `/api/papers/${request.paperId}/analysis`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysisType: request.analysisType,
          analysisTitle: request.analysisTitle,
          content: request.content,
          promptUsed: request.promptUsed,
          confidenceScore: request.confidenceScore,
          processingTimeMs: request.processingTimeMs,
          chunksUsed: request.chunksUsed,
          modelUsed: request.modelUsed || 'gpt-4'
        }),
      });

      const data = await response.json();
      console.log('📄 Save analysis API response:', {
        status: response.status,
        ok: response.ok,
        data: data
      });

      if (!response.ok) {
        console.error('❌ Save analysis failed:', data);
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      console.log('✅ Analysis saved successfully:', data.analysisId);
      return {
        success: true,
        analysisId: data.analysisId
      };

    } catch (error) {
      console.error('💥 Error saving analysis:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get specific analysis by type
   */
  async getAnalysis(paperId: string, analysisType: AnalysisType): Promise<{ analysis: AnalysisResult | null; error?: string }> {
    try {
      const url = this.baseUrl ? `${this.baseUrl}/api/papers/${paperId}/analysis?type=${analysisType}` : `/api/papers/${paperId}/analysis?type=${analysisType}`;
      const response = await fetch(url);
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return {
        analysis: data.analysis
      };

    } catch (error) {
      console.error('Error getting analysis:', error);
      return {
        analysis: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all analysis for a paper
   */
  async getAllAnalysis(paperId: string): Promise<{ analyses: Record<string, AnalysisSummary>; error?: string }> {
    try {
      console.log('🔍 PaperAnalysisService.getAllAnalysis called for paper:', paperId);
      
      const url = this.baseUrl ? `${this.baseUrl}/api/papers/${paperId}/analysis` : `/api/papers/${paperId}/analysis`;
      const response = await fetch(url);
      
      const data = await response.json();
      console.log('📄 Get all analysis API response:', {
        status: response.status,
        ok: response.ok,
        data: data
      });

      if (!response.ok) {
        console.error('❌ Get all analysis failed:', data);
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      console.log('✅ Got analysis data:', Object.keys(data.analyses || {}).length, 'analysis types');
      return {
        analyses: data.analyses || {}
      };

    } catch (error) {
      console.error('💥 Error getting all analysis:', error);
      return {
        analyses: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete analysis by type
   */
  async deleteAnalysis(paperId: string, analysisType: AnalysisType): Promise<{ success: boolean; error?: string }> {
    try {
      const url = this.baseUrl ? `${this.baseUrl}/api/papers/${paperId}/analysis?type=${analysisType}` : `/api/papers/${paperId}/analysis?type=${analysisType}`;
      const response = await fetch(url, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return {
        success: true
      };

    } catch (error) {
      console.error('Error deleting analysis:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save multiple analysis results (batch operation)
   */
  async saveMultipleAnalysis(
    paperId: string, 
    analyses: Array<Omit<SaveAnalysisRequest, 'paperId'>>
  ): Promise<{ success: boolean; savedCount: number; errors: string[] }> {
    const errors: string[] = [];
    let savedCount = 0;

    for (const analysis of analyses) {
      const result = await this.saveAnalysis({
        ...analysis,
        paperId
      });

      if (result.success) {
        savedCount++;
      } else {
        errors.push(`${analysis.analysisType}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      savedCount,
      errors
    };
  }
}

// Default instance
export const paperAnalysisService = new PaperAnalysisService();

// Analysis type mappings for UI
export const ANALYSIS_TYPE_LABELS: Record<AnalysisType, string> = {
  overview: 'Research Overview',
  methodology: 'Methodology & Approach',
  findings: 'Key Findings & Results',
  assessment: 'Critical Assessment',
  impact: 'Impact & Applications',
  personal: 'Personal Analysis',
  custom: 'Custom Analysis'
};

export const ANALYSIS_TYPE_DESCRIPTIONS: Record<AnalysisType, string> = {
  overview: 'Comprehensive overview of the research including main objectives and significance',
  methodology: 'Analysis of research methodology, study design, and experimental procedures',
  findings: 'Summary of key findings, main results, and novel discoveries',
  assessment: 'Critical assessment including strengths, limitations, and quality evaluation',
  impact: 'Analysis of practical applications and potential impact in the field',
  personal: 'Personal notes, insights, and connections to other research',
  custom: 'Custom analysis based on specific requirements'
};