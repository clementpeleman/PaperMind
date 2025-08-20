-- Migration to integrate with Supabase Auth

-- Update users table to link with Supabase Auth
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS supabase_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS zotero_access_token text,
ADD COLUMN IF NOT EXISTS zotero_refresh_token text,
ADD COLUMN IF NOT EXISTS zotero_token_expires_at timestamptz;

-- Create unique constraint on supabase_user_id
ALTER TABLE users 
ADD CONSTRAINT users_supabase_user_id_unique UNIQUE (supabase_user_id);

-- Update user_preferences to use Supabase Auth user_id
-- First, let's create a new column
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS supabase_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create a function to migrate existing preferences
CREATE OR REPLACE FUNCTION migrate_user_preferences_to_supabase_auth()
RETURNS void AS $$
DECLARE
    pref_record RECORD;
    supabase_uid uuid;
BEGIN
    -- For each user_preferences record, try to link it to a supabase user
    FOR pref_record IN SELECT * FROM user_preferences WHERE supabase_user_id IS NULL LOOP
        -- Find the corresponding supabase_user_id from the users table
        SELECT supabase_user_id INTO supabase_uid 
        FROM users 
        WHERE id = pref_record.user_id 
        AND supabase_user_id IS NOT NULL;
        
        -- Update the preference record if we found a match
        IF supabase_uid IS NOT NULL THEN
            UPDATE user_preferences 
            SET supabase_user_id = supabase_uid 
            WHERE id = pref_record.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration function
SELECT migrate_user_preferences_to_supabase_auth();

-- Add unique constraint for supabase_user_id in preferences
ALTER TABLE user_preferences 
ADD CONSTRAINT user_preferences_supabase_user_id_unique UNIQUE (supabase_user_id);

-- Create RLS policies for Supabase Auth
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;  
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;

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

-- Comment explaining the new structure
COMMENT ON COLUMN users.supabase_user_id IS 'Links to Supabase Auth users table';
COMMENT ON COLUMN users.zotero_access_token IS 'Encrypted Zotero OAuth access token';
COMMENT ON COLUMN users.zotero_refresh_token IS 'Encrypted Zotero OAuth refresh token';
COMMENT ON COLUMN user_preferences.supabase_user_id IS 'Links to Supabase Auth users table';