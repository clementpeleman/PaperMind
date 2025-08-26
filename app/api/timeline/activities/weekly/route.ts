import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database, TimelineActivity } from '@/lib/database.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WeeklyActivityGroup {
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

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // First day of the week (Sunday)
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getWeekEnd(weekStart: Date): Date {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

function groupActivitiesByWeek(activities: TimelineActivity[]): WeeklyActivityGroup[] {
  const weekMap = new Map<string, WeeklyActivityGroup>();

  activities.forEach(activity => {
    const activityDate = new Date(activity.created_at);
    const weekStart = getWeekStart(activityDate);
    const weekEnd = getWeekEnd(weekStart);
    const weekKey = weekStart.toISOString().split('T')[0]; // Use date as key

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        activities: [],
        summary: {
          papersAdded: 0,
          statusChanges: 0,
          analysisCompleted: 0,
          notesAdded: 0,
          tagsAdded: 0,
          collectionChanges: 0,
          columnsGenerated: 0
        }
      });
    }

    const week = weekMap.get(weekKey)!;
    week.activities.push(activity);

    // Update summary counts
    switch (activity.activity_type) {
      case 'paper_added':
        week.summary.papersAdded++;
        break;
      case 'status_changed':
        week.summary.statusChanges++;
        break;
      case 'ai_analysis_completed':
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
      case 'ai_column_generated':
        week.summary.columnsGenerated++;
        break;
    }
  });

  // Convert map to sorted array (most recent first)
  return Array.from(weekMap.values()).sort((a, b) => 
    new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = request.headers.get('x-user-id');
    
    console.log('🔍 Timeline weekly API - Received userId:', userId);
    console.log('🔍 Timeline weekly API - User ID type:', typeof userId, 'Length:', userId?.length);
    
    if (!userId) {
      console.log('❌ Timeline weekly API - Missing user ID in headers');
      return NextResponse.json(
        { error: 'Missing user ID in headers' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '1000'); // Get more activities to group by week
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get activities from the database
    console.log('🔍 Timeline weekly API - Querying database with userId:', userId);
    const { data: activities, error } = await supabase
      .from('timeline_activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    console.log('📊 Timeline weekly API - Query result:', {
      activitiesCount: activities?.length || 0,
      error: error?.message,
      sampleActivity: activities?.[0]
    });

    if (error) {
      console.error('Database error getting weekly activities:', error);
      return NextResponse.json(
        { error: 'Failed to get weekly activities' },
        { status: 500 }
      );
    }

    // Group activities by week
    const weeks = groupActivitiesByWeek(activities || []);

    // Limit the number of weeks returned
    const weekLimit = parseInt(searchParams.get('weekLimit') || '12'); // Last 12 weeks by default
    const limitedWeeks = weeks.slice(0, weekLimit);

    return NextResponse.json({
      weeks: limitedWeeks,
      totalWeeks: weeks.length
    });

  } catch (error) {
    console.error('Error in GET /api/timeline/activities/weekly:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}