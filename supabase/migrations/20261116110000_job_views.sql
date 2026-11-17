-- Job views: one row per job seeker per job, so a person who opens a job ten times counts once.
-- The primary key enforces that; jobs.view_count is kept in step by a trigger so reading it is free.

alter table public.jobs
  add column view_count integer not null default 0 check (view_count >= 0);

create table public.job_views (
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (job_id, user_id)
);

create index job_views_user_id_idx on public.job_views (user_id);

alter table public.job_views enable row level security;

-- Job seekers can only record their own first view. Nobody reads the rows from the client; employers read the count on the job.
grant insert on public.job_views to authenticated;

create policy "job_views: candidate records own view"
  on public.job_views for insert to authenticated
  with check (user_id = (select auth.uid()) and private.app_role() = 'candidate');

create or replace function public.count_job_view()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.jobs set view_count = view_count + 1 where id = new.job_id;
  return new;
end;
$$;

revoke execute on function public.count_job_view() from public, anon, authenticated;

create trigger job_views_count
  after insert on public.job_views
  for each row execute function public.count_job_view();
