import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

const dir = process.argv[2] ?? fileURLToPath(new URL("../migrations", import.meta.url));
const db = new PGlite({ extensions: { vector } });

await db.exec(`
  create schema extensions;
  create schema auth;
  create schema storage;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to authenticated;
  create publication supabase_realtime;
  create or replace function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin end $$;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant execute on function storage.foldername(text) to authenticated;
`);

for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(`${dir}/${f}`, "utf8"));
  console.log(`applied ${f}`);
}

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const E = "33333333-3333-3333-3333-333333333333";
const X = "44444444-4444-4444-4444-444444444444";

await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${A}', 'a@test.local', '{"full_name":"Cand A","role":"candidate"}'),
    ('${B}', 'b@test.local', '{"full_name":"Cand B"}'),
    ('${E}', 'e@test.local', '{"full_name":"Emp E","role":"employer"}'),
    ('${X}', 'x@test.local', '{"full_name":"Sneaky","role":"admin"}');
`);

let pass = 0;
let fail = 0;
const results = [];

async function as(uid, sql) {
  const role = uid ? "authenticated" : "anon";
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
  try {
    const r = await db.query(sql);
    return { rows: r.rows, affected: r.affectedRows ?? 0 };
  } catch (e) {
    return { error: e.message };
  } finally {
    await db.exec("reset role;");
  }
}

function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
}

const roles = (await db.query(`select id, role::text from public.profiles order by id`)).rows;
check("signup trigger creates 4 profiles", roles.length === 4, JSON.stringify(roles));
check("employer metadata -> employer role", roles.find((r) => r.id === E)?.role === "employer");
check("missing role -> candidate", roles.find((r) => r.id === B)?.role === "candidate");
check("invalid role 'admin' -> candidate", roles.find((r) => r.id === X)?.role === "candidate");
const cp = (await db.query(`select count(*)::int n from public.candidate_profiles`)).rows[0].n;
check("candidate_profiles created for candidates only (3)", cp === 3, String(cp));

let r = await as(A, `select id from public.profiles`);
check("candidate sees only own profile", r.rows?.length === 1 && r.rows[0].id === A, JSON.stringify(r));
r = await as(A, `update public.profiles set role = 'employer' where id = '${A}'`);
check("candidate cannot change own role", Boolean(r.error), JSON.stringify(r));
r = await as(A, `update public.profiles set full_name = 'Cand A2' where id = '${A}'`);
check("candidate can update own name", !r.error && r.affected === 1, JSON.stringify(r));
r = await as(A, `update public.profiles set full_name = 'hacked' where id = '${B}'`);
check("candidate cannot update another profile", !r.error && r.affected === 0, JSON.stringify(r));

r = await as(A, `insert into public.companies (owner_id, name) values ('${A}', 'Fake Co')`);
check("candidate cannot create a company", Boolean(r.error), JSON.stringify(r));
r = await as(E, `insert into public.companies (owner_id, name, is_demo) values ('${E}', 'Demo Spoof', true)`);
check("employer cannot create is_demo company", Boolean(r.error), JSON.stringify(r));
r = await as(E, `insert into public.companies (owner_id, name) values ('${E}', 'Cedar Labs') returning id`);
const company = r.rows?.[0]?.id;
check("employer creates own company", Boolean(company), JSON.stringify(r));

r = await as(E, `insert into public.jobs (company_id, title, description, field, seniority, employment_type, work_mode, status, published_at)
  values ('${company}', 'Frontend Developer', 'Build UI', 'Software', 'mid', 'full_time', 'hybrid', 'open', now()) returning id`);
const job = r.rows?.[0]?.id;
check("employer posts open job", Boolean(job), JSON.stringify(r));
r = await as(E, `insert into public.jobs (company_id, title, description, field, seniority, employment_type, work_mode, status)
  values ('${company}', 'Secret Draft', 'x', 'Software', 'mid', 'full_time', 'remote', 'draft') returning id`);
check("employer posts draft job", Boolean(r.rows?.[0]?.id), JSON.stringify(r));

r = await as(null, `select title from public.jobs`);
check("anon sees open job only (not draft)", r.rows?.length === 1 && r.rows[0].title === "Frontend Developer", JSON.stringify(r));
r = await as(A, `update public.jobs set title = 'pwned' where id = '${job}'`);
check("candidate cannot edit a job", !r.error && r.affected === 0, JSON.stringify(r));

r = await as(A, `insert into public.cvs (user_id, storage_path, file_name, mime_type, size_bytes, content_hash)
  values ('${A}', '${A}/cv.pdf', 'cv.pdf', 'application/pdf', 1000, 'h1') returning id`);
const cvA = r.rows?.[0]?.id;
check("candidate stores own CV row", Boolean(cvA), JSON.stringify(r));
r = await as(A, `insert into public.cvs (user_id, storage_path, file_name, mime_type, size_bytes, content_hash)
  values ('${A}', '${B}/cv.pdf', 'cv.pdf', 'application/pdf', 1000, 'h2')`);
check("candidate cannot point CV at another user's folder", Boolean(r.error), JSON.stringify(r));
r = await as(B, `insert into public.cvs (user_id, storage_path, file_name, mime_type, size_bytes, content_hash)
  values ('${B}', '${B}/cv.pdf', 'cv.pdf', 'application/pdf', 1000, 'h3') returning id`);
const cvB = r.rows?.[0]?.id;
r = await as(A, `insert into public.cvs (user_id, storage_path, file_name, mime_type, size_bytes, content_hash)
  values ('${A}', '${A}/big.pdf', 'big.pdf', 'application/pdf', 6000000, 'h4')`);
check("CV over 5 MB rejected", Boolean(r.error), JSON.stringify(r));
r = await as(A, `insert into public.cvs (user_id, storage_path, file_name, mime_type, size_bytes, content_hash)
  values ('${A}', '${A}/x.exe', 'x.exe', 'application/x-msdownload', 100, 'h5')`);
check("non-PDF/DOCX CV rejected", Boolean(r.error), JSON.stringify(r));

r = await as(A, `insert into public.applications (job_id, candidate_id, cv_id, match_score) values ('${job}', '${A}', '${cvA}', 100)`);
check("candidate cannot set own match score", Boolean(r.error), JSON.stringify(r));
r = await as(A, `insert into public.applications (job_id, candidate_id, cv_id) values ('${job}', '${A}', '${cvB}')`);
check("candidate cannot apply with someone else's CV", Boolean(r.error), JSON.stringify(r));
r = await as(A, `insert into public.applications (job_id, candidate_id, cv_id) values ('${job}', '${A}', '${cvA}') returning id`);
const app = r.rows?.[0]?.id;
check("candidate applies with own CV", Boolean(app), JSON.stringify(r));
r = await as(E, `insert into public.applications (job_id, candidate_id) values ('${job}', '${E}')`);
check("employer cannot apply as a candidate", Boolean(r.error), JSON.stringify(r));

r = await as(B, `select id from public.applications`);
check("other candidate sees no applications", r.rows?.length === 0, JSON.stringify(r));
r = await as(B, `select id from public.cvs where user_id = '${A}'`);
check("other candidate cannot see A's CV", r.rows?.length === 0, JSON.stringify(r));

r = await as(E, `select id from public.applications`);
check("employer sees application to own job", r.rows?.length === 1, JSON.stringify(r));
r = await as(E, `select id from public.profiles order by id`);
check("employer sees own + applicant profile only", r.rows?.length === 2, JSON.stringify(r));
r = await as(E, `select id from public.cvs`);
check("employer sees applicant's CV row, not B's", r.rows?.length === 1 && r.rows[0].id === cvA, JSON.stringify(r));
r = await as(E, `update public.applications set status = 'interview' where id = '${app}'`);
check("employer moves application to interview", !r.error && r.affected === 1, JSON.stringify(r));
r = await as(E, `update public.applications set match_score = 99 where id = '${app}'`);
check("employer cannot edit match score", Boolean(r.error), JSON.stringify(r));
r = await as(A, `update public.applications set status = 'hired' where id = '${app}'`);
check("candidate cannot change application status", Boolean(r.error) || r.affected === 0, JSON.stringify(r));

r = await as(E, `insert into public.application_notes (application_id, author_id, body) values ('${app}', '${E}', 'Strong portfolio')`);
check("employer adds private note", !r.error, JSON.stringify(r));
r = await as(A, `select id from public.application_notes`);
check("candidate cannot read employer notes", r.rows?.length === 0, JSON.stringify(r));

r = await as(A, `select id from public.ai_calls`);
check("ai_calls hidden from users", Boolean(r.error), JSON.stringify(r));
r = await as(A, `insert into public.cv_grades (cv_id, user_id, score, rubric, model, prompt_version) values ('${cvA}', '${A}', 100, '{}', 'x', 'v1')`);
check("candidate cannot write own CV grade", Boolean(r.error), JSON.stringify(r));

r = await as(A, `insert into storage.objects (bucket_id, name) values ('cvs', '${A}/cv.pdf')`);
check("storage: candidate uploads to own folder", !r.error, JSON.stringify(r));
r = await as(A, `insert into storage.objects (bucket_id, name) values ('cvs', '${B}/evil.pdf')`);
check("storage: candidate blocked from other folder", Boolean(r.error), JSON.stringify(r));
r = await as(E, `insert into storage.objects (bucket_id, name) values ('cvs', '${E}/x.pdf')`);
check("storage: employer cannot upload CVs", Boolean(r.error), JSON.stringify(r));
r = await as(B, `select name from storage.objects`);
check("storage: other candidate cannot list A's files", r.rows?.length === 0, JSON.stringify(r));
const bucket = (await db.query(`select public from storage.buckets where id = 'cvs'`)).rows[0];
check("cvs bucket is private", bucket?.public === false, JSON.stringify(bucket));

// Messaging, blocks, reports, talent search and invites ---------------------------------------------------
await db.exec(`update public.profiles set onboarded_at = now() where role = 'candidate'`);

r = await as(A, `insert into public.conversations (application_id, employer_id, candidate_id, job_id, job_title) values ('${app}', '${E}', '${A}', '${job}', 'Frontend Developer')`);
check("candidate cannot start a conversation", Boolean(r.error), JSON.stringify(r));
r = await as(E, `insert into public.conversations (application_id, employer_id, candidate_id, job_id, job_title) values ('${app}', '${E}', '${A}', '${job}', 'Frontend Developer') returning id`);
const conv = r.rows?.[0]?.id;
check("company starts a conversation with an applicant", Boolean(conv), JSON.stringify(r));
r = await as(E, `insert into public.conversations (application_id, employer_id, candidate_id, job_id, job_title) values (null, '${E}', '${B}', '${job}', 'x')`);
check("conversation needs a real application", Boolean(r.error), JSON.stringify(r));
r = await as(E, `insert into public.messages (conversation_id, sender_id, body) values ('${conv}', '${E}', 'Hello A')`);
check("company sends the first message", !r.error, JSON.stringify(r));
r = await as(A, `select kind from public.notifications`);
check("message notifies the applicant", r.rows?.some((n) => n.kind === "message"), JSON.stringify(r));
r = await as(A, `insert into public.messages (conversation_id, sender_id, body) values ('${conv}', '${A}', 'Hi, thanks')`);
check("applicant can reply", !r.error, JSON.stringify(r));
r = await as(B, `select id from public.messages`);
check("outsider cannot read messages", r.rows?.length === 0, JSON.stringify(r));
r = await as(B, `insert into public.messages (conversation_id, sender_id, body) values ('${conv}', '${B}', 'intruding')`);
check("outsider cannot send messages", Boolean(r.error), JSON.stringify(r));

r = await as(A, `insert into public.conversation_blocks (conversation_id, blocker_id) values ('${conv}', '${A}')`);
check("participant can block a conversation", !r.error, JSON.stringify(r));
r = await as(E, `insert into public.messages (conversation_id, sender_id, body) values ('${conv}', '${E}', 'still there?')`);
check("blocked person cannot send", Boolean(r.error), JSON.stringify(r));
r = await as(E, `select 1 from public.conversation_blocks`);
check("blocked person cannot see the block", r.rows?.length === 0, JSON.stringify(r));
r = await as(B, `insert into public.conversation_blocks (conversation_id, blocker_id) values ('${conv}', '${B}')`);
check("outsider cannot block someone else's conversation", Boolean(r.error), JSON.stringify(r));
r = await as(A, `delete from public.conversation_blocks where conversation_id = '${conv}'`);
r = await as(E, `insert into public.messages (conversation_id, sender_id, body) values ('${conv}', '${E}', 'back again')`);
check("unblocking lets messages through again", !r.error, JSON.stringify(r));

r = await as(A, `insert into public.message_reports (reporter_id, conversation_id, reason) values ('${A}', '${conv}', 'spam')`);
check("participant can report a conversation", !r.error, JSON.stringify(r));
r = await as(A, `select id from public.message_reports`);
check("reports are not readable by users", Boolean(r.error), JSON.stringify(r));
r = await as(B, `insert into public.message_reports (reporter_id, conversation_id, reason) values ('${B}', '${conv}', 'spam')`);
check("outsider cannot report a conversation", Boolean(r.error), JSON.stringify(r));

r = await as(A, `select user_id from public.search_candidates('', 10)`);
check("candidates cannot search talent", r.rows?.length === 0, JSON.stringify(r));
r = await as(E, `select * from public.search_candidates('', 10)`);
check("employer finds discoverable candidates (A, B and the downgraded X)", r.rows?.length === 3, JSON.stringify(r));
check("talent search never returns phone or email", r.rows?.every((x) => !("phone" in x) && !("email" in x)), JSON.stringify(r.rows?.[0]));
r = await as(B, `insert into public.user_settings (user_id, discoverable) values ('${B}', false)`);
check("candidate can opt out of search", !r.error, JSON.stringify(r));
r = await as(E, `select user_id from public.search_candidates('', 10)`);
check("opted-out candidate is hidden from search", r.rows?.length === 2 && !r.rows.some((x) => x.user_id === B), JSON.stringify(r));
r = await as(A, `update public.user_settings set last_alert_at = now() where user_id = '${A}'`);
check("candidate cannot write last_alert_at", Boolean(r.error) || r.affected === 0, JSON.stringify(r));

r = await as(E, `insert into public.job_invites (job_id, candidate_id, employer_id, message) values ('${job}', '${B}', '${E}', 'hi')`);
check("cannot invite an opted-out candidate", Boolean(r.error), JSON.stringify(r));
r = await as(A, `insert into public.job_invites (job_id, candidate_id, employer_id) values ('${job}', '${A}', '${A}')`);
check("candidate cannot send invites", Boolean(r.error), JSON.stringify(r));
r = await as(E, `insert into public.job_invites (job_id, candidate_id, employer_id, message) values ('${job}', '${A}', '${E}', 'Come apply')`);
check("employer invites a discoverable candidate", !r.error, JSON.stringify(r));
r = await as(A, `select kind from public.notifications where kind = 'invite'`);
check("invite notifies the candidate", r.rows?.length === 1, JSON.stringify(r));
r = await as(B, `select 1 from public.job_invites`);
check("other candidates cannot read invites", r.rows?.length === 0, JSON.stringify(r));

r = await as(E, `insert into storage.objects (bucket_id, name) values ('company-logos', '${E}/logo.png')`);
check("storage: employer uploads own logo", !r.error, JSON.stringify(r));
r = await as(E, `insert into storage.objects (bucket_id, name) values ('company-logos', '${B}/logo.png')`);
check("storage: employer blocked from other logo folder", Boolean(r.error), JSON.stringify(r));
r = await as(B, `insert into storage.objects (bucket_id, name) values ('company-logos', '${B}/logo.png')`);
check("storage: candidate cannot upload company logos", Boolean(r.error), JSON.stringify(r));

await db.exec(`delete from auth.users where id = '${A}'`);
const left = (await db.query(`select
  (select count(*) from public.profiles where id = '${A}')::int p,
  (select count(*) from public.cvs where user_id = '${A}')::int c,
  (select count(*) from public.applications where candidate_id = '${A}')::int a`)).rows[0];
check("deleting the user removes profile, CVs and applications", left.p + left.c + left.a === 0, JSON.stringify(left));

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
