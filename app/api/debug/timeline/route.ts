import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Check if timeline_activities table exists
    const { data: tableExists, error: tableError } = await supabase
      .from('timeline_activities')
      .select('*')
      .limit(1);

    if (tableError) {
      return NextResponse.json({
        tableExists: false,
        error: tableError.message,
        code: tableError.code
      });
    }

    // Get a few sample activities to test
    const { data: activities, error: activitiesError } = await supabase
      .from('timeline_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (activitiesError) {
      return NextResponse.json({
        tableExists: true,
        activitiesError: activitiesError.message,
        activities: []
      });
    }

    return NextResponse.json({
      tableExists: true,
      activitiesCount: activities?.length || 0,
      activities: activities || [],
      message: 'Timeline table is working properly'
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to check timeline table',
      details: error.message
    }, { status: 500 });
  }
}