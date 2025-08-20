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
import { ArrowUpDown, ChevronDown, MoreHorizontal, Edit, Trash, ExternalLink, Sparkles, Loader2, Maximize2, GripVertical } from "lucide-react";

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
import { AddAIColumnDialog } from "./add-ai-column-dialog";
import { CustomHeightDialog } from "./custom-height-dialog";
import { useTemplatePreferences } from "@/hooks/use-template-preferences";
import { useZoteroAuth } from "@/hooks/use-zotero-auth";

export type Paper = {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  doi?: string;
  tags: string[];
  notes: string;
  dateAdded: string;
  collections: string[];
  status: "unread" | "reading" | "read" | "archived";
  url?: string;
  zoteroKey?: string;
  zoteroVersion?: number;
  itemType?: string;
  aiColumns?: Record<string, string>;
};

export type AIColumn = {
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


export const createColumns = (
  aiColumns: AIColumn[], 
  onGenerateIndividual: (columnId: string, paperId: string) => void,
  onGenerateBulk: (columnId: string) => void,
  generatingStates: Record<string, boolean>,
  bulkGeneratingStates: Record<string, boolean>,
  generationErrors: Record<string, string>,
  expandedTags: Set<string>,
  setExpandedTags: (expandedTags: Set<string>) => void,
  minimizedRows: Set<string>,
  setMinimizedRows: (minimizedRows: Set<string>) => void
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
    id: "minimize",
    header: () => (
      <div className="flex items-center justify-center">
        <button
          onClick={() => {
            // Toggle all rows at once
            if (minimizedRows.size > 0) {
              setMinimizedRows(new Set());
            } else {
              // We'll need access to all row IDs here, but for now just clear
              setMinimizedRows(new Set());
            }
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Toggle all rows"
        >
          ⇅
        </button>
      </div>
    ),
    cell: ({ row }) => {
      const rowId = row.id;
      const isMinimized = minimizedRows.has(rowId);
      
      const toggleMinimized = () => {
        const newMinimized = new Set(minimizedRows);
        if (isMinimized) {
          newMinimized.delete(rowId);
        } else {
          newMinimized.add(rowId);
        }
        setMinimizedRows(newMinimized);
      };

      return (
        <div className="flex items-center justify-center">
          <button
            onClick={toggleMinimized}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors p-1"
            title={isMinimized ? "Expand row" : "Minimize row"}
          >
            {isMinimized ? "⇓" : "⇑"}
          </button>
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    minSize: 30,
    maxSize: 30,
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
          Title
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      </div>
    ),
    cell: ({ row }) => {
      const itemType = row.original.itemType;
      const rowId = row.id;
      const isMinimized = minimizedRows.has(rowId);
      
      const getItemTypeColor = (type?: string) => {
        switch (type) {
          case 'webpage': return 'bg-blue-100 text-blue-800';
          case 'blogPost': return 'bg-green-100 text-green-800';
          case 'book': return 'bg-purple-100 text-purple-800';
          case 'thesis': return 'bg-orange-100 text-orange-800';
          case 'report': return 'bg-yellow-100 text-yellow-800';
          default: return 'bg-gray-100 text-gray-800';
        }
      };
      
      const title = row.getValue("title") as string;
      const displayTitle = isMinimized && title.length > 80 
        ? title.substring(0, 80) + "..." 
        : title;
      
      return (
        <div className="w-full">
          <div className="font-medium text-sm leading-tight mb-1" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', hyphens: 'auto' }}>
            {displayTitle}
          </div>
          {!isMinimized && itemType && itemType !== 'journalArticle' && (
            <div className="mb-1">
              <Badge className={`text-xs px-1.5 py-0.5 ${getItemTypeColor(itemType)}`} variant="outline">
                {itemType === 'webpage' ? 'Web' : 
                 itemType === 'blogPost' ? 'Blog' :
                 itemType === 'bookSection' ? 'Chapter' :
                 itemType === 'conferencePaper' ? 'Paper' :
                 itemType === 'journalArticle' ? 'Article' :
                 itemType}
              </Badge>
            </div>
          )}
          {!isMinimized && (
            <div className="text-xs text-muted-foreground" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {row.original.authors.slice(0, 2).join(", ")}
              {row.original.authors.length > 2 && ` +${row.original.authors.length - 2} more`}
            </div>
          )}
        </div>
      );
    },
    minSize: 150,
    size: 350,
  },
  {
    accessorKey: "journal",
    header: ({ column }) => (
      <div className="flex items-center justify-start">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-0 font-medium text-left justify-start"
        >
          Journal
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      </div>
    ),
    cell: ({ row }) => (
      <div className="w-full">
        <div className="text-sm" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{row.getValue("journal")}</div>
        <div className="text-xs text-muted-foreground">{row.original.year}</div>
      </div>
    ),
    minSize: 80,
    size: 160,
  },
  {
    accessorKey: "tags",
    header: () => (
      <div className="flex items-center justify-start">
        <span className="font-medium">Tags</span>
      </div>
    ),
    cell: ({ row }) => {
      const tags = row.getValue("tags") as string[];
      const rowId = row.id;
      const isExpanded = expandedTags.has(rowId);
      
      const toggleExpanded = () => {
        const newExpanded = new Set(expandedTags);
        if (isExpanded) {
          newExpanded.delete(rowId);
        } else {
          newExpanded.add(rowId);
        }
        setExpandedTags(newExpanded);
      };

      return (
        <div className="flex flex-wrap gap-1 w-full">
          {(isExpanded ? tags : tags.slice(0, 2)).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs px-1 py-0 break-words">
              {tag}
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge 
              variant="outline" 
              className="text-xs px-1 py-0 cursor-pointer hover:bg-accent transition-colors"
              onClick={toggleExpanded}
            >
              {isExpanded ? 'Show less' : `+${tags.length - 2}`}
            </Badge>
          )}
        </div>
      );
    },
    minSize: 60,
    size: 120,
  },
  ...aiColumns.map((aiColumn): ColumnDef<Paper> => ({
    id: `ai-${aiColumn.id}`,
    header: ({ column }) => (
      <div className="flex items-center justify-start gap-1 w-full">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-0 font-medium text-left justify-start flex-1"
        >
          {aiColumn.name}
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onGenerateBulk(aiColumn.id)}
          disabled={bulkGeneratingStates[aiColumn.id]}
          className="h-6 w-6 p-0 flex-shrink-0"
          title={`Generate ${aiColumn.name} for all papers`}
        >
          {bulkGeneratingStates[aiColumn.id] ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
        </Button>
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
      const paper = row.original;
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
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
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

interface PapersTableProps {
  papers: Paper[];
  isLoading?: boolean;
  error?: string | null;
}

export function PapersTable({ papers, isLoading, error }: PapersTableProps) {
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
  const [aiColumns, setAiColumns] = React.useState<AIColumn[]>([]);
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
        
        const column: AIColumn = {
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
      } else {
        console.error('Failed to create AI column');
      }
    } catch (error) {
      console.error('Error creating AI column:', error);
      // Reset the flag on error too
      setIsAddingColumn(false);
    }
  };

  const generateAiContent = async (columnId: string, paperId: string) => {
    // Find the paper data
    const paper = papers.find(p => p.id === paperId);
    if (!paper) {
      throw new Error('Paper not found');
    }

    // Find the AI column to get the prompt
    const aiColumn = aiColumns.find(col => col.id === columnId);
    if (!aiColumn) {
      throw new Error('AI column not found');
    }

    try {
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
    } catch (error) {
      console.error('Error calling AI API:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to generate AI content');
    }
  };

  const handleGenerateIndividual = React.useCallback(async (columnId: string, paperId: string) => {
    const key = `${columnId}-${paperId}`;
    setGeneratingStates(prev => ({ ...prev, [key]: true }));
    // Clear any previous error for this cell
    setGenerationErrors(prev => ({ ...prev, [key]: '' }));
    
    try {
      const content = await generateAiContent(columnId, paperId);
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

  const columns = React.useMemo(
    () => createColumns(aiColumns, handleGenerateIndividual, handleGenerateBulk, generatingStates, bulkGeneratingStates, generationErrors, expandedTags, setExpandedTags, minimizedRows, setMinimizedRows), 
    [aiColumns, generatingStates, bulkGeneratingStates, generationErrors, expandedTags, minimizedRows, handleGenerateBulk, handleGenerateIndividual]
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
        <AddAIColumnDialog onAddColumn={addAiColumn} />
        
        {/* Temporary Debug Button */}
        {/* <Button 
          variant="outline" 
          size="sm" 
          onClick={async () => {
            const headers: Record<string, string> = {};
            if (userId) headers['x-zotero-user-id'] = userId;
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            try {
              const response = await fetch('/api/debug/ai-columns', { headers });
              const data = await response.json();
              console.log('🔍 DEBUG DATA:', data);
              alert('Debug data logged to console - check F12');
            } catch (error) {
              console.error('Debug error:', error);
            }
          }}
        >
          Debug DB
        </Button> */}
        
        {/* Test AI Column Save */}
        {/* <Button 
          variant="outline" 
          size="sm" 
          onClick={async () => {
            const headers: Record<string, string> = {'Content-Type': 'application/json'};
            if (userId) headers['x-zotero-user-id'] = userId;
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            try {
              const response = await fetch('/api/debug/test-ai-column', { 
                method: 'POST',
                headers 
              });
              const data = await response.json();
              console.log('🧪 TEST RESULT:', data);
              alert('Test result logged to console - check F12 and terminal');
            } catch (error) {
              console.error('Test error:', error);
            }
          }}
        >
          Test Save
        </Button> */}
        
        {/* Note: All preferences are now auto-saved to Supabase */}
        
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
                <TableRow
                  key={row.id}
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