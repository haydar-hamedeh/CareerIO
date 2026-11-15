-- AI features: richer CV grades, cached AI match scores, and semantic job search.

alter table public.cv_grades
  add column target_role text check (char_length(target_role) <= 160),
  add column checks jsonb not null default '[]'::jsonb,
  add column feedback jsonb not null default '{}'::jsonb;

create index cv_grades_lookup_idx on public.cv_grades (cv_id, prompt_version, target_role);

-- AI re-rank results per user and job, invalidated when the profile changes (profile_hash).
-- Written only by the server (service role); users can read their own.
create table public.ai_match_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  profile_hash text not null,
  score smallint not null check (score between 0 and 100),
  reason text not null check (char_length(reason) <= 300),
  model text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index ai_match_scores_job_id_idx on public.ai_match_scores (job_id);

alter table public.ai_match_scores enable row level security;
grant select on public.ai_match_scores to authenticated;

create policy "ai_match_scores: read own"
  on public.ai_match_scores for select to authenticated
  using (user_id = (select auth.uid()));

-- Cosine similarity between a query embedding and open jobs. Runs as the caller, so RLS applies.
create or replace function public.match_jobs(query_embedding extensions.vector(768), match_count integer default 50)
returns table (job_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select j.id, 1 - (j.embedding operator(extensions.<=>) query_embedding)
  from public.jobs j
  where j.status = 'open' and j.embedding is not null
  order by j.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 200);
$$;

revoke execute on function public.match_jobs(extensions.vector, integer) from public, anon;
grant execute on function public.match_jobs(extensions.vector, integer) to authenticated;
