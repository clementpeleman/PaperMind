import { useMemo } from 'react';
import { Paper } from '@/components/papers-table';
import { TimelineActivity, WeeklyProgress, TimelineData } from '@/lib/types/timeline';

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // First day of the week (Sunday)
  return new Date(d.setDate(diff));
};

const getWeekEnd = (weekStart: Date): Date => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return weekEnd;
};

const formatWeekKey = (date: Date): string => {
  const weekStart = getWeekStart(date);
  return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
};

export const useTimelineData = (papers: Paper[]): TimelineData => {
  return useMemo(() => {
    const activities: TimelineActivity[] = [];
    const weekMap = new Map<string, WeeklyProgress>();
    
    // Generate activities from papers
    papers.forEach(paper => {
      // Paper added activity
      if (paper.dateAdded) {
        const addedDate = new Date(paper.dateAdded);
        activities.push({
          id: `${paper.id}-added`,
          type: 'paper_added',
          paperId: paper.id,
          paperTitle: paper.title,
          timestamp: addedDate,
          details: {}
        });
      }
      
      // Status change activities (simulated based on current status)
      if (paper.status !== 'unread') {
        const statusDate = paper.dateAdded ? new Date(paper.dateAdded) : new Date();
        // Add some days based on status to simulate reading progression
        const daysOffset = paper.status === 'reading' ? 1 : 
                          paper.status === 'read' ? 3 : 
                          paper.status === 'archived' ? 7 : 0;
        statusDate.setDate(statusDate.getDate() + daysOffset);
        
        activities.push({
          id: `${paper.id}-status-${paper.status}`,
          type: 'status_changed',
          paperId: paper.id,
          paperTitle: paper.title,
          timestamp: statusDate,
          details: {
            oldValue: 'unread',
            newValue: paper.status
          }
        });
      }
      
      // AI analysis activities (simulated)
      if (paper.aiColumns && Object.keys(paper.aiColumns).length > 0) {
        Object.keys(paper.aiColumns).forEach((columnId, index) => {
          const analysisDate = paper.dateAdded ? new Date(paper.dateAdded) : new Date();
          analysisDate.setDate(analysisDate.getDate() + index + 2); // Stagger analysis dates
          
          activities.push({
            id: `${paper.id}-analysis-${columnId}`,
            type: 'ai_analysis',
            paperId: paper.id,
            paperTitle: paper.title,
            timestamp: analysisDate,
            details: {
              analysisType: columnId
            }
          });
        });
      }
      
      // Note activities (if notes exist)
      if (paper.notes && paper.notes.trim()) {
        const noteDate = paper.dateAdded ? new Date(paper.dateAdded) : new Date();
        noteDate.setDate(noteDate.getDate() + 1);
        
        activities.push({
          id: `${paper.id}-note`,
          type: 'note_added',
          paperId: paper.id,
          paperTitle: paper.title,
          timestamp: noteDate,
          details: {
            noteContent: paper.notes.substring(0, 100) + (paper.notes.length > 100 ? '...' : '')
          }
        });
      }
      
      // Tag activities
      if (paper.tags && paper.tags.length > 0) {
        const tagDate = paper.dateAdded ? new Date(paper.dateAdded) : new Date();
        
        activities.push({
          id: `${paper.id}-tags`,
          type: 'tag_added',
          paperId: paper.id,
          paperTitle: paper.title,
          timestamp: tagDate,
          details: {
            tags: paper.tags
          }
        });
      }
      
      // Collection activities
      if (paper.collections && paper.collections.length > 0) {
        paper.collections.forEach((collection, index) => {
          const collectionDate = paper.dateAdded ? new Date(paper.dateAdded) : new Date();
          collectionDate.setHours(collectionDate.getHours() + index); // Stagger by hours
          
          activities.push({
            id: `${paper.id}-collection-${collection}`,
            type: 'collection_changed',
            paperId: paper.id,
            paperTitle: paper.title,
            timestamp: collectionDate,
            details: {
              collection
            }
          });
        });
      }
    });
    
    // Sort activities by timestamp
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Group activities by week
    activities.forEach(activity => {
      const weekKey = formatWeekKey(activity.timestamp);
      
      if (!weekMap.has(weekKey)) {
        const weekStart = getWeekStart(activity.timestamp);
        const weekEnd = getWeekEnd(weekStart);
        
        weekMap.set(weekKey, {
          weekStart,
          weekEnd,
          activities: [],
          summary: {
            papersAdded: 0,
            statusChanges: 0,
            analysisCompleted: 0,
            notesAdded: 0,
            tagsAdded: 0,
            collectionChanges: 0
          }
        });
      }
      
      const week = weekMap.get(weekKey)!;
      week.activities.push(activity);
      
      // Update summary
      switch (activity.type) {
        case 'paper_added':
          week.summary.papersAdded++;
          break;
        case 'status_changed':
          week.summary.statusChanges++;
          break;
        case 'ai_analysis':
          week.summary.analysisCompleted++;
          break;
        case 'note_added':
          week.summary.notesAdded++;
          break;
        case 'tag_added':
          week.summary.tagsAdded++;
          break;
        case 'collection_changed':
          week.summary.collectionChanges++;
          break;
      }
    });
    
    // Convert map to sorted array (most recent first)
    const weeks = Array.from(weekMap.values()).sort((a, b) => 
      b.weekStart.getTime() - a.weekStart.getTime()
    );
    
    // Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date();
    const currentWeekStart = getWeekStart(today);
    
    for (const week of weeks.reverse()) { // Process chronologically for streak calculation
      const hasActivity = week.activities.length > 0;
      
      if (hasActivity) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
        
        // Check if this week or last week to maintain current streak
        const weeksDiff = Math.floor((currentWeekStart.getTime() - week.weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeksDiff <= 1) {
          currentStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }
    
    weeks.reverse(); // Back to most recent first
    
    return {
      weeks,
      totalActivities: activities.length,
      currentStreak,
      longestStreak
    };
  }, [papers]);
};