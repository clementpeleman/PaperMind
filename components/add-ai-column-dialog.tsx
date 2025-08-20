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
import { Plus, Wand2 } from "lucide-react";
export type AIColumn = {
  id: string;
  name: string;
  prompt: string;
  isGenerating?: boolean;
};

interface AddAIColumnDialogProps {
  onAddColumn: (column: Omit<AIColumn, "id">) => void;
}

const promptSuggestions = [
  {
    name: "Summary",
    prompt: "Provide a concise 2-sentence summary of this research paper's main contribution and findings."
  },
  {
    name: "Key Insights",
    prompt: "List the 3 most important insights or takeaways from this research paper."
  },
  {
    name: "Methodology",
    prompt: "Describe the research methodology used in this paper in 1-2 sentences."
  },
  {
    name: "Relevance Score",
    prompt: "Rate the relevance of this paper to modern AI research on a scale of 1-10 and explain why."
  },
  {
    name: "Related Work",
    prompt: "Identify 2-3 key papers that this work builds upon or relates to."
  },
  {
    name: "Future Directions",
    prompt: "What are the main future research directions suggested by this paper?"
  }
];

export function AddAIColumnDialog({ onAddColumn }: AddAIColumnDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [prompt, setPrompt] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && prompt.trim()) {
      onAddColumn({
        name: name.trim(),
        prompt: prompt.trim(),
      });
      setName("");
      setPrompt("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add AI Column
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Add AI Column
          </DialogTitle>
          <DialogDescription>
            Create a custom column that uses AI to analyze each paper. The AI will process each paper using your prompt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Column Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Summary, Key Insights, Methodology..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">AI Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the prompt that will be sent to AI for each paper..."
              className="min-h-[100px]"
              required
            />
            <p className="text-xs text-muted-foreground">
              The AI will receive the paper&apos;s title, authors, abstract, and your prompt.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>Quick Start Templates</Label>
            <div className="grid grid-cols-2 gap-2">
              {promptSuggestions.map((suggestion) => (
                <Button
                  key={suggestion.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setName(suggestion.name);
                    setPrompt(suggestion.prompt);
                  }}
                  className="h-auto p-2 text-left justify-start"
                >
                  <div>
                    <div className="font-medium text-xs">{suggestion.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {suggestion.prompt.slice(0, 50)}...
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !prompt.trim()}>
              Add Column
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}