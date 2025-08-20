"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Brain, 
  Lightbulb,
  Target,
  Clock,
  AlertTriangle
} from "lucide-react";
import { Paper } from "@/components/papers-table";

export interface ResearchGap {
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  relatedPapers: string[];
  suggestedApproaches: string[];
}

export interface EmergingOpportunity {
  area: string;
  description: string;
  potentialImpact: 'transformative' | 'significant' | 'incremental';
  timeToMarket: 'short' | 'medium' | 'long';
}

export interface TrendAnalysis {
  growingAreas: string[];
  decliningAreas: string[];
  stableAreas: string[];
  emergingKeywords: string[];
}

export interface ResearchRecommendation {
  type: 'methodology' | 'application' | 'theory' | 'interdisciplinary';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  requiredResources: string[];
}

export interface ResearchGapAnalysisResult {
  identifiedGaps: ResearchGap[];
  emergingOpportunities: EmergingOpportunity[];
  trendAnalysis: TrendAnalysis;
  recommendations: ResearchRecommendation[];
}

interface ResearchGapAnalysisProps {
  papers: Paper[];
  collectionName: string;
  onAnalysisComplete?: (result: ResearchGapAnalysisResult) => void;
}

export function ResearchGapAnalysis({ 
  papers, 
  collectionName, 
  onAnalysisComplete 
}: ResearchGapAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisResult, setAnalysisResult] = React.useState<ResearchGapAnalysisResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);

  const runAnalysis = async () => {
    if (papers.length === 0) {
      setError("No papers available for analysis");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Infer domain from collection name and papers
      const domain = inferDomain(collectionName, papers);

      const response = await fetch('/api/agents/research-gaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          papers: papers.map(paper => ({
            id: paper.id,
            title: paper.title,
            authors: paper.authors,
            journal: paper.journal,
            year: paper.year,
            doi: paper.doi || '',
            tags: paper.tags,
            notes: paper.notes,
            dateAdded: paper.dateAdded,
            collections: paper.collections,
            status: paper.status,
            url: paper.url,
            zoteroKey: paper.zoteroKey,
            zoteroVersion: paper.zoteroVersion,
            itemType: paper.itemType,
            aiColumns: paper.aiColumns,
          })),
          domain,
          timeframe: {
            startYear: Math.min(...papers.map(p => p.year)),
            endYear: Math.max(...papers.map(p => p.year))
          },
          focusAreas: extractFocusAreas(papers)
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setAnalysisResult(data.data);
        onAnalysisComplete?.(data.data);
      } else {
        throw new Error(data.error || 'Analysis failed');
      }

    } catch (err) {
      console.error('Research gap analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'transformative': return <Brain className="h-4 w-4" />;
      case 'significant': return <Target className="h-4 w-4" />;
      case 'incremental': return <TrendingUp className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getTimeIcon = (time: string) => {
    switch (time) {
      case 'short': return <Clock className="h-4 w-4 text-green-600" />;
      case 'medium': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'long': return <Clock className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const inferDomain = (collectionName: string, papers: Paper[]): string => {
    if (collectionName && collectionName !== "All Papers") {
      return collectionName;
    }
    
    // Analyze paper content to infer domain
    const allTags = papers.flatMap(p => p.tags).map(t => t.toLowerCase());
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([tag]) => tag);

    return topTags.length > 0 ? topTags.join(', ') : 'Research Collection';
  };

  const extractFocusAreas = (papers: Paper[]): string[] => {
    const allTags = papers.flatMap(p => p.tags);
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);
  };

  if (papers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Research Gap Analysis
          </CardTitle>
          <CardDescription>
            Identify research gaps and emerging opportunities across your paper collection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No papers available for analysis. Add papers to your collection to identify research gaps.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Research Gap Analysis
        </CardTitle>
        <CardDescription>
          Analyze {papers.length} papers in &quot;{collectionName}&quot; to identify gaps and opportunities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysisResult && !isAnalyzing && (
          <Button onClick={runAnalysis} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            Analyze Research Gaps
          </Button>
        )}

        {isAnalyzing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Analyzing research gaps...</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {analysisResult && (
          <Tabs defaultValue="gaps" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="gaps">
                Gaps ({analysisResult.identifiedGaps.length})
              </TabsTrigger>
              <TabsTrigger value="opportunities">
                Opportunities ({analysisResult.emergingOpportunities.length})
              </TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="recommendations">
                Recommendations ({analysisResult.recommendations.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gaps" className="space-y-4">
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {analysisResult.identifiedGaps.map((gap, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{gap.title}</CardTitle>
                          <Badge variant={getImportanceColor(gap.importance)}>
                            {gap.importance}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{gap.description}</p>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-2">Suggested Approaches:</h4>
                          <ul className="text-sm space-y-1">
                            {gap.suggestedApproaches.map((approach, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-muted-foreground">•</span>
                                {approach}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <span className="text-sm text-muted-foreground">
                            Related to {gap.relatedPapers.length} papers
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="opportunities" className="space-y-4">
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {analysisResult.emergingOpportunities.map((opportunity, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          {getImpactIcon(opportunity.potentialImpact)}
                          {opportunity.area}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{opportunity.description}</p>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Impact:</span>
                            <Badge variant="outline">{opportunity.potentialImpact}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            {getTimeIcon(opportunity.timeToMarket)}
                            <span className="text-xs text-muted-foreground">
                              {opportunity.timeToMarket}-term
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              <div className="grid gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Growing Areas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.trendAnalysis.growingAreas.map((area, index) => (
                        <Badge key={index} variant="secondary" className="bg-green-50 text-green-700">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      Declining Areas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.trendAnalysis.decliningAreas.map((area, index) => (
                        <Badge key={index} variant="secondary" className="bg-red-50 text-red-700">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Emerging Keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.trendAnalysis.emergingKeywords.map((keyword, index) => (
                        <Badge key={index} variant="outline">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {analysisResult.recommendations.map((rec, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{rec.title}</CardTitle>
                          <div className="flex gap-2">
                            <Badge variant="outline">{rec.type}</Badge>
                            <Badge variant={getImportanceColor(rec.priority)}>
                              {rec.priority}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-2">Required Resources:</h4>
                          <div className="flex flex-wrap gap-2">
                            {rec.requiredResources.map((resource, idx) => (
                              <Badge key={idx} variant="secondary">
                                {resource}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {analysisResult && (
          <Separator className="my-4" />
        )}

        {analysisResult && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={runAnalysis}>
              <Search className="mr-2 h-4 w-4" />
              Re-analyze
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}