-- CareerIO Row Level Security, privileges and private CV storage.
-- Rule of thumb: users see their own data; employers see applicants only for
-- jobs their company posted; the AI call log is server-only.

-- Helper functions (security definer so policies don't recurse through RLS) --

create or replace function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.owns_company(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies c
    where c.id = cid and c.owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_job(jid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = jid and c.owner_id = (select auth.uid())
  );
$$;

create or replace function public.applied_to_my_jobs(candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.candidate_id = candidate and c.owner_id = (select auth.uid())
  );
$$;

create or replace function public.cv_in_my_applications(cv uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.cv_id = cv and c.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.app_role() from public, anon;
revoke execute on function public.owns_company(uuid) from public, anon;
revoke execute on function public.owns_job(uuid) from public, anon;
revoke execute on function public.applied_to_my_jobs(uuid) from public, anon;
revoke execute on function public.cv_in_my_applications(uuid) from public, anon;
grant execute on function public.app_role() to authenticated;
grant execute on function public.owns_company(uuid) to authenticated;
grant execute on function public.owns_job(uuid) to authenticated;
grant execute on function public.applied_to_my_jobs(uuid) to authenticated;
grant execute on function public.cv_in_my_applications(uuid) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Enable RLS everywhere ----------------------------------------------------

alter table public.profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.cvs enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.applications enable row level security;
alter table public.application_notes enable row level security;
alter table public.cv_grades enable row level security;
alter table public.ai_calls enable row level security;

-- Table privileges (explicit; RLS then filters rows) -----------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on public.companies, public.jobs to anon;

grant select, insert, update, delete on
  public.candidate_profiles,
  public.cvs,
  public.companies,
  public.jobs,
  public.saved_jobs,
  public.application_notes
to authenticated;

grant select, delete on public.cv_grades to authenticated;

-- Profiles: read yes; only name/onboarding are editable. Role is locked.
grant select on public.profiles to authenticated;
grant update (full_name, onboarded_at) on public.profiles to authenticated;

-- Applications: candidates insert; only status is editable (by the employer).
grant select, insert, delete on public.applications to authenticated;
grant update (status) on public.applications to authenticated;

-- ai_calls: no grants to anon/authenticated. Service role only.

-- profiles -------------------------------------------------------------------

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: employers read applicants"
  on public.profiles for select to authenticated
  using (public.applied_to_my_jobs(id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- candidate_profiles ---------------------------------------------------------

create policy "candidate_profiles: read own"
  on public.candidate_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "candidate_profiles: employers read applicants"
  on public.candidate_profiles for select to authenticated
  using (public.applied_to_my_jobs(user_id));

create policy "candidate_profiles: insert own"
  on public.candidate_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and public.app_role() = 'candidate');

create policy "candidate_profiles: update own"
  on public.candidate_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "candidate_profiles: delete own"
  on public.candidate_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- cvs ------------------------------------------------------------------------

create policy "cvs: read own"
  on public.cvs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "cvs: employers read applied cvs"
  on public.cvs for select to authenticated
  using (public.cv_in_my_applications(id));

create policy "cvs: insert own"
  on public.cvs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.app_role() = 'candidate'
    and storage_path like (select auth.uid())::text || '/%'
  );

create policy "cvs: update own"
  on public.cvs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and storage_path like (select auth.uid())::text || '/%');

create policy "cvs: delete own"
  on public.cvs for delete to authenticated
  using (user_id = (select auth.uid()));

-- companies ------------------------------------------------------------------

create policy "companies: public read"
  on public.companies for select to anon, authenticated
  using (true);

create policy "companies: employer insert own"
  on public.companies for insert to authenticated
  with check (owner_id = (select auth.uid()) and is_demo = false and public.app_role() = 'employer');

create policy "companies: owner update"
  on public.companies for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and is_demo = false);

create policy "companies: owner delete"
  on public.companies for delete to authenticated
  using (owner_id = (select auth.uid()));

-- jobs -----------------------------------------------------------------------

create policy "jobs: read open"
  on public.jobs for select to anon, authenticated
  using (status = 'open');

create policy "jobs: owner reads all own"
  on public.jobs for select to authenticated
  using (public.owns_company(company_id));

create policy "jobs: owner insert"
  on public.jobs for insert to authenticated
  with check (public.owns_company(company_id) and is_demo = false);

create policy "jobs: owner update"
  on public.jobs for update to authenticated
  using (public.owns_company(company_id))
  with check (public.owns_company(company_id) and is_demo = false);

create policy "jobs: owner delete"
  on public.jobs for delete to authenticated
  using (public.owns_company(company_id));

-- saved_jobs -----------------------------------------------------------------

create policy "saved_jobs: own"
  on public.saved_jobs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- applications ---------------------------------------------------------------

create policy "applications: candidate reads own"
  on public.applications for select to authenticated
  using (candidate_id = (select auth.uid()));

create policy "applications: employer reads for own jobs"
  on public.applications for select to authenticated
  using (public.owns_job(job_id));

create policy "applications: candidate applies to open jobs"
  on public.applications for insert to authenticated
  with check (
    candidate_id = (select auth.uid())
    and public.app_role() = 'candidate'
    and status = 'applied'
    and match_score is null
    and match_explanation is null
    and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'open')
    and (cv_id is null or exists (select 1 from public.cvs c where c.id = cv_id and c.user_id = (select auth.uid())))
  );

create policy "applications: employer updates status"
  on public.applications for update to authenticated
  using (public.owns_job(job_id))
  with check (public.owns_job(job_id));

create policy "applications: candidate withdraws"
  on public.applications for delete to authenticated
  using (candidate_id = (select auth.uid()));

-- application_notes (private to the hiring employer) -------------------------

create policy "application_notes: employer reads"
  on public.application_notes for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and public.owns_job(a.job_id)));

create policy "application_notes: employer writes"
  on public.application_notes for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id and public.owns_job(a.job_id))
  );

create policy "application_notes: author edits"
  on public.application_notes for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "application_notes: author deletes"
  on public.application_notes for delete to authenticated
  using (author_id = (select auth.uid()));

-- cv_grades (written by the server; candidates read their own) ---------------

create policy "cv_grades: read own"
  on public.cv_grades for select to authenticated
  using (user_id = (select auth.uid()));

create policy "cv_grades: delete own"
  on public.cv_grades for delete to authenticated
  using (user_id = (select auth.uid()));

-- Private CV storage ---------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs',
  'cvs',
  false,
  5242880,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live at cvs/<user-id>/<file>. Owners manage their own folder.
-- Employers never get a storage policy: they receive short-lived signed URLs
-- created on the server after an application check.

create policy "cvs bucket: owner reads"
  on storage.objects for select to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "cvs bucket: candidate uploads to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.app_role() = 'candidate'
  );

create policy "cvs bucket: owner deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
