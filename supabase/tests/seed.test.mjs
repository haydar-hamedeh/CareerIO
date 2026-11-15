import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

const root = fileURLToPath(new URL("..", import.meta.url));
const db = new PGlite({ extensions: { vector } });
await db.exec(`
  create schema extensions; create schema auth; create schema storage;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public, auth, storage, extensions to anon, authenticated;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create or replace function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin end $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select '{}'::text[] $$;
`);
for (const f of readdirSync(`${root}/migrations`).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(`${root}/migrations/${f}`, "utf8"));
}
const seeds = readdirSync(`${root}/seed`).filter((n) => /^demo_jobs_\d+\.sql$/.test(n)).sort();
for (let pass = 0; pass < 2; pass++) for (const f of seeds) await db.exec(readFileSync(`${root}/seed/${f}`, "utf8"));
const r = (await db.query(`select
  (select count(*) from public.companies where is_demo)::int companies,
  (select count(*) from public.jobs where is_demo and status = 'open')::int jobs,
  (select count(distinct field) from public.jobs)::int fields,
  (select count(*) from public.companies where is_demo and website is null)::int missing_site,
  (select count(*) from public.jobs where is_demo and (coalesce(array_length(requirements, 1), 0) < 3 or char_length(description) < 500 or salary_max > 10000))::int weak_jobs,
  (select description from public.jobs where title = 'English Language Teacher') sample`)).rows[0];
console.log(JSON.stringify(r, null, 2));
const ok =
  r.companies === 29 &&
  r.jobs === 152 &&
  r.fields === 17 &&
  r.missing_site === 0 &&
  r.weak_jobs === 0 &&
  r.sample.includes("hiring an English");
console.log(ok ? "seed OK (idempotent)" : "seed FAILED");
process.exit(ok ? 0 : 1);
