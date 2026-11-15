-- PENDING (not applied): performance only. Merges two permissive SELECT policies
-- per table into one. The Supabase MCP approval step declined it twice because
-- it contains DROP POLICY; apply via the SQL Editor when convenient.
-- Each drop and its replacement run in one transaction, so access is never open.

begin;

drop policy "profiles: read own" on public.profiles;
drop policy "profiles: employers read applicants" on public.profiles;
create policy "profiles: read own or applicant"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.applied_to_my_jobs(id));

drop policy "candidate_profiles: read own" on public.candidate_profiles;
drop policy "candidate_profiles: employers read applicants" on public.candidate_profiles;
create policy "candidate_profiles: read own or applicant"
  on public.candidate_profiles for select to authenticated
  using (user_id = (select auth.uid()) or private.applied_to_my_jobs(user_id));

drop policy "cvs: read own" on public.cvs;
drop policy "cvs: employers read applied cvs" on public.cvs;
create policy "cvs: read own or applied"
  on public.cvs for select to authenticated
  using (user_id = (select auth.uid()) or private.cv_in_my_applications(id));

drop policy "jobs: read open" on public.jobs;
drop policy "jobs: owner reads all own" on public.jobs;
create policy "jobs: anon reads open"
  on public.jobs for select to anon
  using (status = 'open');
create policy "jobs: read open or own"
  on public.jobs for select to authenticated
  using (status = 'open' or private.owns_company(company_id));

drop policy "applications: candidate reads own" on public.applications;
drop policy "applications: employer reads for own jobs" on public.applications;
create policy "applications: candidate or hiring employer reads"
  on public.applications for select to authenticated
  using (candidate_id = (select auth.uid()) or private.owns_job(job_id));

commit;
