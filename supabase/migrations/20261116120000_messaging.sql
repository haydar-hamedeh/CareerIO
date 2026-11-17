-- Live messaging between an employer and a job seeker. One conversation per application, so chat only exists between
-- people who already have a hiring relationship. Delivery is live through Supabase Realtime (which respects these policies).

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid unique references public.applications (id) on delete set null,
  employer_id uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  job_title text not null check (char_length(job_title) <= 200),
  last_message_at timestamptz not null default now(),
  last_message_preview text check (char_length(last_message_preview) <= 160),
  created_at timestamptz not null default now(),
  constraint conversations_distinct_people check (employer_id <> candidate_id)
);

create index conversations_employer_idx on public.conversations (employer_id, last_message_at desc);
create index conversations_candidate_idx on public.conversations (candidate_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);

-- When each person last read each conversation. Drives unread counts and "Seen".
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_reads_user_idx on public.conversation_reads (user_id);

-- Policy helpers (security definer, in the private schema like the others) -------------------------------

create or replace function private.in_conversation(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = cid and (select auth.uid()) in (c.employer_id, c.candidate_id)
  );
$$;

-- A conversation may only be opened for a real application, between that job's company owner and that applicant.
create or replace function private.can_open_conversation(app uuid, emp uuid, cand uuid, job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) in (emp, cand)
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where a.id = app and a.candidate_id = cand and a.job_id = job and c.owner_id = emp
    );
$$;

revoke execute on function private.in_conversation(uuid) from public, anon;
revoke execute on function private.can_open_conversation(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function private.in_conversation(uuid) to authenticated;
grant execute on function private.can_open_conversation(uuid, uuid, uuid, uuid) to authenticated;

-- Row Level Security -------------------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;

grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert on public.conversation_reads to authenticated;
grant update (last_read_at) on public.conversation_reads to authenticated;

create policy "conversations: participants read"
  on public.conversations for select to authenticated
  using ((select auth.uid()) in (employer_id, candidate_id));

create policy "conversations: open for an application"
  on public.conversations for insert to authenticated
  with check (application_id is not null and private.can_open_conversation(application_id, employer_id, candidate_id, job_id));

create policy "messages: participants read"
  on public.messages for select to authenticated
  using (private.in_conversation(conversation_id));

create policy "messages: participants send as themselves"
  on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.in_conversation(conversation_id));

create policy "conversation_reads: participants read"
  on public.conversation_reads for select to authenticated
  using (private.in_conversation(conversation_id));

create policy "conversation_reads: write own"
  on public.conversation_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and private.in_conversation(conversation_id));

create policy "conversation_reads: update own"
  on public.conversation_reads for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- After each message: bump the conversation, mark it read for the sender, and notify the other person once
-- (not once per message, so a burst of messages is one bell entry until they open it).
create or replace function public.on_message_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  recipient uuid;
  who text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  update public.conversations
    set last_message_at = new.created_at, last_message_preview = left(new.body, 160)
    where id = c.id;

  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
    values (c.id, new.sender_id, new.created_at)
    on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;

  if new.sender_id = c.employer_id then
    recipient := c.candidate_id;
    select name into who from public.companies where owner_id = c.employer_id order by created_at limit 1;
  else
    recipient := c.employer_id;
    select full_name into who from public.profiles where id = c.candidate_id;
  end if;

  if not exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'message' and n.read_at is null and n.href = '/messages?c=' || c.id
  ) then
    insert into public.notifications (user_id, kind, title, body, href)
    values (recipient, 'message', 'New message from ' || coalesce(who, 'someone'), left(new.body, 120), '/messages?c=' || c.id);
  end if;

  return new;
end;
$$;

revoke execute on function public.on_message_created() from public, anon, authenticated;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.on_message_created();

-- Unread messages per conversation for the signed-in user. Runs as the caller, so Row Level Security applies.
create or replace function public.conversation_unread()
returns table (conversation_id uuid, unread bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.conversation_id, count(*)
  from public.messages m
  left join public.conversation_reads r on r.conversation_id = m.conversation_id and r.user_id = (select auth.uid())
  where m.sender_id <> (select auth.uid())
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by m.conversation_id;
$$;

revoke execute on function public.conversation_unread() from public, anon;
grant execute on function public.conversation_unread() to authenticated;

-- Marks a conversation read up to now, using the database clock so it always compares correctly with message times.
create or replace function public.mark_conversation_read(cid uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (cid, (select auth.uid()), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
$$;

revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Live delivery: Realtime streams these tables to subscribers, filtered by the policies above.
alter publication supabase_realtime add table public.messages, public.conversation_reads;
