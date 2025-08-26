import { TimelineActivityType, TimelineActivity, TimelineActivityInsert } from '@/lib/database.types';

export interface LogActivityRequest {
  userId: string;
  paperId: string;
  activityType: TimelineActivityType;
  paperTitle: string;
  details?: Record<string, any>;
}

export interface TimelineActivityDetails {
  oldValue?: string;
  newValue?: string;
  analysisType?: string;
  columnName?: string;
  noteContent?: string;
  tags?: string[];
  collections?: string[];
  [key: string]: any;
}

export class TimelineActivityService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Log a timeline activity to the database
   */
  async logActivity(request: LogActivityRequest): Promise<{ success: boolean; activityId?: string; error?: string }> {
    try {
      console.log('📝 TimelineActivityService.logActivity called with:', {
        userId: request.userId,
        paperId: request.paperId,
        activityType: request.activityType,
        paperTitle: request.paperTitle.substring(0, 50) + '...',
        detailsKeys: Object.keys(request.details || {})
      });

      // Handle server-side calls by using absolute URL
      const isServerSide = typeof window === 'undefined';
      let url: string;
      
      if (this.baseUrl) {
        url = `${this.baseUrl}/api/timeline/activities`;
      } else if (isServerSide) {
        // On server-side, construct absolute URL
        const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL 
          ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
          : process.env.NEXT_PUBLIC_SITE_URL
          ? process.env.NEXT_PUBLIC_SITE_URL
          : 'http://localhost:3000';
        url = `${baseUrl}/api/timeline/activities`;
      } else {
        // Client-side can use relative URL
        url = `/api/timeline/activities`;
      }
      
      console.log('📝 TimelineActivityService - Making request to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();
      console.log('📄 Log activity API response:', {
        status: response.status,
        ok: response.ok,
        data: data
      });

      if (!response.ok) {
        console.error('❌ Log activity failed:', data);
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      console.log('✅ Activity logged successfully:', data.activityId);
      return {
        success: true,
        activityId: data.activityId
      };

    } catch (error) {
      console.error('💥 Error logging activity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get timeline activities for a user
   */
  async getActivities(userId: string, options?: {
    limit?: number;
    offset?: number;
    paperId?: string;
    activityTypes?: TimelineActivityType[];
    startDate?: string;
    endDate?: string;
  }): Promise<{ activities: TimelineActivity[]; totalCount: number; error?: string }> {
    try {
      console.log('🔍 TimelineActivityService.getActivities called for user:', userId, 'with options:', options);
      
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.paperId) params.append('paperId', options.paperId);
      if (options?.activityTypes) {
        options.activityTypes.forEach(type => params.append('activityTypes', type));
      }
      if (options?.startDate) params.append('startDate', options.startDate);
      if (options?.endDate) params.append('endDate', options.endDate);

      const url = this.baseUrl ? 
        `${this.baseUrl}/api/timeline/activities?${params.toString()}` : 
        `/api/timeline/activities?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'x-user-id': userId,
        },
      });
      
      const data = await response.json();
      console.log('📄 Get activities API response:', {
        status: response.status,
        ok: response.ok,
        activityCount: data.activities?.length || 0,
        totalCount: data.totalCount
      });

      if (!response.ok) {
        console.error('❌ Get activities failed:', data);
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      console.log('✅ Got activities:', data.activities.length, 'activities');
      return {
        activities: data.activities || [],
        totalCount: data.totalCount || 0
      };

    } catch (error) {
      console.error('💥 Error getting activities:', error);
      return {
        activities: [],
        totalCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get timeline activities grouped by week
   */
  async getWeeklyActivities(userId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ weeks: WeeklyActivityGroup[]; error?: string }> {
    try {
      console.log('📅 TimelineActivityService.getWeeklyActivities called for user:', userId);
      console.log('📅 User ID type:', typeof userId, 'Length:', userId?.length);
      
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const url = this.baseUrl ? 
        `${this.baseUrl}/api/timeline/activities/weekly?${params.toString()}` : 
        `/api/timeline/activities/weekly?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'x-user-id': userId,
        },
      });
      
      const data = await response.json();
      console.log('📄 Get weekly activities API response:', {
        status: response.status,
        ok: response.ok,
        weekCount: data.weeks?.length || 0
      });

      if (!response.ok) {
        console.error('❌ Get weekly activities failed:', data);
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      console.log('✅ Got weekly activities:', data.weeks.length, 'weeks');
      return {
        weeks: data.weeks || []
      };

    } catch (error) {
      console.error('💥 Error getting weekly activities:', error);
      return {
        weeks: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Helper methods for common activity types
   */
  async logPaperAdded(userId: string, paperId: string, paperTitle: string) {
    return this.logActivity({
      userId,
      paperId,
      activityType: 'paper_added',
      paperTitle,
      details: {}
    });
  }

  async logStatusChanged(userId: string, paperId: string, paperTitle: string, oldStatus: string, newStatus: string) {
    return this.logActivity({
      userId,
      paperId,
      activityType: 'status_changed',
      paperTitle,
      details: {
        oldValue: oldStatus,
        newValue: newStatus
      }
    });
  }

  async logAIAnalysisCompleted(userId: string, paperId: string, paperTitle: string, analysisType: string) {
    return this.logActivity({
      userId,
      paperId,
      activityType: 'ai_analysis_completed',
      paperTitle,
      details: {
        analysisType
      }
    });
  }

  async logAIColumnGenerated(userId: string, paperId: string, paperTitle: string, columnName: string) {
    return this.logActivity({
      userId,
      paperId,
      activityType: 'ai_column_generated',
      paperTitle,
      details: {
        columnName
      }
    });
  }

  async logNoteAdded(userId: string, paperId: string, paperTitle: string, noteContent: string) {
    return this.logActivity({
      userId,
      paperId,
      activityType: 'note_added',
      paperTitle,
      details: {
        noteContent: noteContent.substring(0, 100) // Truncate for storage
      }
    });
  }

  async logTagsAdded(userId: string, paperId: string, paperTitle: string, tags: string[]) {
    return this.logActivity({
      userId,
      paperId,
      activityType: 'tag_added',
      paperTitle,
      details: {
        tags
      }
    });
  }

  async logCollectionChanged(userId: string, paperId: string, paperTitle: string, collections: string[]) {
    return this.logActivity({
      userId,
      paperId,
      activityType: 'collection_changed',
      paperTitle,
      details: {
        collections
      }
    });
  }
}

// Helper interface for weekly grouped activities
export interface WeeklyActivityGroup {
  weekStart: string;
  weekEnd: string;
  activities: TimelineActivity[];
  summary: {
    papersAdded: number;
    statusChanges: number;
    analysisCompleted: number;
    notesAdded: number;
    tagsAdded: number;
    collectionChanges: number;
    columnsGenerated: number;
  };
}

// Default instance
export const timelineActivityService = new TimelineActivityService();