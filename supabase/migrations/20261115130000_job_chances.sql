-- Optional AI "chance" estimate (0-10) per candidate and job. Cached by input hash.
-- Written only by the server (service role); candidates read their own.
create table public.job_chances (
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  input_hash text not null,
  score smallint not null check (score between 0 and 10),
  result jsonb not null,
  model text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index job_chances_job_id_idx on public.job_chances (job_id);

alter table public.job_chances enable row level security;
grant select on public.job_chances to authenticated;

create policy "job_chances: read own"
  on public.job_chances for select to authenticated
  using (user_id = (select auth.uid()));
