-- Enable RLS (Row Level Security)
alter default privileges revoke execute on functions from public;

-- Create custom types
create type paper_status as enum ('unread', 'reading', 'read', 'archived');

-- Users table - custom user management instead of Supabase auth
create table users (
  id uuid default gen_random_uuid() primary key,
  
  -- Zotero integration
  zotero_user_id text unique not null,
  zotero_username text,
  
  -- User metadata
  email text,
  display_name text,
  avatar_url text,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_login timestamptz default now()
);

-- Papers table - stores user's papers from Zotero or manual entry
create table papers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  
  -- Core paper metadata
  title text not null,
  authors text[] default '{}',
  journal text,
  year integer,
  doi text,
  url text,
  
  -- Zotero integration fields
  zotero_key text,
  zotero_version integer,
  
  -- User-defined fields
  tags text[] default '{}',
  collections text[] default '{}',
  notes text default '',
  status paper_status default 'unread',
  
  -- Timestamps
  date_added timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Constraints
  unique(user_id, zotero_key)
);

-- AI columns table - stores user-defined AI analysis column definitions
create table ai_columns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  
  -- Column definition
  name text not null,
  prompt text not null,
  
  -- Configuration
  is_active boolean default true,
  sort_order integer default 0,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Constraints
  unique(user_id, name)
);

-- AI column values table - stores generated AI analysis for each paper/column combination
create table ai_column_values (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  paper_id uuid references papers(id) on delete cascade not null,
  ai_column_id uuid references ai_columns(id) on delete cascade not null,
  
  -- Generated content
  value text,
  
  -- Generation metadata
  generated_at timestamptz default now(),
  
  -- Constraints
  unique(user_id, paper_id, ai_column_id)
);

-- User preferences table - stores user settings and preferences
create table user_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null unique,
  
  -- Table display preferences
  row_height_preset text default 'comfortable',
  custom_row_height integer,
  column_widths jsonb default '{}',
  
  -- Zotero integration settings
  zotero_user_id text,
  zotero_api_key text,
  last_zotero_sync timestamptz,
  
  -- AI settings
  ai_provider text default 'openai',
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on all tables  
alter table users enable row level security;
alter table papers enable row level security;
alter table ai_columns enable row level security;
alter table ai_column_values enable row level security;
alter table user_preferences enable row level security;

-- Create function to get current user ID from session
create or replace function current_user_id()
returns uuid as $$
begin
  return current_setting('app.current_user_id', true)::uuid;
exception
  when others then
    return null;
end;
$$ language plpgsql security definer;

-- Create function to set current user ID for RLS
create or replace function set_current_user_id(user_id uuid)
returns void as $$
begin
  perform set_config('app.current_user_id', user_id::text, false);
end;
$$ language plpgsql security definer;

-- RLS policies for users table
create policy "Users can view their own profile" 
  on users for select 
  using (id = current_user_id());

create policy "Users can update their own profile" 
  on users for update 
  using (id = current_user_id());

-- RLS policies for papers table
create policy "Users can view their own papers" 
  on papers for select 
  using (user_id = current_user_id());

create policy "Users can insert their own papers" 
  on papers for insert 
  with check (user_id = current_user_id());

create policy "Users can update their own papers" 
  on papers for update 
  using (user_id = current_user_id());

create policy "Users can delete their own papers" 
  on papers for delete 
  using (user_id = current_user_id());

-- RLS policies for ai_columns table
create policy "Users can view their own AI columns" 
  on ai_columns for select 
  using (user_id = current_user_id());

create policy "Users can insert their own AI columns" 
  on ai_columns for insert 
  with check (user_id = current_user_id());

create policy "Users can update their own AI columns" 
  on ai_columns for update 
  using (user_id = current_user_id());

create policy "Users can delete their own AI columns" 
  on ai_columns for delete 
  using (user_id = current_user_id());

-- RLS policies for ai_column_values table
create policy "Users can view their own AI column values" 
  on ai_column_values for select 
  using (user_id = current_user_id());

create policy "Users can insert their own AI column values" 
  on ai_column_values for insert 
  with check (user_id = current_user_id());

create policy "Users can update their own AI column values" 
  on ai_column_values for update 
  using (user_id = current_user_id());

create policy "Users can delete their own AI column values" 
  on ai_column_values for delete 
  using (user_id = current_user_id());

-- RLS policies for user_preferences table
create policy "Users can view their own preferences" 
  on user_preferences for select 
  using (user_id = current_user_id());

create policy "Users can insert their own preferences" 
  on user_preferences for insert 
  with check (user_id = current_user_id());

create policy "Users can update their own preferences" 
  on user_preferences for update 
  using (user_id = current_user_id());

-- Create indexes for better performance
create index papers_user_id_idx on papers(user_id);
create index papers_zotero_key_idx on papers(zotero_key);
create index papers_date_added_idx on papers(date_added);
create index ai_columns_user_id_idx on ai_columns(user_id);
create index ai_column_values_user_id_idx on ai_column_values(user_id);
create index ai_column_values_paper_id_idx on ai_column_values(paper_id);
create index ai_column_values_ai_column_id_idx on ai_column_values(ai_column_id);

-- Create function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at timestamps
create trigger update_papers_updated_at before update on papers
  for each row execute function update_updated_at_column();

create trigger update_ai_columns_updated_at before update on ai_columns
  for each row execute function update_updated_at_column();

create trigger update_user_preferences_updated_at before update on user_preferences
  for each row execute function update_updated_at_column();