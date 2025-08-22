"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Wand2, Brain, Sparkles, Lightbulb, Zap } from "lucide-react";
export type AIColumn = {
  id: string;
  name: string;
  prompt: string;
  isGenerating?: boolean;
  autoGenerate?: boolean;
};

interface AddAIColumnDialogProps {
  onAddColumn: (column: Omit<AIColumn, "id">) => void;
  papers?: any[]; // For collection context
  collectionName?: string;
  onAddAndGenerate?: (column: Omit<AIColumn, "id">) => Promise<void>;
}

// Useful AI-powered columns that provide real value
const aiFeatures = [
  {
    name: "📊 Research Quality Score",
    description: "AI evaluates methodology rigor, sample size, statistical validity, and overall study quality (1-10 with reasoning)",
    prompt: "Evaluate the research quality of this paper on a scale of 1-10. Consider methodology rigor, sample size adequacy, statistical validity, reproducibility, and overall contribution to the field. Provide the score and detailed reasoning.",
    badge: "Quality AI"
  },
  {
    name: "🔍 Key Insights Summary", 
    description: "AI extracts the 3 most important takeaways and actionable insights from the research",
    prompt: "Extract the 3 most important insights from this research paper. Focus on novel findings, practical implications, and actionable takeaways. Present each insight clearly and concisely.",
    badge: "Insights AI"
  },
  {
    name: "⚠️ Limitations & Risks",
    description: "AI identifies study limitations, potential biases, and areas of concern",
    prompt: "Identify the key limitations, potential biases, and methodological concerns in this research. Include sample limitations, generalizability issues, and any risks in applying the findings.",
    badge: "Analysis AI"
  },
  {
    name: "🚀 Future Opportunities", 
    description: "AI suggests specific follow-up research directions and practical applications",
    prompt: "Based on this paper, suggest 2-3 specific future research opportunities and practical applications. Focus on actionable next steps and real-world implementations.",
    badge: "Research AI"
  },
  {
    name: "📈 Citation Impact Prediction",
    description: "AI predicts citation potential based on novelty, methodology, and field relevance",
    prompt: "Predict the citation impact potential of this paper (Low/Medium/High) and explain why. Consider novelty, methodology quality, field relevance, and current research trends.",
    badge: "Impact AI"
  },
  {
    name: "🔗 Connection Mapper",
    description: "AI identifies how this paper connects to other work in your collection and broader field",
    prompt: "Identify how this paper connects to other research in the field. Highlight complementary studies, conflicting findings, and potential collaboration opportunities.",
    badge: "Connection AI"
  }
];


// Smart suggestions based on collection context
const getSmartSuggestions = (collectionName?: string, paperCount?: number) => {
  if (!collectionName || !paperCount) return [];
  
  const suggestions = [];
  
  // Based on collection name patterns
  if (collectionName.toLowerCase().includes('ml') || collectionName.toLowerCase().includes('machine learning')) {
    suggestions.push({
      name: "ML Method Analysis",
      prompt: "Analyze the machine learning methods used in this paper. Identify the algorithms, datasets, evaluation metrics, and compare performance with state-of-the-art approaches.",
      reason: "Detected ML/Machine Learning focus"
    });
  }
  
  if (collectionName.toLowerCase().includes('ai') || collectionName.toLowerCase().includes('artificial intelligence')) {
    suggestions.push({
      name: "AI Ethics & Impact",
      prompt: "Evaluate the ethical considerations and societal impact of the AI system described in this paper. Consider bias, fairness, transparency, and potential misuse.",
      reason: "Detected AI focus"
    });
  }
  
  if (collectionName.toLowerCase().includes('health') || collectionName.toLowerCase().includes('medical')) {
    suggestions.push({
      name: "Clinical Relevance",
      prompt: "Assess the clinical relevance and potential impact of this research on patient care. Consider regulatory requirements, implementation challenges, and evidence quality.",
      reason: "Detected healthcare focus"
    });
  }
  
  if (collectionName.toLowerCase().includes('security') || collectionName.toLowerCase().includes('cyber')) {
    suggestions.push({
      name: "Security Implications",
      prompt: "Analyze the security implications, vulnerabilities, and threat models discussed in this paper. Evaluate the effectiveness of proposed security measures.",
      reason: "Detected security focus"
    });
  }
  
  // Based on collection size
  if (paperCount > 50) {
    suggestions.push({
      name: "Trend Analysis",
      prompt: "How does this paper fit into the broader research trends in this field? Identify if it's following or challenging current paradigms.",
      reason: "Large collection - trend analysis valuable"
    });
  }
  
  if (paperCount > 20) {
    suggestions.push({
      name: "Citation Impact Prediction",
      prompt: "Predict the potential citation impact of this paper based on novelty, methodology quality, and relevance to current research directions. Rate likelihood of high impact.",
      reason: "Medium+ collection size"
    });
  }
  
  return suggestions.slice(0, 3); // Limit to 3 suggestions
};

