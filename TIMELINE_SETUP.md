# Timeline Setup Instructions

The timeline feature requires a database table to store activity data. Here's how to set it up:

## 1. Database Migration

You need to run the SQL migration to create the `timeline_activities` table. The migration file is located at:
`database/migrations/create_timeline_activities.sql`

### Option A: Run via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `database/migrations/create_timeline_activities.sql`
4. Execute the query

### Option B: Run via CLI (if you have Supabase CLI installed)
```bash
supabase db push
```

## 2. What the Migration Creates

The migration creates:
- `timeline_activities` table with proper schema
- `timeline_activity_type` enum with all activity types
- Database function `log_timeline_activity()` for efficient logging
- Row-level security policies
- Performance indexes

## 3. Testing the Setup

After running the migration, you can test if it's working:

1. **Check table exists**: Visit `/api/debug/timeline` in your browser
2. **Add a paper**: Add a new paper to your library and check if timeline updates
3. **Check browser console**: Look for logs starting with 📊, 📅, 🔍 to see debugging info

## 4. Activity Types Tracked

The system tracks these activities:
- `paper_added` - When a paper is added to your library
- `status_changed` - When reading status changes (unread → reading → read → archived)  
- `ai_analysis_completed` - When AI analysis is completed on a paper
- `ai_column_generated` - When AI column content is generated
- `note_added` - When notes are added or updated
- `tag_added` - When tags are added to a paper
- `collection_changed` - When papers are added to collections

## 5. Troubleshooting

If the timeline isn't working:

1. **Check browser console** for error messages
2. **Visit `/api/debug/timeline`** to verify table exists
3. **Check network tab** in dev tools to see API calls
4. **Look for console logs** with timeline prefixes (📊, 📅, 🔍)

The debugging logs will help identify if the issue is:
- Missing database table
- Wrong user ID being used
- API request failures
- React Query caching issues

## 6. Expected Flow

When you add a paper, this should happen:
1. Paper is synced to database via `/api/papers/sync`
2. `timeline_activities` records are created
3. Timeline cache is invalidated
4. Timeline component refetches and shows new activities

The debugging logs will show each step of this process.