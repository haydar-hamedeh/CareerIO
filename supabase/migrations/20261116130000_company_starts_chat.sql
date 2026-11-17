-- Only the company can open a conversation; the applicant can reply once the company has written.
create or replace function private.can_open_conversation(app uuid, emp uuid, cand uuid, job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = emp
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where a.id = app and a.candidate_id = cand and a.job_id = job and c.owner_id = emp
    );
$$;
