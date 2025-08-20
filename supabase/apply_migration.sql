-- Apply the Supabase Auth integration migration
-- This should be run in your Supabase SQL editor

-- Add supabase_user_id column to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS supabase_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create unique constraint on supabase_user_id
ALTER TABLE user_preferences 
ADD CONSTRAINT IF NOT EXISTS user_preferences_supabase_user_id_unique UNIQUE (supabase_user_id);

-- Make user_id nullable (since we're moving to supabase_user_id)
ALTER TABLE user_preferences 
ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies for Supabase Auth
DROP POLICY IF EXISTS "Users can view their own preferences via Supabase Auth" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences via Supabase Auth" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences via Supabase Auth" ON user_preferences;

-- New RLS policies using Supabase Auth
CREATE POLICY "Users can view their own preferences via Supabase Auth" 
  ON user_preferences FOR SELECT 
  USING (supabase_user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences via Supabase Auth" 
  ON user_preferences FOR INSERT 
  WITH CHECK (supabase_user_id = auth.uid());

CREATE POLICY "Users can update their own preferences via Supabase Auth" 
  ON user_preferences FOR UPDATE 
  USING (supabase_user_id = auth.uid());

-- Add comments
COMMENT ON COLUMN user_preferences.supabase_user_id IS 'Links to Supabase Auth users table';