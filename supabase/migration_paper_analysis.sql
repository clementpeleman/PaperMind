-- Migration to add paper_analysis table for storing comprehensive AI paper analysis
-- This extends the existing schema to support saving analysis results from the paper analyzer agent

-- Create analysis_type enum for different types of analysis
create type analysis_type as enum (
  'overview', 
  'methodology', 
  'findings', 
  'assessment', 
  'impact', 
  'personal',
  'custom'
);

-- Paper analysis table - stores comprehensive AI analysis results for papers
create table paper_analysis (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  paper_id uuid references papers(id) on delete cascade not null,
  
  -- Analysis identification
  analysis_type analysis_type not null,
  analysis_title text not null,
  
  -- Analysis content and metadata
  content text not null,
  prompt_used text,
  confidence_score numeric(3,2), -- 0.00 to 1.00 scale
  
  -- Processing metadata
  processing_time_ms integer,
  chunks_used integer,
  model_used text default 'gpt-4',
  
  -- Status and versioning
  version integer default 1,
  is_active boolean default true,
  
  -- Timestamps
  generated_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Constraints
  unique(user_id, paper_id, analysis_type, version)
);

-- Enable RLS on paper_analysis table
alter table paper_analysis enable row level security;

-- RLS policies for paper_analysis table
create policy "Users can view their own paper analysis" 
  on paper_analysis for select 
  using (user_id = current_user_id());

create policy "Users can insert their own paper analysis" 
  on paper_analysis for insert 
  with check (user_id = current_user_id());

create policy "Users can update their own paper analysis" 
  on paper_analysis for update 
  using (user_id = current_user_id());

create policy "Users can delete their own paper analysis" 
  on paper_analysis for delete 
  using (user_id = current_user_id());

-- Create indexes for better performance
create index paper_analysis_user_id_idx on paper_analysis(user_id);
create index paper_analysis_paper_id_idx on paper_analysis(paper_id);
create index paper_analysis_type_idx on paper_analysis(analysis_type);
create index paper_analysis_active_idx on paper_analysis(is_active) where is_active = true;
create index paper_analysis_generated_at_idx on paper_analysis(generated_at);

-- Create trigger for updated_at timestamp
create trigger update_paper_analysis_updated_at before update on paper_analysis
  for each row execute function update_updated_at_column();

-- Function to get the latest analysis for a paper/type combination
create or replace function get_latest_paper_analysis(
  p_user_id uuid,
  p_paper_id uuid,
  p_analysis_type analysis_type
)
returns table (
  id uuid,
  content text,
  confidence_score numeric,
  generated_at timestamptz,
  version integer
) as $$
begin
  return query
  select 
    pa.id,
    pa.content,
    pa.confidence_score,
    pa.generated_at,
    pa.version
  from paper_analysis pa
  where pa.user_id = p_user_id
    and pa.paper_id = p_paper_id
    and pa.analysis_type = p_analysis_type
    and pa.is_active = true
  order by pa.version desc
  limit 1;
end;
$$ language plpgsql security definer;

-- Function to save new analysis (handles versioning)
create or replace function save_paper_analysis(
  p_user_id uuid,
  p_paper_id uuid,
  p_analysis_type analysis_type,
  p_analysis_title text,
  p_content text,
  p_prompt_used text default null,
  p_confidence_score numeric default null,
  p_processing_time_ms integer default null,
  p_chunks_used integer default null,
  p_model_used text default 'gpt-4'
)
returns uuid as $$
declare
  v_next_version integer;
  v_analysis_id uuid;
begin
  -- Get next version number
  select coalesce(max(version), 0) + 1
  into v_next_version
  from paper_analysis
  where user_id = p_user_id
    and paper_id = p_paper_id
    and analysis_type = p_analysis_type;
  
  -- Insert new analysis
  insert into paper_analysis (
    user_id,
    paper_id,
    analysis_type,
    analysis_title,
    content,
    prompt_used,
    confidence_score,
    processing_time_ms,
    chunks_used,
    model_used,
    version
  ) values (
    p_user_id,
    p_paper_id,
    p_analysis_type,
    p_analysis_title,
    p_content,
    p_prompt_used,
    p_confidence_score,
    p_processing_time_ms,
    p_chunks_used,
    p_model_used,
    v_next_version
  )
  returning id into v_analysis_id;
  
  return v_analysis_id;
end;
$$ language plpgsql security definer;

-- Function to get all analysis for a paper
create or replace function get_paper_analysis_summary(
  p_user_id uuid,
  p_paper_id uuid
)
returns table (
  analysis_type analysis_type,
  analysis_title text,
  content text,
  confidence_score numeric,
  generated_at timestamptz,
  version integer,
  model_used text
) as $$
begin
  return query
  select 
    pa.analysis_type,
    pa.analysis_title,
    pa.content,
    pa.confidence_score,
    pa.generated_at,
    pa.version,
    pa.model_used
  from paper_analysis pa
  where pa.user_id = p_user_id
    and pa.paper_id = p_paper_id
    and pa.is_active = true
    and pa.version = (
      select max(pa2.version)
      from paper_analysis pa2
      where pa2.user_id = pa.user_id
        and pa2.paper_id = pa.paper_id
        and pa2.analysis_type = pa.analysis_type
        and pa2.is_active = true
    )
  order by pa.analysis_type;
end;
$$ language plpgsql security definer;