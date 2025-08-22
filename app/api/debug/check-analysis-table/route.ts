import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Try to query the paper_analysis table to see if it exists
    const { data, error } = await supabase
      .from('paper_analysis')
      .select('id')
      .limit(1);

    if (error) {
      return NextResponse.json({
        tableExists: false,
        error: error.message,
        code: error.code,
        details: error.details
      });
    }

    // Check if the custom functions exist
    const { data: functionData, error: functionError } = await supabase.rpc('get_paper_analysis_summary', {
      p_user_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      p_paper_id: '00000000-0000-0000-0000-000000000000'  // dummy UUID
    });

    return NextResponse.json({
      tableExists: true,
      functionsExist: !functionError,
      functionError: functionError?.message,
      message: 'paper_analysis table and functions are available'
    });

  } catch (error: any) {
    return NextResponse.json({
      tableExists: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}