-- Create enum for timeline activity types
CREATE TYPE timeline_activity_type AS ENUM (
  'paper_added',
  'status_changed', 
  'ai_analysis_completed',
  'note_added',
  'tag_added',
  'collection_changed',
  'ai_column_generated'
);

-- Create timeline_activities table
CREATE TABLE timeline_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  activity_type timeline_activity_type NOT NULL,
  paper_title TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_timeline_activities_user_id ON timeline_activities(user_id);
CREATE INDEX idx_timeline_activities_paper_id ON timeline_activities(paper_id);
CREATE INDEX idx_timeline_activities_activity_type ON timeline_activities(activity_type);
CREATE INDEX idx_timeline_activities_created_at ON timeline_activities(created_at DESC);
CREATE INDEX idx_timeline_activities_user_created ON timeline_activities(user_id, created_at DESC);

-- Add RLS policies
ALTER TABLE timeline_activities ENABLE ROW LEVEL SECURITY;

-- Users can only see their own timeline activities
CREATE POLICY "Users can view own timeline activities" ON timeline_activities
  FOR SELECT USING (user_id = auth.uid()::uuid);

-- Users can only insert their own timeline activities
CREATE POLICY "Users can insert own timeline activities" ON timeline_activities
  FOR INSERT WITH CHECK (user_id = auth.uid()::uuid);

-- Users can only update their own timeline activities
CREATE POLICY "Users can update own timeline activities" ON timeline_activities
  FOR UPDATE USING (user_id = auth.uid()::uuid);

-- Users can only delete their own timeline activities
CREATE POLICY "Users can delete own timeline activities" ON timeline_activities
  FOR DELETE USING (user_id = auth.uid()::uuid);

-- Create function to log timeline activities
CREATE OR REPLACE FUNCTION log_timeline_activity(
  p_user_id UUID,
  p_paper_id UUID,
  p_activity_type timeline_activity_type,
  p_paper_title TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO timeline_activities (user_id, paper_id, activity_type, paper_title, details)
  VALUES (p_user_id, p_paper_id, p_activity_type, p_paper_title, p_details)
  RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_timeline_activity(UUID, UUID, timeline_activity_type, TEXT, JSONB) TO authenticated;