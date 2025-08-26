import { createClient } from '@supabase/supabase-js';
import { Database, TimelineActivityType, TimelineActivityInsert } from '@/lib/database.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface DirectLogActivityRequest {
  userId: string;
  paperId: string;
  activityType: TimelineActivityType;
  paperTitle: string;
  details?: Record<string, any>;
}

/**
 * Direct timeline activity service that uses Supabase client instead of HTTP calls
 * This is more efficient for server-side usage
 */
export class DirectTimelineActivityService {
  /**
   * Log a timeline activity directly to the database
   */
  async logActivity(request: DirectLogActivityRequest): Promise<{ success: boolean; activityId?: string; error?: string }> {
    try {
      console.log('📝 DirectTimelineActivityService.logActivity called with:', {
        userId: request.userId,
        paperId: request.paperId,
        activityType: request.activityType,
        paperTitle: request.paperTitle.substring(0, 50) + '...',
        detailsKeys: Object.keys(request.details || {})
      });

      // Use the database function directly
      const { data: activityId, error } = await supabase.rpc('log_timeline_activity', {
        p_user_id: request.userId,
        p_paper_id: request.paperId,
        p_activity_type: request.activityType,
        p_paper_title: request.paperTitle,
        p_details: request.details || {}
      });

      if (error) {
        console.error('❌ Direct timeline activity logging failed:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ Direct timeline activity logged successfully:', activityId);
      return {
        success: true,
        activityId: activityId
      };

    } catch (error) {
      console.error('💥 Error in direct timeline activity logging:', error);
      return {
        success: false,
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

// Default instance
export const directTimelineActivityService = new DirectTimelineActivityService();