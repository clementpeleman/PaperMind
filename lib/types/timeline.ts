export interface TimelineActivity {
  id: string;
  type: 'paper_added' | 'status_changed' | 'ai_analysis' | 'note_added' | 'tag_added' | 'collection_changed';
  paperId: string;
  paperTitle: string;
  timestamp: Date;
  details: {
    oldValue?: string;
    newValue?: string;
    analysisType?: string;
    noteContent?: string;
    tags?: string[];
    collection?: string;
  };
}

export interface WeeklyProgress {
  weekStart: Date;
  weekEnd: Date;
  activities: TimelineActivity[];
  summary: {
    papersAdded: number;
    statusChanges: number;
    analysisCompleted: number;
    notesAdded: number;
    tagsAdded: number;
    collectionChanges: number;
  };
}

export interface TimelineData {
  weeks: WeeklyProgress[];
  totalActivities: number;
  currentStreak: number;
  longestStreak: number;
}