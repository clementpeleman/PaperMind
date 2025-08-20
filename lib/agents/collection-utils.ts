/**
 * Collection Context Utilities
 * Helper functions for analyzing and creating collection context for agents
 */

import { Paper } from './base';
import { CollectionContext } from './schemas';

/**
 * Analyze a collection of papers to generate context for agents
 */
export function analyzeCollectionContext(
  collectionName: string, 
  papers: Paper[]
): CollectionContext {
  if (collectionName === "All Papers") {
    return {
      name: "All Papers",
      description: "Complete research paper collection spanning multiple domains",
      totalPapers: papers.length,
      commonTags: extractTopTags(papers, 10),
      researchFocus: "Multidisciplinary research across various domains"
    };
  }

  // Filter papers that belong to this collection
  const collectionPapers = papers.filter(paper => 
    paper.collections && paper.collections.includes(collectionName)
  );

  if (collectionPapers.length === 0) {
    return {
      name: collectionName,
      description: "Empty collection",
      totalPapers: 0,
      commonTags: [],
      researchFocus: "No papers available for analysis"
    };
  }

  // Extract common themes and focus areas
  const commonTags = extractTopTags(collectionPapers, 8);
  const researchFocus = inferResearchFocus(collectionPapers, collectionName);
  const description = generateCollectionDescription(collectionPapers, collectionName, commonTags);

  return {
    name: collectionName,
    description,
    totalPapers: collectionPapers.length,
    commonTags,
    researchFocus
  };
}

/**
 * Extract the most common tags from a collection of papers
 */
function extractTopTags(papers: Paper[], limit: number = 10): string[] {
  const tagCounts = new Map<string, number>();

  papers.forEach(paper => {
    paper.tags?.forEach(tag => {
      const normalizedTag = tag.toLowerCase().trim();
      if (normalizedTag && normalizedTag.length > 2) {
        tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
      }
    });
  });

  return Array.from(tagCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([tag]) => tag);
}

/**
 * Infer the primary research focus based on papers in the collection
 */
function inferResearchFocus(papers: Paper[], collectionName: string): string {
  const titleKeywords = extractKeywordsFromTitles(papers);
  const journalPatterns = extractJournalPatterns(papers);
  const temporalTrends = analyzeTemporalTrends(papers);
  
  // Combine insights to create research focus description
  const focusElements: string[] = [];
  
  // Add dominant keywords
  if (titleKeywords.length > 0) {
    focusElements.push(`Primary topics: ${titleKeywords.slice(0, 3).join(', ')}`);
  }
  
  // Add journal insights
  if (journalPatterns.length > 0) {
    const topJournal = journalPatterns[0];
    focusElements.push(`Primarily published in ${topJournal.name} (${topJournal.count} papers)`);
  }
  
  // Add temporal insights
  if (temporalTrends.recentYears.length > 0) {
    focusElements.push(`Recent focus years: ${temporalTrends.recentYears.join(', ')}`);
  }
  
  return focusElements.length > 0 
    ? focusElements.join('. ')
    : `Research collection focused on ${collectionName.toLowerCase()} domain`;
}

/**
 * Generate a descriptive summary of the collection
 */
function generateCollectionDescription(
  papers: Paper[], 
  collectionName: string, 
  commonTags: string[]
): string {
  const paperCount = papers.length;
  const uniqueAuthors = new Set(papers.flatMap(p => p.authors)).size;
  const yearRange = getYearRange(papers);
  const topTopics = commonTags.slice(0, 3).join(', ');

  let description = `Research collection "${collectionName}" containing ${paperCount} papers`;
  
  if (uniqueAuthors > 0) {
    description += ` from ${uniqueAuthors} unique authors`;
  }
  
  if (yearRange.min && yearRange.max) {
    description += ` spanning ${yearRange.min}-${yearRange.max}`;
  }
  
  if (topTopics) {
    description += `. Primary research areas include ${topTopics}`;
  }

  return description;
}

/**
 * Extract dominant keywords from paper titles
 */
function extractKeywordsFromTitles(papers: Paper[]): string[] {
  const wordCounts = new Map<string, number>();
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'by', 'on', 'at', 'to', 'in', 'of', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);

  papers.forEach(paper => {
    const words = paper.title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });

  return Array.from(wordCounts.entries())
    .filter(([, count]) => count > 1) // Only keywords that appear multiple times
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Extract journal publishing patterns
 */
function extractJournalPatterns(papers: Paper[]): Array<{ name: string; count: number }> {
  const journalCounts = new Map<string, number>();

  papers.forEach(paper => {
    if (paper.journal && paper.journal.trim()) {
      const journal = paper.journal.trim();
      journalCounts.set(journal, (journalCounts.get(journal) || 0) + 1);
    }
  });

  return Array.from(journalCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
}

/**
 * Analyze temporal trends in the collection
 */
function analyzeTemporalTrends(papers: Paper[]): {
  recentYears: number[];
  yearRange: { min: number; max: number };
  averageYear: number;
} {
  const years = papers
    .map(p => p.year)
    .filter(year => year && year > 1900 && year <= new Date().getFullYear())
    .sort((a, b) => b - a);

  if (years.length === 0) {
    return {
      recentYears: [],
      yearRange: { min: 0, max: 0 },
      averageYear: 0
    };
  }

  const yearCounts = new Map<number, number>();
  years.forEach(year => {
    yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
  });

  const recentYears = Array.from(yearCounts.entries())
    .sort(([, a], [, b]) => b - a) // Sort by count
    .slice(0, 3)
    .map(([year]) => year)
    .sort((a, b) => b - a); // Sort by year

  return {
    recentYears,
    yearRange: { min: Math.min(...years), max: Math.max(...years) },
    averageYear: Math.round(years.reduce((sum, year) => sum + year, 0) / years.length)
  };
}

/**
 * Get year range from papers
 */
function getYearRange(papers: Paper[]): { min?: number; max?: number } {
  const years = papers
    .map(p => p.year)
    .filter(year => year && year > 1900 && year <= new Date().getFullYear());

  if (years.length === 0) {
    return {};
  }

  return {
    min: Math.min(...years),
    max: Math.max(...years)
  };
}

/**
 * Create collection context for agent analysis
 */
export function createAgentCollectionContext(
  collectionName: string,
  allPapers: Paper[]
): CollectionContext {
  return analyzeCollectionContext(collectionName, allPapers);
}