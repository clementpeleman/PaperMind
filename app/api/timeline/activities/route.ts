import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database, TimelineActivityType } from '@/lib/database.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, paperId, activityType, paperTitle, details = {} } = body;

    // Validate required fields
    if (!userId || !paperId || !activityType || !paperTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, paperId, activityType, paperTitle' },
        { status: 400 }
      );
    }

    // Validate activity type
    const validActivityTypes: TimelineActivityType[] = [
      'paper_added',
      'status_changed',
      'ai_analysis_completed',
      'note_added',
      'tag_added',
      'collection_changed',
      'ai_column_generated'
    ];

    if (!validActivityTypes.includes(activityType)) {
      return NextResponse.json(
        { error: `Invalid activity type: ${activityType}` },
        { status: 400 }
      );
    }

    // Log the activity using the database function
    const { data, error } = await supabase.rpc('log_timeline_activity', {
      p_user_id: userId,
      p_paper_id: paperId,
      p_activity_type: activityType,
      p_paper_title: paperTitle,
      p_details: details
    });

    if (error) {
      console.error('Database error logging activity:', error);
      return NextResponse.json(
        { error: 'Failed to log activity' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      activityId: data
    });

  } catch (error) {
    console.error('Error in POST /api/timeline/activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user ID in headers' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const paperId = searchParams.get('paperId');
    const activityTypes = searchParams.getAll('activityTypes') as TimelineActivityType[];
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    let query = supabase
      .from('timeline_activities')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add filters
    if (paperId) {
      query = query.eq('paper_id', paperId);
    }

    if (activityTypes.length > 0) {
      query = query.in('activity_type', activityTypes);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: activities, error, count } = await query;

    if (error) {
      console.error('Database error getting activities:', error);
      return NextResponse.json(
        { error: 'Failed to get activities' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      activities: activities || [],
      totalCount: count || 0
    });

  } catch (error) {
    console.error('Error in GET /api/timeline/activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}