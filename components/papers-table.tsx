"use client";

import * as React from "react";

// Simple debounce utility
function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  wait: number
): (...args: Args) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, MoreHorizontal, Trash, ExternalLink, Sparkles, Loader2, Maximize2, GripVertical, X, BookOpen, Users, Calendar, Tag, MessageSquare, TrendingUp, AlertCircle, Star, FileText, Target, Lightbulb, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CustomHeightDialog } from "./custom-height-dialog";
import { useTemplatePreferences } from "@/hooks/use-template-preferences";
import { useZoteroAuth } from "@/hooks/use-zotero-auth";
import { AIColumn, AddAIColumnDialog } from "./add-ai-column-dialog";
import { paperAnalysisService, AnalysisSummary } from "@/lib/services/paper-analysis-service";
import { AnalysisType } from "@/lib/database.types";

export type Paper = {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  doi?: string;
  tags: string[];
  notes: string;
  abstract?: string;
  dateAdded: string;
  collections: string[];
  status: "unread" | "reading" | "read" | "archived";
  url?: string;
  zoteroKey?: string;
  zoteroVersion?: number;
  itemType?: string;
  aiColumns?: Record<string, string>;
};

export type AIColumnType = {
  id: string;
  name: string;
  prompt: string;
  isGenerating?: boolean;
};

export type HeightMode = "compact" | "spacious" | "custom";

interface HeightModeConfig {
  mode: HeightMode;
  customHeight: number;
}

// Analysis Card Types
type AnalysisCardType = {
  id: string;
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  content: (paper: Paper) => React.ReactNode;
  aiPrompt?: string;
};