export function AddAIColumnDialog({ onAddColumn, papers, collectionName, onAddAndGenerate }: AddAIColumnDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [autoGenerate, setAutoGenerate] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  
  const smartSuggestions = React.useMemo(
    () => getSmartSuggestions(collectionName, papers?.length),
    [collectionName, papers?.length]
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (name.trim() && prompt.trim()) {
      const column = {
        name: name.trim(),
        prompt: prompt.trim(),
        autoGenerate,
      };
      
      if (autoGenerate && onAddAndGenerate) {
        setIsGenerating(true);
        try {
          await onAddAndGenerate(column);
        } catch (error) {
          console.error('Error during auto-generation:', error);
          // Fall back to regular add if auto-generation fails
          onAddColumn(column);
        } finally {
          setIsGenerating(false);
        }
      } else {
        onAddColumn(column);
      }
      
      setName("");
      setPrompt("");
      setAutoGenerate(true);
      setOpen(false);
    }
  };

  const selectTemplate = (template: any) => {
    setName(template.name);
    setPrompt(template.prompt);
    // Auto-enable generation for all pre-made templates
    setAutoGenerate(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Brain className="h-4 w-4" />
          Add AI Column
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            Add AI Column
          </DialogTitle>
          <DialogDescription>
            Choose an AI feature to analyze your papers automatically. Each feature provides specialized insights.
            {collectionName && (
              <span className="block mt-1 text-sm font-medium text-blue-700">
                📚 &quot;{collectionName}&quot; collection • {papers?.length || 0} papers
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Smart Agent Suggestions */}
          {smartSuggestions.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-blue-800">
                  <Sparkles className="h-4 w-4" />
                  Recommended for Your Collection
                </CardTitle>
                <p className="text-sm text-blue-700 mt-1">AI-suggested based on your research focus</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {smartSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.name}
                      className={`flex items-start justify-between p-3 border border-blue-200 rounded-lg hover:bg-blue-100/50 cursor-pointer transition-colors ${
                        name === suggestion.name ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => selectTemplate(suggestion)}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm text-blue-900">{suggestion.name}</h4>
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                            Smart Pick
                          </Badge>
                        </div>
                        <p className="text-xs text-blue-700 font-medium">
                          {suggestion.reason}
                        </p>
                      </div>
                      <Button variant={name === suggestion.name ? "default" : "ghost"} size="sm">
                        {name === suggestion.name ? "✓ Selected" : "Select"}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Agent Columns */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4" />
                AI Analysis Features
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Specialized AI features that analyze different aspects of your papers</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {aiFeatures.map((column) => (
                  <div
                    key={column.name}
                    className={`flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${
                      name === column.name ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => selectTemplate(column)}
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{column.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {column.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {column.description}
                      </p>
                    </div>
                    <Button variant={name === column.name ? "default" : "ghost"} size="sm">
                      {name === column.name ? "✓ Selected" : "Select"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Custom Prompt Option */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wand2 className="h-4 w-4" />
                Create Custom Analysis
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Design your own AI analysis with a custom prompt</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="custom-name">Analysis Name</Label>
                  <Input
                    id="custom-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Innovation Score, Bias Detection..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quick Actions</Label>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setName("Quality Scorer");
                        setPrompt("Rate this paper&apos;s research quality from 1-10 considering methodology, sample size, statistical analysis, and reproducibility. Provide score and brief reasoning.");
                      }}
                    >
                      Quality Score
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setName("Key Takeaways");
                        setPrompt("Extract the 3 most important insights from this research. Focus on practical implications and novel findings.");
                      }}
                    >
                      Takeaways
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="custom-prompt">AI Instructions</Label>
                <Textarea
                  id="custom-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Tell the AI exactly what to analyze and how to respond..."
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  💡 Your agent will receive each paper&apos;s title, authors, abstract, and notes along with these instructions.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Auto-generation controls and preview */}
          {name && prompt && (
            <>
              <Card className="border-dashed border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                    <Lightbulb className="h-4 w-4" />
                    Ready to Deploy: {name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground bg-white p-3 rounded border">
                    {prompt.slice(0, 200)}{prompt.length > 200 && "..."}
                  </p>
                  
                  <div className="flex items-center space-x-3 p-4 border rounded-lg bg-white">
                    <input
                      type="checkbox"
                      id="auto-generate"
                      checked={autoGenerate}
                      onChange={(e) => setAutoGenerate(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="auto-generate" className="text-sm font-medium flex items-center gap-2 flex-1">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      Start analysis immediately for all {papers?.length || 0} papers
                    </label>
                  </div>
                  
                  {autoGenerate && !isGenerating && (
                    <div className="text-xs px-4 py-3 bg-blue-100 border border-blue-300 rounded flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-blue-800">The AI analysis will start immediately after creation. This typically takes 30-60 seconds per paper.</span>
                    </div>
                  )}
                  
                  {isGenerating && (
                    <div className="text-xs px-4 py-3 bg-yellow-100 border border-yellow-300 rounded flex items-center gap-2">
                      <Sparkles className="h-4 w-4 animate-pulse text-yellow-600" />
                      <span className="text-yellow-800">AI is analyzing {papers?.length || 0} papers... Keep this dialog open to monitor progress.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isGenerating}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!name.trim() || !prompt.trim() || isGenerating} size="lg">
                  {isGenerating ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                      Analyzing...
                    </>
                  ) : autoGenerate ? (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Start Analysis
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Analysis
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}