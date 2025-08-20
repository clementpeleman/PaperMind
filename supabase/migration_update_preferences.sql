-- Migration to update user_preferences table for template-based preferences system

-- Add new columns to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS column_visibility jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_columns jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS generated_content jsonb DEFAULT '{}';

-- Update existing data to use new structure if needed
UPDATE user_preferences 
SET 
  column_visibility = COALESCE(column_visibility, '{}'),
  ai_columns = COALESCE(ai_columns, '[]'),
  generated_content = COALESCE(generated_content, '{}')
WHERE 
  column_visibility IS NULL 
  OR ai_columns IS NULL 
  OR generated_content IS NULL;

-- Add comment explaining the new fields
COMMENT ON COLUMN user_preferences.column_visibility IS 'JSON object storing which columns are visible in the papers table';
COMMENT ON COLUMN user_preferences.ai_columns IS 'JSON array storing user-defined AI column definitions';
COMMENT ON COLUMN user_preferences.generated_content IS 'JSON object storing generated AI content for papers, keyed by paper_id and column_id';