const availableAnalysisCards: AnalysisCardType[] = [
  {
    id: "overview",
    title: "Research Overview",
    icon: <FileText className="h-5 w-5 text-blue-600" />,
    bgColor: "bg-blue-50",
    content: (paper) => (
      <div>
        <div className="mb-2">
          <span className="font-medium">Abstract:</span>
          <p className="mt-1 text-gray-600 italic">
            {paper.abstract || "No abstract available. AI can extract key objectives and contributions."}
          </p>
        </div>
        <div>
          <span className="font-medium">Research Type:</span>
          <span className="ml-2">{paper.itemType || "Unknown"}</span>
        </div>
      </div>
    ),
    aiPrompt: "What are the main objectives and key contributions? Why is this research significant?"
  },
  {
    id: "methodology",
    title: "Methodology & Approach",
    icon: <Target className="h-5 w-5 text-green-600" />,
    bgColor: "bg-green-50",
    content: () => (
      <div>
        <p><span className="font-medium">Study Design:</span> Requires AI analysis</p>
        <p><span className="font-medium">Data Collection:</span> Not specified</p>
        <p><span className="font-medium">Sample Size:</span> To be determined</p>
        <p className="text-xs text-green-700 mt-2">🔬 Click &quot;Analyze&quot; to extract methodology details</p>
      </div>
    ),
    aiPrompt: "What methods were used? Include study design, sample size, and key procedures."
  },
  {
    id: "findings",
    title: "Key Findings & Results", 
    icon: <TrendingUp className="h-5 w-5 text-purple-600" />,
    bgColor: "bg-purple-50",
    content: () => (
      <div>
        <p><span className="font-medium">Main Results:</span> Pending analysis</p>
        <p><span className="font-medium">Statistical Significance:</span> Not extracted</p>
        <p><span className="font-medium">Novel Discoveries:</span> To be identified</p>
        <p className="text-xs text-purple-700 mt-2">📊 Click &quot;Analyze&quot; to extract key findings</p>
      </div>
    ),
    aiPrompt: "What are the most important results and discoveries? Include key statistics if relevant."
  },
  {
    id: "assessment",
    title: "Critical Assessment",
    icon: <AlertCircle className="h-5 w-5 text-orange-600" />,
    bgColor: "bg-orange-50", 
    content: () => (
      <div>
        <p><span className="font-medium">Strengths:</span> Needs evaluation</p>
        <p><span className="font-medium">Limitations:</span> Requires identification</p>
        <p><span className="font-medium">Quality Score:</span> Not rated</p>
        <p className="text-xs text-orange-700 mt-2">⚠️ Click &quot;Analyze&quot; to evaluate research quality</p>
      </div>
    ),
    aiPrompt: "What are the main strengths and limitations? Rate overall quality (1-10) with brief justification."
  },
  {
    id: "impact",
    title: "Impact & Applications",
    icon: <Lightbulb className="h-5 w-5 text-yellow-600" />,
    bgColor: "bg-yellow-50",
    content: () => (
      <div>
        <p><span className="font-medium">Practical Applications:</span> To be explored</p>
        <p><span className="font-medium">Future Research:</span> Opportunities pending</p>
        <p><span className="font-medium">Citation Potential:</span> Unassessed</p>
        <p className="text-xs text-yellow-700 mt-2">🚀 Click &quot;Analyze&quot; for impact assessment</p>
      </div>
    ),
    aiPrompt: "What practical applications and future research directions does this enable?"
  },
  {
    id: "personal",
    title: "Personal Analysis",
    icon: <MessageSquare className="h-5 w-5 text-indigo-600" />,
    bgColor: "bg-indigo-50",
    content: () => (
      <div>
        <p><span className="font-medium">My Notes:</span> <span className="text-gray-500">Click to add personal insights...</span></p>
        <p><span className="font-medium">Quality Rating:</span> <div className="inline-flex gap-1 ml-2">
          {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 text-gray-300" />)}
        </div></p>
        <p><span className="font-medium">Research Connections:</span> None identified</p>
      </div>
    )
  }
];

// Paper Analysis Panel Component
const PaperAnalysisPanel = ({ paper, expandedRows, setExpandedRows }: { paper: Paper, expandedRows: Set<string>, setExpandedRows: (rows: Set<string>) => void }) => {
  const [activeCards, setActiveCards] = React.useState<string[]>([
    "overview", "methodology", "findings" // Default active cards
  ]);
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [analysisResults, setAnalysisResults] = React.useState<{ [cardId: string]: string }>({});
  const [savedAnalysis, setSavedAnalysis] = React.useState<Record<string, AnalysisSummary>>({});
  const [analyzingCards, setAnalyzingCards] = React.useState<Set<string>>(new Set());
  const [analyzingAll, setAnalyzingAll] = React.useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = React.useState(true);

  const formatAuthorList = (authors: string[]) => {
    if (authors.length <= 3) return authors.join(", ");
    return `${authors.slice(0, 3).join(", ")} and ${authors.length - 3} others`;
  };

  // Load saved analysis on component mount
  React.useEffect(() => {
    const loadSavedAnalysis = async () => {
      setLoadingAnalysis(true);
      try {
        const { analyses, error } = await paperAnalysisService.getAllAnalysis(paper.id);
        if (error) {
          console.error('Error loading saved analysis:', error);
        } else {
          setSavedAnalysis(analyses);
          // Merge saved analysis into analysisResults for display
          const savedResults: { [cardId: string]: string } = {};
          Object.entries(analyses).forEach(([type, analysis]) => {
            savedResults[type] = analysis.content;
          });
          setAnalysisResults(prev => ({ ...savedResults, ...prev }));
        }
      } catch (error) {
        console.error('Error loading saved analysis:', error);
      } finally {
        setLoadingAnalysis(false);
      }
    };

    loadSavedAnalysis();
  }, [paper.id]);

  const analyzeCard = async (cardId: string) => {
    setAnalyzingCards(prev => new Set([...prev, cardId]));
    
    try {
      const response = await fetch('/api/agents/analyze-complete-paper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paperId: paper.id,
          title: paper.title,
          authors: paper.authors,
          abstract: paper.notes || '', // Using notes as abstract
          fullText: paper.notes || '', // Fallback to notes if no full text
          url: paper.url,
          activeCardIds: [cardId] // Only analyze this specific card
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      
      // Update analysis results
      const analysisContent = data.results[cardId] || 'Analysis completed but no content returned.';
      setAnalysisResults(prev => ({
        ...prev,
        [cardId]: analysisContent
      }));

      console.log(`✅ Analysis completed for ${cardId}:`, analysisContent);

      // Save individual analysis to database
      try {
        const cardData = availableAnalysisCards.find(card => card.id === cardId);
        if (cardData) {
          const saveResult = await paperAnalysisService.saveAnalysis({
            paperId: paper.id,
            analysisType: cardId as AnalysisType,
            analysisTitle: cardData.title,
            content: analysisContent,
            promptUsed: cardData.aiPrompt,
            modelUsed: 'gpt-4'
          });
          
          if (saveResult.success) {
            console.log(`💾 Individual analysis saved for ${cardId}`);
            // Refresh saved analysis data
            const { analyses } = await paperAnalysisService.getAllAnalysis(paper.id);
            setSavedAnalysis(analyses);
          } else {
            console.warn(`Failed to save individual analysis for ${cardId}:`, saveResult.error);
          }
        }
      } catch (saveError) {
        console.error(`Error saving individual analysis for ${cardId}:`, saveError);
      }
      
    } catch (error) {
      console.error('Error analyzing card:', error);
      setAnalysisResults(prev => ({
        ...prev,
        [cardId]: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    } finally {
      setAnalyzingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardId);
        return newSet;
      });
    }
  };

  const analyzeAllCards = async () => {
    setAnalyzingAll(true);
    
    try {
      const response = await fetch('/api/agents/analyze-complete-paper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paperId: paper.id,
          title: paper.title,
          authors: paper.authors,
          abstract: paper.notes || '',
          fullText: paper.notes || '',
          url: paper.url,
          activeCardIds: activeCards
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      
      // Update all analysis results
      setAnalysisResults(prev => ({
        ...prev,
        ...data.results
      }));

      console.log('✅ Bulk analysis completed:', data.results);
      console.log(`💾 ${data.savedToDatabase || 0} analysis results saved to database`);

      // Refresh saved analysis data after bulk operation
      try {
        const { analyses } = await paperAnalysisService.getAllAnalysis(paper.id);
        setSavedAnalysis(analyses);
      } catch (error) {
        console.error('Error refreshing saved analysis after bulk operation:', error);
      }
      
    } catch (error) {
      console.error('Error in bulk analysis:', error);
      // Set error for all active cards
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResults: { [key: string]: string } = {};
      activeCards.forEach(cardId => {
        errorResults[cardId] = `Analysis failed: ${errorMessage}`;
      });
      setAnalysisResults(prev => ({
        ...prev,
        ...errorResults
      }));
    } finally {
      setAnalyzingAll(false);
    }
  };

  const removeCard = (cardId: string) => {
    setActiveCards(prev => prev.filter(id => id !== cardId));
  };

  const addCard = (cardId: string) => {
    if (!activeCards.includes(cardId)) {
      setActiveCards(prev => [...prev, cardId]);
    }
    setShowAddMenu(false);
  };

  const availableToAdd = availableAnalysisCards.filter(card => !activeCards.includes(card.id));

  const analysisCard = (cardType: AnalysisCardType, isActive: boolean = true) => {
    const hasResult = analysisResults[cardType.id];
    const isAnalyzing = analyzingCards.has(cardType.id);
    const savedAnalysisData = savedAnalysis[cardType.id];
    const isFromDatabase = !!savedAnalysisData;
    
    return (
      <div key={cardType.id} className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/60 relative group hover:shadow-lg hover:border-gray-300/60 transition-all duration-200 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cardType.bgColor.includes('blue') ? '#f0f9ff' : 
            cardType.bgColor.includes('green') ? '#f0fdf4' : 
            cardType.bgColor.includes('purple') ? '#faf5ff' : 
            cardType.bgColor.includes('orange') ? '#fff7ed' : 
            cardType.bgColor.includes('red') ? '#fef2f2' : 
            cardType.bgColor.includes('yellow') ? '#fefce8' : '#f8fafc'}, white)`
        }}>
        {/* Status Indicators */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {isFromDatabase && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              Saved
            </div>
          )}
          {isActive && (
            <button
              onClick={() => removeCard(cardType.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm hover:shadow-md hover:bg-red-50 border border-gray-200/50"
              title={`Remove ${cardType.title}`}
            >
              <X className="h-3 w-3 text-red-600" />
            </button>
          )}
        </div>
        
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-white/80 shadow-sm">
              {cardType.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-sm">{cardType.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">AI-powered analysis</p>
            </div>
          </div>
          
          {/* Content Area */}
          <div className="min-h-[120px]">
            {hasResult ? (
              <div className="bg-gradient-to-br from-white/80 to-gray-50/50 border border-gray-200/60 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{analysisResults[cardType.id]}</div>
                {isFromDatabase && savedAnalysisData && (
                  <div className="mt-4 pt-3 border-t border-gray-200/60">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>Generated {new Date(savedAnalysisData.generatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {savedAnalysisData.confidenceScore && (
                          <div className="flex items-center gap-1 text-blue-600">
                            <TrendingUp className="h-3 w-3" />
                            <span>{(savedAnalysisData.confidenceScore * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">v{savedAnalysisData.version}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <div className="relative">
                  <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
                <span className="text-xs mt-3 text-center">Analyzing with AI<br />This may take a moment...</span>
              </div>
            ) : loadingAnalysis ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="text-xs mt-2">Loading saved analysis...</span>
              </div>
            ) : (
              <div className="text-sm text-gray-600 leading-relaxed">
                {cardType.content(paper)}
              </div>
            )}
          </div>
          
          {/* Analyze button for AI-enabled cards */}
          {cardType.aiPrompt && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-7"
                onClick={() => analyzeCard(cardType.id)}
                disabled={isAnalyzing || loadingAnalysis}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Analyzing...
                  </>
                ) : hasResult ? (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Re-analyze
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Analyze
                  </>
                )}
              </Button>
              
              {/* Delete saved analysis button */}
              {isFromDatabase && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={async () => {
                    try {
                      const result = await paperAnalysisService.deleteAnalysis(paper.id, cardType.id as AnalysisType);
                      if (result.success) {
                        // Remove from local state
                        setAnalysisResults(prev => {
                          const updated = { ...prev };
                          delete updated[cardType.id];
                          return updated;
                        });
                        setSavedAnalysis(prev => {
                          const updated = { ...prev };
                          delete updated[cardType.id];
                          return updated;
                        });
                      }
                    } catch (error) {
                      console.error('Error deleting analysis:', error);
                    }
                  }}
                  title="Delete saved analysis"
                >
                  <Trash className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 border-t border-gray-200">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Ccircle cx='30' cy='30' r='1.5'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }} />
      
      <div className="relative z-10 p-8">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 pr-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-600 uppercase tracking-wider">Research Paper</span>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 leading-tight mb-3" style={{ wordBreak: 'break-word' }}>
                {paper.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {activeCards.length > 0 && (
                <Button
                  size="sm"
                  className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                  onClick={analyzeAllCards}
                  disabled={analyzingAll || analyzingCards.size > 0}
                >
                  {analyzingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing All...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyze All ({activeCards.length})
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-full p-2"
                onClick={() => {
                  const newExpanded = new Set(expandedRows);
                  newExpanded.delete(paper.id);
                  setExpandedRows(newExpanded);
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {/* Enhanced Metadata Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Authors Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-gray-900 text-sm">Authors</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{formatAuthorList(paper.authors)}</p>
            </div>

            {/* Publication Info Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-green-600" />
                <span className="font-medium text-gray-900 text-sm">Publication</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-700 italic">{paper.journal || 'Unknown Journal'}</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-gray-500" />
                  <span className="text-xs text-gray-600">{paper.year}</span>
                </div>
              </div>
            </div>

            {/* Access Links Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-gray-900 text-sm">Access</span>
              </div>
              <div className="space-y-2">
                {paper.doi && (
                  <a 
                    href={`https://doi.org/${paper.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors"
                  >
                    DOI: {paper.doi.length > 20 ? paper.doi.substring(0, 20) + '...' : paper.doi}
                  </a>
                )}
                {paper.url && (
                  <a 
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 hover:underline bg-green-50 hover:bg-green-100 px-2 py-1 rounded-md transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Paper
                  </a>
                )}
                {(!paper.doi && !paper.url) && (
                  <span className="text-xs text-gray-400">No direct links available</span>
                )}
              </div>
            </div>
          </div>

          {/* Tags Section */}
          {paper.tags && paper.tags.length > 0 && (
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-gray-900 text-sm">Keywords & Topics</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {paper.tags.map((tag, index) => (
                  <span 
                    key={index} 
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-200 hover:from-orange-200 hover:to-amber-200 transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Analysis Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-1 w-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
            <h3 className="text-lg font-semibold text-gray-900">AI Analysis</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {activeCards.length} active
            </span>
          </div>
        </div>

        {/* Analysis Cards Grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {/* Active Cards */}
          {activeCards.map(cardId => {
            const cardType = availableAnalysisCards.find(card => card.id === cardId);
            return cardType ? analysisCard(cardType, true) : null;
          })}

          {/* Add Card Button */}
          <div className="relative">
            <div 
              className={`bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-100 transition-colors min-h-[140px] ${
                showAddMenu ? 'border-blue-400 bg-blue-50' : ''
              }`}
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <div className="text-center">
                <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">Add Analysis</p>
              </div>
            </div>

            {/* Add Menu Dropdown */}
            {showAddMenu && availableToAdd.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {availableToAdd.map(card => (
                  <button
                    key={card.id}
                    onClick={() => addCard(card.id)}
                    className="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-0"
                  >
                    {card.icon}
                    <span className="text-sm font-medium">{card.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tags and Metadata - Always visible */}
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-800">Technical Details & Metadata</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Tags:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {paper.tags && paper.tags.length > 0 ? 
                  paper.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  )) : 
                  <span className="text-gray-500">No tags assigned</span>
                }
              </div>
            </div>
            <div>
              <span className="font-medium">Collection:</span>
              <p className="text-gray-600">Current collection</p>
            </div>
            <div>
              <span className="font-medium">Added:</span>
              <p className="text-gray-600">{paper.dateAdded ? new Date(paper.dateAdded).toLocaleDateString() : "Unknown"}</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        {activeCards.length === 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-sm text-blue-800">
              <strong>Get started:</strong> Click the + button above to add analysis sections for this paper.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const createColumns = (
  aiColumns: AIColumnType[], 
  onGenerateIndividual: (columnId: string, paperId: string) => void,
  onGenerateBulk: (columnId: string) => void,
  onRemoveColumn: (columnId: string) => void,
  generatingStates: Record<string, boolean>,
  bulkGeneratingStates: Record<string, boolean>,
  generationErrors: Record<string, string>,
  expandedTags: Set<string>,
  setExpandedTags: (expandedTags: Set<string>) => void,
  minimizedRows: Set<string>,
  setMinimizedRows: (minimizedRows: Set<string>) => void,
  expandedRows: Set<string>,
  setExpandedRows: (expandedRows: Set<string>) => void
): ColumnDef<Paper>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    minSize: 40,
    maxSize: 50,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge
          variant={
            status === "read"
              ? "default"
              : status === "reading"
              ? "secondary"
              : status === "unread"
              ? "outline"
              : "destructive"
          }
          className="text-xs"
        >
          {status}
        </Badge>
      );
    },
    minSize: 80,
    maxSize: 120,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <div className="flex items-center justify-start">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-0 font-medium text-left justify-start"
        >
          Paper
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      </div>
    ),
    cell: ({ row }) => {
      const rowId = row.id;
      const isExpanded = expandedRows.has(rowId);
      
      const toggleExpanded = () => {
        const newExpanded = new Set(expandedRows);
        if (isExpanded) {
          newExpanded.delete(rowId);
        } else {
          newExpanded.add(rowId);
        }
        setExpandedRows(newExpanded);
      };
      
      const title = row.getValue("title") as string;
      const displayTitle = title.length > 85 ? title.substring(0, 85) + "..." : title;
      const paper = row.original;
      const firstAuthor = paper.authors[0]?.split(',')[0] || "Unknown Author";
      
      // Document type mapping with better labels and colors
      const getDocumentTypeInfo = (itemType?: string) => {
        const types: Record<string, { label: string; color: string; bg: string }> = {
          journalArticle: { label: "Journal", color: "text-blue-700", bg: "bg-blue-100" },
          conferencePaper: { label: "Conference", color: "text-purple-700", bg: "bg-purple-100" },
          preprint: { label: "Preprint", color: "text-orange-700", bg: "bg-orange-100" },
          book: { label: "Book", color: "text-green-700", bg: "bg-green-100" },
          bookSection: { label: "Chapter", color: "text-green-600", bg: "bg-green-50" },
          thesis: { label: "Thesis", color: "text-indigo-700", bg: "bg-indigo-100" },
          webpage: { label: "Web", color: "text-gray-700", bg: "bg-gray-100" },
          blogPost: { label: "Blog", color: "text-pink-700", bg: "bg-pink-100" },
          report: { label: "Report", color: "text-teal-700", bg: "bg-teal-100" },
          manuscript: { label: "Manuscript", color: "text-amber-700", bg: "bg-amber-100" },
        };
        return types[itemType || ''] || { label: "Paper", color: "text-gray-600", bg: "bg-gray-50" };
      };

      const docType = getDocumentTypeInfo(paper.itemType);
      
      return (
        <div className="w-full cursor-pointer hover:bg-muted/30 -mx-3 px-3 py-1 rounded group transition-colors" onClick={toggleExpanded}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm leading-tight text-gray-900" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {displayTitle}
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${docType.bg} ${docType.color}`}>
                  {docType.label}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {firstAuthor}{paper.authors.length > 1 && ` +${paper.authors.length - 1}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {paper.year}
                  </span>
                  {paper.journal && (
                    <span className="flex items-center gap-1 max-w-32 truncate">
                      <BookOpen className="h-3 w-3" />
                      <span className="truncate">{paper.journal}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {paper.doi && (
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">DOI</span>
                  )}
                  <span className={`ml-2 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    },
    minSize: 200,
    size: 450,
  },
  {
    accessorKey: "tags",
    header: () => (
      <div className="flex items-center justify-start">
        <span className="font-medium text-xs">Tags</span>
      </div>
    ),
    cell: ({ row }) => {
      const tags = row.getValue("tags") as string[];
      
      if (tags.length === 0) {
        return <span className="text-xs text-muted-foreground">—</span>;
      }
      
      return (
        <div className="flex items-center gap-1 w-full">
          {tags.length <= 2 ? (
            tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0.5">
                {tag.length > 12 ? tag.substring(0, 12) + "..." : tag}
              </Badge>
            ))
          ) : (
            <>
              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                {tags[0].length > 12 ? tags[0].substring(0, 12) + "..." : tags[0]}
              </Badge>
              <span className="text-xs text-muted-foreground">+{tags.length - 1}</span>
            </>
          )}
        </div>
      );
    },
    minSize: 80,
    size: 120,
  },
  ...aiColumns.map((aiColumn): ColumnDef<Paper> => ({
    id: `ai-${aiColumn.id}`,
    header: ({ column }) => (
      <div className="flex items-center justify-start gap-1 w-full">
        <div className="flex items-center gap-1 flex-1">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-1 font-medium text-left justify-start"
          >
            {aiColumn.name}
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGenerateBulk(aiColumn.id)}
            disabled={bulkGeneratingStates[aiColumn.id]}
            className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
            title={`Generate ${aiColumn.name} for all papers`}
          >
            {bulkGeneratingStates[aiColumn.id] ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemoveColumn(aiColumn.id)}
            className="h-6 w-6 p-0 opacity-70 hover:opacity-100 text-destructive hover:text-destructive"
            title={`Remove ${aiColumn.name} column`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.aiColumns?.[aiColumn.id];
      const key = `${aiColumn.id}-${row.original.id}`;
      const isGenerating = generatingStates[key];
      const error = generationErrors[key];
      const rowId = row.id;
      const isMinimized = minimizedRows.has(rowId);
      
      // Truncate long content when minimized
      const displayValue = value && isMinimized && value.length > 150 
        ? value.substring(0, 150) + "..."
        : value;
      
      return (
        <div className="w-full">
          {value ? (
            <div className="text-sm" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
              {displayValue}
            </div>
          ) : isGenerating ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2">
              <div className="text-xs text-destructive truncate" title={error}>
                Error: {error}
              </div>
              {!isMinimized && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onGenerateIndividual(aiColumn.id, row.original.id)}
                  className="h-5 w-5 p-0 opacity-70 hover:opacity-100"
                  title="Retry generation"
                >
                  <Sparkles className="h-3 w-3" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground italic">Not generated</span>
              {!isMinimized && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onGenerateIndividual(aiColumn.id, row.original.id)}
                  className="h-5 w-5 p-0 opacity-70 hover:opacity-100"
                  title="Generate for this paper"
                >
                  <Sparkles className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      );
    },
    minSize: 100,
    size: 250,
  })),
  {
    id: "spacer",
    header: () => null,
    enableHiding: false,
    enableResizing: false,
    enableSorting: false,
    cell: () => null,
    size: 0,
    minSize: 0,
    maxSize: undefined,
  },
  {
    id: "actions",
    header: () => null,
    enableHiding: false,
    enableResizing: false,
    minSize: 60,
    maxSize: 60,
    size: 60,
    cell: ({ row }) => {
      return (
        <div className="flex justify-end w-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in Zotero
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export interface CollectionContext {
  name: string;
  totalPapers: number;
  filteredPapers: number;
}

interface PapersTableProps {
  papers: Paper[];
  isLoading?: boolean;
  error?: string | null;
  collectionContext?: CollectionContext;
}

export function PapersTable({ papers, isLoading, error, collectionContext }: PapersTableProps) {
  const { 
    preferences, 
    loading: preferencesLoading, 
    savePreferences 
  } = useTemplatePreferences();
  
  const { userId, token } = useZoteroAuth();
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [aiColumns, setAiColumns] = React.useState<AIColumnType[]>([]);
  const [generatedContent, setGeneratedContent] = React.useState<Record<string, Record<string, string>>>({});
  const [generatingStates, setGeneratingStates] = React.useState<Record<string, boolean>>({});
  const [bulkGeneratingStates, setBulkGeneratingStates] = React.useState<Record<string, boolean>>({});
  const [generationErrors, setGenerationErrors] = React.useState<Record<string, string>>({});
  const [heightConfig, setHeightConfig] = React.useState<HeightModeConfig>({
    mode: "spacious",
    customHeight: 80
  });
  const [columnSizing, setColumnSizing] = React.useState({});
  const [showCustomHeightDialog, setShowCustomHeightDialog] = React.useState(false);
  const [initialLoad, setInitialLoad] = React.useState(true);
  const [isAddingColumn, setIsAddingColumn] = React.useState(false);
  const [expandedTags, setExpandedTags] = React.useState<Set<string>>(new Set());
  const [minimizedRows, setMinimizedRows] = React.useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  // Update state when preferences are loaded
  React.useEffect(() => {
    if (!preferencesLoading && preferences) {
      setColumnVisibility(preferences.column_visibility);
      
      setHeightConfig({
        mode: preferences.row_height_preset,
        customHeight: preferences.custom_row_height
      });
      
      // Ensure AI column widths are included
      const aiColumnSizes: Record<string, number> = {};
      preferences.ai_columns.forEach(col => {
        const aiColumnKey = `ai-${col.id}`;
        if (!preferences.column_widths[aiColumnKey]) {
          aiColumnSizes[aiColumnKey] = 250; // default AI column width
        }
      });
      
      const finalColumnSizing = {...preferences.column_widths, ...aiColumnSizes};
      setColumnSizing(finalColumnSizing);
      
      // Only update AI columns if we're not in the middle of adding one
      if (!isAddingColumn) {
        setAiColumns(preferences.ai_columns.map(col => ({ ...col, isGenerating: false })));
      }
      setGeneratedContent(preferences.generated_content);
      
      if (initialLoad) {
        setInitialLoad(false);
      }
    }
  }, [preferences, preferencesLoading, initialLoad, isAddingColumn]);

  // Save preferences directly to database
  const handleColumnVisibilityChange = (newVisibility: VisibilityState) => {
    setColumnVisibility(newVisibility);
    savePreferences({ column_visibility: newVisibility });
  };

  // Debounced save for column sizing to avoid saving during drag
  const debouncedSaveColumnSizing = React.useMemo(
    () => debounce((newSizing: Record<string, number>) => {
      savePreferences({ column_widths: newSizing });
    }, 500), // Wait 500ms after last resize before saving
    [savePreferences]
  );

  const handleColumnSizingChange = React.useCallback((newSizing: Record<string, number>) => {
    setColumnSizing(newSizing);
    debouncedSaveColumnSizing(newSizing);
  }, [debouncedSaveColumnSizing]);

  const handleHeightConfigChange = (newConfig: HeightModeConfig) => {
    setHeightConfig(newConfig);
    if (!initialLoad) {
      savePreferences({
        row_height_preset: newConfig.mode,
        custom_row_height: newConfig.customHeight
      });
    }
  };

  const getRowHeight = () => {
    switch (heightConfig.mode) {
      case "compact":
        return 48; // py-3 = 12px top + 12px bottom + content
      case "spacious":
        return 80; // py-6 = 24px top + 24px bottom + content
      case "custom":
        return Math.max(heightConfig.customHeight, 32); // Minimum height
      default:
        return 48;
    }
  };

  const getCellClassName = () => {
    switch (heightConfig.mode) {
      case "compact":
        return "px-3 py-2";
      case "spacious":
        return "px-3 py-4";
      case "custom":
        return "px-3";
      default:
        return "px-3 py-3";
    }
  };

  const addAiColumn = async (newColumn: Omit<AIColumn, "id">) => {
    console.log('🚀 Creating AI column:', newColumn);
    console.log('🚀 Auth - userId:', userId, 'token exists:', !!token);
    
    // Set flag to prevent AI columns from being overwritten during creation
    setIsAddingColumn(true);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (userId) {
        headers['x-zotero-user-id'] = userId;
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      console.log('🚀 Sending request with headers:', headers);
      
      const response = await fetch('/api/ai-columns', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newColumn.name,
          prompt: newColumn.prompt,
        }),
      });
      
      console.log('🚀 AI column API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🚀 AI column API response data:', data);
        
        const column: AIColumnType = {
          id: data.aiColumn.id,
          name: data.aiColumn.name,
          prompt: data.aiColumn.prompt,
          isGenerating: false
        };
        
        console.log('🚀 Created column object:', column);
        
        const updatedAiColumns = [...aiColumns, column];
        console.log('🚀 Updated AI columns list:', updatedAiColumns);
        setAiColumns(updatedAiColumns);
        
        // Reset the flag now that we've successfully added the column
        setIsAddingColumn(false);
        
        // Note: AI column is already saved by the API, no need to save again
        
        // Add default width for new AI column
        const aiColumnKey = `ai-${column.id}`;
        const updatedColumnSizing = {
          ...columnSizing,
          [aiColumnKey]: 250
        };
        setColumnSizing(updatedColumnSizing);
        
        // Save column sizing to database
        savePreferences({
          column_widths: updatedColumnSizing
        });
        
        return column;
      } else {
        console.error('Failed to create AI column');
        throw new Error('Failed to create AI column');
      }
    } catch (error) {
      console.error('Error creating AI column:', error);
      // Reset the flag on error too
      setIsAddingColumn(false);
      throw error;
    }
  };

  const addAiColumnAndGenerate = async (newColumn: Omit<AIColumn, "id">) => {
    console.log('🚀 Creating AI column with auto-generation:', newColumn);
    
    try {
      // First, create the column
      const column = await addAiColumn(newColumn);
      
      if (column && newColumn.autoGenerate) {
        console.log('⚡ Starting auto-generation for column:', column.id);
        
        // Start bulk generation with the column data to avoid state timing issues
        setTimeout(() => {
          handleGenerateBulkWithColumn(column);
        }, 100);
      }
    } catch (error) {
      console.error('Error in addAiColumnAndGenerate:', error);
      throw error;
    }
  };

  const removeAiColumn = React.useCallback(async (columnId: string) => {
    console.log('🗑️ Removing AI column:', columnId);
    console.log('🗑️ Auth - userId:', userId, 'token exists:', !!token);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (userId) {
        headers['x-zotero-user-id'] = userId;
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      console.log('🗑️ Sending remove request with headers:', headers);
      
      const response = await fetch('/api/ai-columns', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          columnId: columnId,
        }),
      });
      
      console.log('🗑️ AI column DELETE response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🗑️ AI column DELETE response data:', data);
        
        // Update local state
        const updatedAiColumns = aiColumns.filter(col => col.id !== columnId);
        console.log('🗑️ Updated AI columns list:', updatedAiColumns);
        setAiColumns(updatedAiColumns);
        
        // Clean up generated content for this column
        const cleanedGeneratedContent: Record<string, Record<string, string>> = {};
        Object.keys(generatedContent).forEach(paperId => {
          const paperContent = generatedContent[paperId];
          const cleanedPaperContent = { ...paperContent };
          delete cleanedPaperContent[columnId];
          if (Object.keys(cleanedPaperContent).length > 0) {
            cleanedGeneratedContent[paperId] = cleanedPaperContent;
          }
        });
        setGeneratedContent(cleanedGeneratedContent);
        
        // Clean up column sizing
        const aiColumnKey = `ai-${columnId}`;
        const updatedColumnSizing = { ...columnSizing as Record<string, number> };
        delete updatedColumnSizing[aiColumnKey];
        setColumnSizing(updatedColumnSizing);
        
        // Note: Column data cleanup is already handled by the API
        
        console.log('🗑️ Successfully removed AI column');
      } else {
        const errorData = await response.json();
        console.error('Failed to remove AI column:', errorData);
      }
    } catch (error) {
      console.error('Error removing AI column:', error);
    }
  }, [userId, token, aiColumns, generatedContent, columnSizing]);

  const generateAiContent = async (columnId: string, paperId: string, columnData?: AIColumnType) => {
    // Find the paper data
    const paper = papers.find(p => p.id === paperId);
    if (!paper) {
      throw new Error('Paper not found');
    }

    // Find the AI column to get the prompt - use provided columnData or find in state
    const aiColumn = columnData || aiColumns.find(col => col.id === columnId);
    if (!aiColumn) {
      throw new Error('AI column not found');
    }

    try {
      // Use the new Paper Analysis Agent if the prompt matches certain patterns
      const isAnalysisPrompt = aiColumn.prompt.toLowerCase().includes('methodology') || 
                              aiColumn.prompt.toLowerCase().includes('limitation') ||
                              aiColumn.prompt.toLowerCase().includes('finding') ||
                              aiColumn.prompt.toLowerCase().includes('future work');

      if (isAnalysisPrompt) {
        // Use the new agent-based approach with collection context
        const response = await fetch('/api/agents/smart-column', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paper: {
              id: paper.id,
              title: paper.title,
              authors: paper.authors,
              journal: paper.journal,
              year: paper.year,
              notes: paper.notes,
              tags: paper.tags,
              doi: paper.doi,
              dateAdded: paper.dateAdded,
              collections: paper.collections,
              status: paper.status,
              itemType: paper.itemType,
              url: paper.url,
              zoteroKey: paper.zoteroKey,
              zoteroVersion: paper.zoteroVersion,
              aiColumns: paper.aiColumns
            },
            columnType: aiColumn.prompt.toLowerCase().includes('methodology') ? 'methodology' :
                       aiColumn.prompt.toLowerCase().includes('limitation') ? 'limitations' :
                       aiColumn.prompt.toLowerCase().includes('finding') ? 'findings' :
                       aiColumn.prompt.toLowerCase().includes('future work') ? 'future_work' : 'custom',
            customPrompt: aiColumn.prompt,
            collectionContext: collectionContext ? {
              name: collectionContext.name,
              allPapers: papers.map(p => ({
                id: p.id,
                title: p.title,
                authors: p.authors,
                journal: p.journal,
                year: p.year,
                tags: p.tags || [],
                collections: p.collections || []
              }))
            } : undefined
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Agent API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.data?.content || data.content;
      } else {
        // Fall back to original AI generation for custom prompts
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: aiColumn.prompt,
            paperData: {
              title: paper.title,
              authors: paper.authors,
              journal: paper.journal,
              year: paper.year,
              notes: paper.notes,
              tags: paper.tags,
              doi: paper.doi,
              itemType: paper.itemType,
              url: paper.url
            }
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.content;
      }
    } catch (error) {
      console.error('Error calling AI API:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to generate AI content');
    }
  };

  const handleGenerateIndividual = React.useCallback(async (columnId: string, paperId: string, columnData?: AIColumnType) => {
    const key = `${columnId}-${paperId}`;
    setGeneratingStates(prev => ({ ...prev, [key]: true }));
    // Clear any previous error for this cell
    setGenerationErrors(prev => ({ ...prev, [key]: '' }));
    
    try {
      const content = await generateAiContent(columnId, paperId, columnData);
      const newGeneratedContent = {
        ...generatedContent,
        [paperId]: {
          ...generatedContent[paperId],
          [columnId]: content
        }
      };
      setGeneratedContent(newGeneratedContent);
      
      // Save generated content to database
      if (!initialLoad) {
        savePreferences({ generated_content: newGeneratedContent });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate content';
      console.error('Error generating content:', error);
      setGenerationErrors(prev => ({ ...prev, [key]: errorMessage }));
    } finally {
      setGeneratingStates(prev => ({ ...prev, [key]: false }));
    }
  }, [generatedContent, initialLoad, savePreferences, papers, aiColumns]);

  const handleGenerateBulk = React.useCallback(async (columnId: string) => {
    setBulkGeneratingStates(prev => ({ ...prev, [columnId]: true }));
    let finalGeneratedContent = generatedContent;
    
    try {
      const papersToGenerate = papers.filter(paper => !generatedContent[paper.id]?.[columnId]);
      
      // Process papers with controlled concurrency to avoid rate limits
      const batchSize = 3; // Process 3 at a time
      for (let i = 0; i < papersToGenerate.length; i += batchSize) {
        const batch = papersToGenerate.slice(i, i + batchSize);
        const promises = batch.map(async (paper) => {
          const key = `${columnId}-${paper.id}`;
          setGeneratingStates(prev => ({ ...prev, [key]: true }));
          setGenerationErrors(prev => ({ ...prev, [key]: '' }));
          
          try {
            const content = await generateAiContent(columnId, paper.id);
            setGeneratedContent(prev => {
              const newContent = {
                ...prev,
                [paper.id]: {
                  ...prev[paper.id],
                  [columnId]: content
                }
              };
              finalGeneratedContent = newContent;
              return newContent;
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to generate content';
            console.error(`Error generating content for paper ${paper.id}:`, error);
            setGenerationErrors(prev => ({ ...prev, [key]: errorMessage }));
          } finally {
            setGeneratingStates(prev => ({ ...prev, [key]: false }));
          }
        });
        
        await Promise.all(promises);
        
        // Add a small delay between batches to respect rate limits
        if (i + batchSize < papersToGenerate.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Error in bulk generation:', error);
    } finally {
      setBulkGeneratingStates(prev => ({ ...prev, [columnId]: false }));
      
      // Save all generated content after bulk operation
      if (!initialLoad) {
        savePreferences({ generated_content: finalGeneratedContent });
      }
    }
  }, [generatedContent, initialLoad, savePreferences, papers, aiColumns]);

  const handleGenerateBulkWithColumn = React.useCallback(async (column: AIColumnType) => {
    const columnId = column.id;
    setBulkGeneratingStates(prev => ({ ...prev, [columnId]: true }));
    let finalGeneratedContent = generatedContent;
    
    try {
      const papersToGenerate = papers.filter(paper => !generatedContent[paper.id]?.[columnId]);
      
      // Process papers with controlled concurrency to avoid rate limits
      const batchSize = 3; // Process 3 at a time
      for (let i = 0; i < papersToGenerate.length; i += batchSize) {
        const batch = papersToGenerate.slice(i, i + batchSize);
        const promises = batch.map(async (paper) => {
          const key = `${columnId}-${paper.id}`;
          setGeneratingStates(prev => ({ ...prev, [key]: true }));
          setGenerationErrors(prev => ({ ...prev, [key]: '' }));
          
          try {
            // Pass the column data directly to avoid state timing issues
            const content = await generateAiContent(columnId, paper.id, column);
            setGeneratedContent(prev => {
              const newContent = {
                ...prev,
                [paper.id]: {
                  ...prev[paper.id],
                  [columnId]: content
                }
              };
              finalGeneratedContent = newContent;
              return newContent;
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to generate content';
            console.error(`Error generating content for paper ${paper.id}:`, error);
            setGenerationErrors(prev => ({ ...prev, [key]: errorMessage }));
          } finally {
            setGeneratingStates(prev => ({ ...prev, [key]: false }));
          }
        });
        
        await Promise.all(promises);
        
        // Add a small delay between batches to respect rate limits
        if (i + batchSize < papersToGenerate.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Error in bulk generation:', error);
    } finally {
      setBulkGeneratingStates(prev => ({ ...prev, [columnId]: false }));
      
      // Save all generated content after bulk operation
      if (!initialLoad) {
        savePreferences({ generated_content: finalGeneratedContent });
      }
    }
  }, [generatedContent, initialLoad, savePreferences, papers]);

  const columns = React.useMemo(
    () => createColumns(aiColumns, handleGenerateIndividual, handleGenerateBulk, removeAiColumn, generatingStates, bulkGeneratingStates, generationErrors, expandedTags, setExpandedTags, minimizedRows, setMinimizedRows, expandedRows, setExpandedRows), 
    [aiColumns, generatingStates, bulkGeneratingStates, generationErrors, expandedTags, minimizedRows, expandedRows, handleGenerateBulk, handleGenerateIndividual, removeAiColumn]
  );

  // Merge papers with generated content
  const enrichedPapers = React.useMemo(() => {
    return papers.map(paper => ({
      ...paper,
      aiColumns: generatedContent[paper.id] || {}
    }));
  }, [papers, generatedContent]);

  const table = useReactTable({
    data: enrichedPapers,
    columns: columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: (updater) => {
      console.log('🎯 React Table onColumnSizingChange called with:', updater);
      const newSizing = typeof updater === 'function' ? updater(columnSizing) : updater;
      console.log('🎯 New sizing calculated:', newSizing);
      handleColumnSizingChange(newSizing);
    },
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: (updater) => {
      console.log('🎯 React Table onColumnVisibilityChange called with:', updater);
      const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater;
      console.log('🎯 New visibility calculated:', newVisibility);
      handleColumnVisibilityChange(newVisibility);
    },
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-3 gap-3">
        <Input
          placeholder="Search papers..."
          value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("title")?.setFilterValue(event.target.value)
          }
          className="max-w-sm h-9"
        />
        
        {/* Height Mode Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Maximize2 className="h-4 w-4" />
              {heightConfig.mode === "compact" && "Compact"}
              {heightConfig.mode === "spacious" && "Spacious"}
              {heightConfig.mode === "custom" && `Custom (${heightConfig.customHeight}px)`}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Row Height</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleHeightConfigChange({ ...heightConfig, mode: "compact" })}
              className={heightConfig.mode === "compact" ? "bg-accent" : ""}
            >
              Compact
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleHeightConfigChange({ ...heightConfig, mode: "spacious" })}
              className={heightConfig.mode === "spacious" ? "bg-accent" : ""}
            >
              Spacious
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                handleHeightConfigChange({ ...heightConfig, mode: "custom" });
                setShowCustomHeightDialog(true);
              }}
              className={heightConfig.mode === "custom" ? "bg-accent" : ""}
            >
              <div className="flex items-center justify-between w-full">
                <span>Custom ({heightConfig.customHeight}px)</span>
                <Maximize2 className="h-3 w-3 ml-2" />
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto gap-2">
              View <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).replace('ai-', 'AI: ')}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>

        <AddAIColumnDialog onAddColumn={addAiColumnAndGenerate} />
      </div>
      
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
        <GripVertical className="h-3 w-3" />
        <span>Hover over column borders to resize columns</span>
      </div>
      
      <div className="rounded-lg border bg-card">
        <div className="overflow-auto relative">
          <Table 
            className="w-full" 
            style={{ 
              width: '100%',
              minWidth: table.getTotalSize(),
              tableLayout: 'fixed'
            }}
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead 
                        key={header.id} 
                        className={`h-10 px-3 text-xs font-medium relative ${
                          header.id === 'actions' 
                            ? 'text-right sticky right-0 bg-background z-10 border-l shadow-sm' 
                            : header.id === 'spacer'
                            ? 'p-0 border-0'
                            : ''
                        }`}
                        style={{
                          width: header.id === 'spacer' ? 'auto' : `${header.getSize()}px`,
                          minWidth: header.column.columnDef.minSize || (header.id === 'spacer' ? 0 : 50),
                          maxWidth: header.column.columnDef.maxSize || 'none'
                        }}
                      >
                        <div className={`flex items-center w-full ${header.id === 'actions' ? 'justify-end' : 'justify-start'}`}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </div>
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 h-full w-4 cursor-col-resize group flex items-center justify-center hover:bg-primary/20 transition-all ${
                              header.column.getIsResizing() ? 'bg-primary/30' : ''
                            }`}
                            title="Drag to resize column"
                          >
                            <GripVertical className="h-4 w-3 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                          </div>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading papers...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-destructive"
                  >
                    Error: {error}
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow
                      data-state={row.getIsSelected() && "selected"}
                      className="hover:bg-muted/50 border-b last:border-0"
                      style={{ 
                        minHeight: `${getRowHeight()}px`
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell 
                          key={cell.id} 
                          className={`${
                            cell.column.id === 'spacer' ? 'p-0 border-0' : getCellClassName()
                          } ${
                            cell.column.id === 'actions' 
                              ? 'text-right sticky right-0 bg-background z-10 border-l shadow-sm' 
                              : ''
                          }`}
                          style={{
                            verticalAlign: "top",
                            width: cell.column.id === 'spacer' ? 'auto' : `${cell.column.getSize()}px`,
                            minWidth: cell.column.columnDef.minSize || (cell.column.id === 'spacer' ? 0 : 50),
                            maxWidth: cell.column.columnDef.maxSize || 'none'
                          }}
                        >
                          <div 
                            className={`${heightConfig.mode === "spacious" ? "leading-relaxed" : heightConfig.mode === "compact" ? "leading-tight" : "leading-normal"} w-full`}
                            style={{ 
                              wordBreak: 'break-word', 
                              overflowWrap: 'anywhere',
                              hyphens: 'auto',
                              whiteSpace: 'normal'
                            }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                    {expandedRows.has(row.id) && (
                      <TableRow className="border-0">
                        <TableCell colSpan={columns.length} className="p-0 bg-muted/20">
                          <PaperAnalysisPanel paper={row.original} expandedRows={expandedRows} setExpandedRows={setExpandedRows} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No papers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Custom Height Dialog - Outside of dropdowns to prevent conflicts */}
      <CustomHeightDialog
        currentHeight={heightConfig.customHeight}
        onHeightChange={(height) => {
          handleHeightConfigChange({ mode: "custom", customHeight: height });
          setShowCustomHeightDialog(false);
        }}
        open={showCustomHeightDialog}
        onOpenChange={setShowCustomHeightDialog}
      />
    </div>
  );
}