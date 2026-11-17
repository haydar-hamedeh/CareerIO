-- Recruiter area: screening questions, AI application reviews, interview details and in-app notifications.
-- Additive only. The one policy that is replaced (candidates applying) is tightened, not loosened.

alter table public.jobs
  add column screening_questions jsonb not null default '[]'::jsonb;

alter table public.applications
  add column screening_answers jsonb not null default '[]'::jsonb,
  add column feedback jsonb,
  add column reviewed_at timestamptz,
  add column interview_at timestamptz,
  add column interview_note text check (char_length(interview_note) <= 1000);

-- Recruiter-only part of the AI review. The score, a short explanation and the strengths/gaps live on the application
-- itself (the candidate sees those); interview questions and manipulation flags stay here.
create table public.application_reviews (
  application_id uuid primary key references public.applications (id) on delete cascade,
  summary text not null,
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  skill_check jsonb not null default '{}'::jsonb,
  flagged boolean not null default false,
  used_cv boolean not null default false,
  model text not null,
  created_at timestamptz not null default now()
);

alter table public.application_reviews enable row level security;
grant select on public.application_reviews to authenticated;

create policy "application_reviews: employer reads"
  on public.application_reviews for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and private.owns_job(a.job_id)));

-- Employers can set the status and the interview details. Scores and feedback are written by the server only.
grant update (status, interview_at, interview_note) on public.applications to authenticated;

drop policy "applications: candidate applies to open jobs" on public.applications;
create policy "applications: candidate applies to open jobs"
  on public.applications for insert to authenticated
  with check (
    candidate_id = (select auth.uid())
    and private.app_role() = 'candidate'
    and status = 'applied'
    and match_score is null
    and match_explanation is null
    and feedback is null
    and reviewed_at is null
    and interview_at is null
    and interview_note is null
    and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'open')
    and (cv_id is null or exists (select 1 from public.cvs c where c.id = cv_id and c.user_id = (select auth.uid())))
  );

-- Notifications ------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('applied', 'status', 'interview', 'message')),
  title text not null check (char_length(title) <= 160),
  body text check (char_length(body) <= 600),
  href text check (char_length(href) <= 200),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications: mark own read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Notifications are created by the database itself, so they cannot be skipped or forged from the client.
create or replace function public.notify_application_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j record;
begin
  select jb.title as title, c.name as company, c.owner_id as owner_id
    into j
    from public.jobs jb
    join public.companies c on c.id = jb.company_id
    where jb.id = new.job_id;

  if tg_op = 'INSERT' then
    if j.owner_id is not null then
      insert into public.notifications (user_id, kind, title, body, href)
      values (j.owner_id, 'applied', 'New applicant for ' || j.title, 'Open the applicants list to review them.', '/recruiter/jobs/' || new.job_id);
    end if;
  elsif new.status is distinct from old.status and new.status <> 'applied' then
    insert into public.notifications (user_id, kind, title, body, href)
    values (
      new.candidate_id,
      case when new.status = 'interview' then 'interview' else 'status' end,
      case new.status
        when 'interview' then j.company || ' invited you to an interview'
        when 'in_review' then j.company || ' is reviewing your application'
        when 'hired' then 'You got the job at ' || j.company
        else 'Update from ' || j.company
      end,
      case when new.status = 'interview' and new.interview_note is not null then left(new.interview_note, 600) else j.title end,
      '/jobs/' || new.job_id
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_application_change() from public, anon, authenticated;

create trigger applications_notify_insert
  after insert on public.applications
  for each row execute function public.notify_application_change();

create trigger applications_notify_status
  after update of status on public.applications
  for each row execute function public.notify_application_change();
