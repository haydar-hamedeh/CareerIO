-- CareerIO initial schema
-- Tables, enums, triggers. Row Level Security is in the next migration.

create extension if not exists vector with schema extensions;

-- Enums ---------------------------------------------------------------

create type public.user_role as enum ('candidate', 'employer');
create type public.work_mode as enum ('onsite', 'hybrid', 'remote');
create type public.seniority as enum ('intern', 'junior', 'mid', 'senior', 'lead');
create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'internship', 'temporary');
create type public.company_size as enum ('1-10', '11-50', '51-200', '201-1000', '1000+');
create type public.job_status as enum ('draft', 'open', 'closed', 'archived');
create type public.application_status as enum ('applied', 'in_review', 'interview', 'rejected', 'hired');
create type public.cv_parse_status as enum ('pending', 'parsed', 'failed');

-- Shared trigger: updated_at -----------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles (one per auth user) ---------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text check (char_length(full_name) <= 120),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Candidate details. Holds no name, gender, age, photo, nationality or religion:
-- these never enter matching or grading.

create table public.candidate_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  headline text check (char_length(headline) <= 160),
  summary text check (char_length(summary) <= 4000),
  location text check (char_length(location) <= 120),
  years_experience numeric(4, 1) check (years_experience >= 0 and years_experience <= 60),
  education jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  desired_roles text[] not null default '{}',
  work_modes public.work_mode[] not null default '{}',
  preferred_locations text[] not null default '{}',
  seniority public.seniority,
  salary_min integer check (salary_min >= 0),
  salary_max integer check (salary_max >= 0),
  salary_currency char(3),
  embedding extensions.vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_salary_range check (salary_min is null or salary_max is null or salary_min <= salary_max)
);

create trigger candidate_profiles_updated_at before update on public.candidate_profiles
  for each row execute function public.set_updated_at();

-- CV files (objects live in the private "cvs" storage bucket) ---------

create table public.cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) <= 255),
  mime_type text not null check (
    mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  ),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  content_hash text not null,
  parse_status public.cv_parse_status not null default 'pending',
  parsed jsonb,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index cvs_user_id_idx on public.cvs (user_id);
create unique index cvs_one_primary_per_user on public.cvs (user_id) where is_primary;

-- Companies -------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  size public.company_size,
  website text check (website is null or website ~* '^https?://'),
  description text check (char_length(description) <= 4000),
  location text check (char_length(location) <= 120),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_owner_unless_demo check (is_demo or owner_id is not null)
);

create index companies_owner_id_idx on public.companies (owner_id);

create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

-- Jobs ------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 140),
  description text not null check (char_length(description) <= 12000),
  requirements text[] not null default '{}',
  skills text[] not null default '{}',
  field text not null check (char_length(field) <= 60),
  seniority public.seniority not null,
  employment_type public.employment_type not null,
  work_mode public.work_mode not null,
  location text check (char_length(location) <= 120),
  salary_min integer check (salary_min >= 0),
  salary_max integer check (salary_max >= 0),
  salary_currency char(3),
  status public.job_status not null default 'draft',
  is_demo boolean not null default false,
  embedding extensions.vector(768),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_salary_range check (salary_min is null or salary_max is null or salary_min <= salary_max)
);

create index jobs_company_id_idx on public.jobs (company_id);
create index jobs_open_recent_idx on public.jobs (published_at desc) where status = 'open';
create index jobs_skills_idx on public.jobs using gin (skills);
create index jobs_embedding_idx on public.jobs using hnsw (embedding extensions.vector_cosine_ops);

create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- Saved jobs ------------------------------------------------------------

create table public.saved_jobs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index saved_jobs_job_id_idx on public.saved_jobs (job_id);

-- Applications ----------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  cv_id uuid references public.cvs (id) on delete set null,
  cover_letter text check (char_length(cover_letter) <= 6000),
  status public.application_status not null default 'applied',
  match_score smallint check (match_score between 0 and 100),
  match_explanation text check (char_length(match_explanation) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create index applications_candidate_id_idx on public.applications (candidate_id);
create index applications_cv_id_idx on public.applications (cv_id);

create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index application_notes_application_id_idx on public.application_notes (application_id);
create index application_notes_author_id_idx on public.application_notes (author_id);

-- CV grades (AI results, cached by CV content + prompt version) ---------

create table public.cv_grades (
  id uuid primary key default gen_random_uuid(),
  cv_id uuid not null references public.cvs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  score smallint not null check (score between 0 and 100),
  rubric jsonb not null,
  issues jsonb not null default '[]'::jsonb,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create index cv_grades_cv_id_idx on public.cv_grades (cv_id);
create index cv_grades_user_id_idx on public.cv_grades (user_id);
create index cv_grades_job_id_idx on public.cv_grades (job_id);

-- AI call log (observability). No PII, no CV text. Server-only. ---------

create table public.ai_calls (
  id bigint generated always as identity primary key,
  feature text not null,
  model text not null,
  latency_ms integer not null,
  input_tokens integer,
  output_tokens integer,
  est_cost_usd numeric(10, 6),
  ok boolean not null,
  error_code text,
  created_at timestamptz not null default now()
);

create index ai_calls_created_at_idx on public.ai_calls (created_at desc);

-- New user -> profile. Role comes from sign-up metadata, once, and is then
-- locked: users cannot change it (see column grants in the RLS migration).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  chosen public.user_role := case
    when requested = 'employer' then 'employer'::public.user_role
    else 'candidate'::public.user_role
  end;
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    chosen,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 120), '')
  );

  if chosen = 'candidate' then
    insert into public.candidate_profiles (user_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
