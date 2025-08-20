"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Paper } from "@/components/papers-table";

interface CollectionSelectorProps {
  papers: Paper[];
  selectedCollection: string;
  onCollectionChange: (collection: string) => void;
  isLoading?: boolean;
}

export function CollectionSelector({ 
  papers, 
  selectedCollection, 
  onCollectionChange, 
  isLoading 
}: CollectionSelectorProps) {
  // Extract unique collections from papers
  const collections = React.useMemo(() => {
    const allCollections = new Set<string>();
    
    // Add "All Papers" as the default option
    allCollections.add("All Papers");
    
    // Extract collections from all papers
    papers.forEach(paper => {
      if (paper.collections && paper.collections.length > 0) {
        paper.collections.forEach(collection => {
          if (collection && collection.trim()) {
            allCollections.add(collection);
          }
        });
      }
    });
    
    return Array.from(allCollections).sort((a, b) => {
      // Keep "All Papers" at the top
      if (a === "All Papers") return -1;
      if (b === "All Papers") return 1;
      return a.localeCompare(b);
    });
  }, [papers]);

  // Get paper count for selected collection
  const getCollectionCount = React.useCallback((collection: string) => {
    if (collection === "All Papers") {
      return papers.length;
    }
    return papers.filter(paper => 
      paper.collections && paper.collections.includes(collection)
    ).length;
  }, [papers]);

  // Get collection description for AI context
  const getCollectionDescription = React.useCallback((collection: string) => {
    if (collection === "All Papers") {
      return "General research paper collection";
    }
    
    // Analyze papers in the collection to generate a description
    const collectionPapers = papers.filter(paper => 
      paper.collections && paper.collections.includes(collection)
    );
    
    if (collectionPapers.length === 0) {
      return "Empty collection";
    }
    
    // Extract common themes from titles and tags
    const allTags = new Set<string>();
    const commonKeywords = new Set<string>();
    
    collectionPapers.forEach(paper => {
      // Add tags
      paper.tags?.forEach(tag => allTags.add(tag.toLowerCase()));
      
      // Extract keywords from title
      const titleWords = paper.title.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4) // Only meaningful words
        .filter(word => !/^(the|and|for|with|from|into|by|on|at|to|in|of|a|an)$/.test(word));
      
      titleWords.forEach(word => commonKeywords.add(word));
    });
    
    const topTags = Array.from(allTags).slice(0, 3).join(", ");
    const topKeywords = Array.from(commonKeywords).slice(0, 3).join(", ");
    
    return `Research collection focusing on ${topTags || topKeywords || "various topics"}`;
  }, [papers]);

  const selectedCount = getCollectionCount(selectedCollection);
  const selectedDescription = getCollectionDescription(selectedCollection);

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto p-0 flex items-center gap-2 hover:bg-transparent">
              <div className="text-left">
                <h2 className="text-3xl font-medium tracking-tight flex items-center gap-2">
                  {selectedCollection}
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedDescription} • {selectedCount} papers
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Select Collection</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {collections.map((collection) => {
              const count = getCollectionCount(collection);
              return (
                <DropdownMenuItem
                  key={collection}
                  onClick={() => onCollectionChange(collection)}
                  className={`cursor-pointer ${
                    selectedCollection === collection ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate flex-1">{collection}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {count} papers
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })}
            {collections.length === 1 && (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground">No collections found</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}