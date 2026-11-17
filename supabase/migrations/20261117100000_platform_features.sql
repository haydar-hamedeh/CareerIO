-- Settings, company profile + logos, chat report/block, talent search + invites, email bookkeeping.

-- Notification kinds -------------------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind = any (array['applied','status','interview','message','invite','alert']));

-- Per-user settings --------------------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_notifications boolean not null default true,
  job_alerts text not null default 'weekly' check (job_alerts in ('off', 'daily', 'weekly')),
  discoverable boolean not null default true,
  last_alert_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
grant select, insert on public.user_settings to authenticated;
grant update (email_notifications, job_alerts, discoverable, updated_at) on public.user_settings to authenticated;

create policy "user_settings: read own" on public.user_settings for select to authenticated using (user_id = (select auth.uid()));
create policy "user_settings: insert own" on public.user_settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_settings: update own" on public.user_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Company profile ----------------------------------------------------------------------------------------
alter table public.companies add column logo_path text check (char_length(logo_path) <= 200);
alter table public.companies add column industry text check (char_length(industry) <= 80);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-logos', 'company-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "company-logos: employer uploads to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = (select auth.uid())::text and private.app_role() = 'employer');
create policy "company-logos: owner updates"
  on storage.objects for update to authenticated
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "company-logos: owner deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Chat: block and report ---------------------------------------------------------------------------------
create table public.conversation_blocks (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, blocker_id)
);
create index conversation_blocks_blocker_idx on public.conversation_blocks (blocker_id);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'scam', 'inappropriate', 'other')),
  details text check (char_length(details) <= 500),
  created_at timestamptz not null default now()
);
create index message_reports_reporter_idx on public.message_reports (reporter_id);
create index message_reports_conversation_idx on public.message_reports (conversation_id);

alter table public.conversation_blocks enable row level security;
alter table public.message_reports enable row level security;

grant select, insert, delete on public.conversation_blocks to authenticated;
grant insert on public.message_reports to authenticated;

create policy "blocks: read own" on public.conversation_blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy "blocks: block as yourself" on public.conversation_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()) and private.in_conversation(conversation_id));
create policy "blocks: unblock own" on public.conversation_blocks for delete to authenticated using (blocker_id = (select auth.uid()));

create policy "reports: file as yourself" on public.message_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and conversation_id is not null and private.in_conversation(conversation_id));

create or replace function private.is_blocked(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.conversation_blocks b where b.conversation_id = cid);
$$;

revoke execute on function private.is_blocked(uuid) from public, anon;
grant execute on function private.is_blocked(uuid) to authenticated;

-- A restrictive policy is ANDed with the existing insert policy: nobody can send into a blocked conversation.
create policy "messages: not blocked" on public.messages as restrictive for insert to authenticated
  with check (not private.is_blocked(conversation_id));

create index conversations_job_idx on public.conversations (job_id);

-- Talent search and invites ------------------------------------------------------------------------------
create or replace function private.is_discoverable(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.user_settings s on s.user_id = p.id
    where p.id = uid and p.role = 'candidate' and p.onboarded_at is not null and coalesce(s.discoverable, true)
  );
$$;

revoke execute on function private.is_discoverable(uuid) from public, anon;
grant execute on function private.is_discoverable(uuid) to authenticated;

create table public.job_invites (
  job_id uuid not null references public.jobs (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  employer_id uuid not null references public.profiles (id) on delete cascade,
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  primary key (job_id, candidate_id)
);
create index job_invites_candidate_idx on public.job_invites (candidate_id);
create index job_invites_employer_idx on public.job_invites (employer_id);

alter table public.job_invites enable row level security;
grant select, insert on public.job_invites to authenticated;

create policy "job_invites: parties read" on public.job_invites for select to authenticated
  using ((select auth.uid()) in (employer_id, candidate_id));
create policy "job_invites: employer invites for own open job" on public.job_invites for insert to authenticated
  with check (
    employer_id = (select auth.uid())
    and private.app_role() = 'employer'
    and private.owns_job(job_id)
    and private.is_discoverable(candidate_id)
  );

create or replace function public.notify_job_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jt text;
  cn text;
begin
  select j.title, c.name into jt, cn
  from public.jobs j join public.companies c on c.id = j.company_id
  where j.id = new.job_id;

  insert into public.notifications (user_id, kind, title, body, href)
  values (
    new.candidate_id, 'invite',
    coalesce(cn, 'A company') || ' invited you to apply',
    left(coalesce(nullif(new.message, ''), coalesce(jt, 'a job')), 300),
    '/jobs/' || new.job_id
  );
  return new;
end;
$$;

revoke execute on function public.notify_job_invite() from public, anon, authenticated;

create trigger job_invites_after_insert after insert on public.job_invites
  for each row execute function public.notify_job_invite();

-- Candidates an employer may browse: only people who allow it, and only non-contact fields.
create or replace function public.search_candidates(q text default null, lim integer default 80)
returns table (
  user_id uuid, full_name text, headline text, summary text, seniority text, years numeric,
  location text, country text, skills text[], desired_roles text[], work_modes text[], languages text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.user_id, p.full_name, c.headline, c.summary, c.seniority::text, c.years_experience,
         c.location, c.country, c.skills, c.desired_roles, c.work_modes, c.languages
  from public.candidate_profiles c
  join public.profiles p on p.id = c.user_id
  where private.app_role() = 'employer'
    and private.is_discoverable(c.user_id)
    and (
      q is null or btrim(q) = '' or not exists (
        select 1 from unnest(string_to_array(btrim(q), ' ')) w
        where w <> '' and not (
          (coalesce(c.headline, '') || ' ' || coalesce(c.location, '') || ' ' || coalesce(p.full_name, '') || ' ' ||
           array_to_string(c.skills, ' ') || ' ' || array_to_string(c.desired_roles, ' ')) ilike '%' || w || '%'
        )
      )
    )
  order by c.updated_at desc
  limit least(greatest(coalesce(lim, 80), 1), 200);
$$;

revoke execute on function public.search_candidates(text, integer) from public, anon;
grant execute on function public.search_candidates(text, integer) to authenticated;
