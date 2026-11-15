// Generates supabase/seed/demo_jobs_<n>.sql from batch<n>.mjs. All data is fictional and is_demo = true.
// Run: node supabase/seed/generate-demo-jobs.mjs
// Every statement is idempotent and non-destructive: missing demo rows are inserted and existing is_demo = true rows are updated in place.
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));

// Realistic monthly USD salary ranges by seniority and market
const S_REGIONAL = {
  intern: [300, 550],
  junior: [700, 1200],
  mid: [1300, 2300],
  senior: [2400, 3800],
  lead: [3500, 5200],
};

const S_INTL = {
  intern: [450, 800],
  junior: [1100, 1800],
  mid: [2000, 3300],
  senior: [3300, 5000],
  lead: [4500, 6800],
};

const isRegionalMarket = (location) => /\b(Lebanon|Jordan|Egypt)\b/i.test(location);

const TYPE_LABEL = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

const MODE_LABEL = {
  onsite: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};

const fmtUsd = (n) => `$${Number(n).toLocaleString("en-US")}`;
const lit = (v) => `$seed$${JSON.stringify(v)}$seed$::jsonb`;
const round50 = (n) => Math.round(n / 50) * 50;

function hiringProcess(field, seniority, type) {
  if (type === "internship" || seniority === "intern") {
    return [
      "1. Application & portfolio/CV review (2–3 business days)",
      "2. 30-minute conversation with your team mentor — focused on projects and curiosity, no trick questions",
      "3. Final placement confirmation and start-date onboarding",
    ];
  }
  if (field === "Medicine" || field === "Healthcare") {
    return [
      "1. Credential, degree, and active clinical license verification",
      "2. 45-minute clinical case discussion with the department lead",
      "3. Facility tour, schedule alignment, and Medical Director sign-off",
    ];
  }
  if (field === "Software" || field === "Design") {
    return [
      "1. 25-minute intro call covering background, role scope, and monthly compensation alignment",
      "2. Practical role exercise (portfolio walkthrough or real-world technical pairing — no trick whiteboard puzzles)",
      "3. Final conversation with the hiring manager and cross-functional peers",
    ];
  }
  return [
    "1. 25-minute intro call on role expectations, schedule, and monthly salary range",
    "2. Role-specific practical case or competency interview with the hiring manager",
    "3. Final team & leadership alignment conversation",
  ];
}

function buildDescription(j, c, lo, hi) {
  const cleanAbout = c.about.trim().replace(/\.$/, "");
  const article = /^[AEIOU]/.test(j.title) ? "an" : "a";
  const place =
    j.mode === "remote"
      ? "remote"
      : `${j.mode === "onsite" ? "on-site" : j.mode}, ${c.location}`;

  const intro = `${c.name} ${cleanAbout}. We're hiring ${article} ${j.title} to join the team (${place}).`;
  const benefits = [
    `Monthly salary: ${fmtUsd(lo)}–${fmtUsd(hi)} USD / month (${TYPE_LABEL[j.type]}, ${MODE_LABEL[j.mode]})`,
    ...(c.benefits ?? []),
  ];
  const process = hiringProcess(j.field, j.seniority, j.type);

  const sections = [
    intro,
    `About the role:\n${j.overview}`,
    `What you'll do:\n${j.resp.map((r) => `- ${r}`).join("\n")}`,
    `Requirements:\n${j.reqs.map((r) => `- ${r}`).join("\n")}`,
    ...(j.plus?.length ? [`Nice to have:\n${j.plus.map((r) => `- ${r}`).join("\n")}`] : []),
    `Compensation & benefits:\n${benefits.map((b) => `- ${b}`).join("\n")}`,
    `Hiring process:\n${process.map((p) => `- ${p}`).join("\n")}`,
  ];

  const text = sections.join("\n\n");
  if (text.length > 11500) {
    throw new Error(`Description too long (${text.length}) for ${j.company} - ${j.title}`);
  }
  return text;
}

function build(batch, n, knownCompanies) {
  const companies = batch.companies.map((c) => {
    const cleanAbout = c.about.trim().replace(/\.$/, "");
    const description = `${c.name} ${cleanAbout}.`;
    if (description.length > 3900) throw new Error(`Company description too long for ${c.name}`);
    const row = {
      name: c.name,
      size: c.size,
      location: c.location,
      website: c.website ?? null,
      description,
    };
    knownCompanies.set(c.name, c);
    return row;
  });

  const jobs = batch.jobs.map((j, i) => {
    const bandTable = isRegionalMarket(knownCompanies.get(j.company)?.location ?? "") ? S_REGIONAL : S_INTL;
    if (!bandTable[j.seniority]) throw new Error(`Bad seniority ${j.seniority} for ${j.title}`);
    const c = knownCompanies.get(j.company);
    if (!c) throw new Error(`Unknown company ${j.company} for ${j.title}`);

    let [lo, hi] = j.salary ?? bandTable[j.seniority];
    if (!j.salary && j.type === "part_time") {
      lo = round50(lo * 0.6);
      hi = round50(hi * 0.6);
    }

    const description = buildDescription(j, c, lo, hi);
    return {
      company: j.company,
      title: j.title,
      description,
      field: j.field,
      seniority: j.seniority,
      type: j.type,
      mode: j.mode,
      location: j.mode === "remote" ? "Remote" : c.location,
      skills: j.skills,
      reqs: j.reqs,
      lo,
      hi,
      days: (i * 7 + n) % 21,
      hours: (i * 5 + n * 3) % 24,
    };
  });

  return `-- Generated by supabase/seed/generate-demo-jobs.mjs from batch${n}.mjs. Do not edit by hand.
-- ${companies.length} fictional companies and ${jobs.length} detailed sample jobs (monthly USD salaries), all is_demo = true.

with src_c as (
  select * from jsonb_to_recordset(${lit(companies)}) as x(name text, size text, location text, website text, description text)
),
upd_c as (
  update public.companies c
  set
    size = s.size::public.company_size,
    location = s.location,
    website = s.website,
    description = s.description
  from src_c s
  where c.is_demo and c.name = s.name
  returning c.id, c.name
),
ins_c as (
  insert into public.companies (name, size, location, website, description, is_demo)
  select s.name, s.size::public.company_size, s.location, s.website, s.description, true
  from src_c s
  where not exists (select 1 from public.companies c where c.is_demo and c.name = s.name)
  returning id, name
),
all_c as (
  select id, name from public.companies where is_demo
  union
  select id, name from ins_c
),
src_j as (
  select * from jsonb_to_recordset(${lit(jobs)}) as x(
    company text, title text, description text, field text, seniority text, type text, mode text,
    location text, skills text[], reqs text[], lo int, hi int, days int, hours int)
),
upd_j as (
  update public.jobs e
  set
    description = j.description,
    requirements = j.reqs,
    skills = j.skills,
    field = j.field,
    seniority = j.seniority::public.seniority,
    employment_type = j.type::public.employment_type,
    work_mode = j.mode::public.work_mode,
    location = j.location,
    salary_min = j.lo,
    salary_max = j.hi,
    salary_currency = 'USD'
  from src_j j
  join all_c c on c.name = j.company
  where e.is_demo and e.company_id = c.id and e.title = j.title
  returning e.id
)
insert into public.jobs (company_id, title, description, requirements, skills, field, seniority, employment_type, work_mode, location, salary_min, salary_max, salary_currency, status, is_demo, published_at)
select
  c.id,
  j.title,
  j.description,
  j.reqs,
  j.skills,
  j.field,
  j.seniority::public.seniority,
  j.type::public.employment_type,
  j.mode::public.work_mode,
  j.location,
  j.lo,
  j.hi,
  'USD',
  'open'::public.job_status,
  true,
  now() - make_interval(days => j.days, hours => j.hours)
from src_j j
join all_c c on c.name = j.company
where not exists (
  select 1 from public.jobs e join public.companies ec on ec.id = e.company_id
  where e.is_demo and ec.name = j.company and e.title = j.title
);
`;
}

const batches = readdirSync(dir).filter((f) => /^batch\d+\.mjs$/.test(f)).sort();
const knownCompanies = new Map();
for (const file of batches) {
  const n = Number(file.match(/\d+/)[0]);
  const batch = await import(`./${file}`);
  const out = `${dir}/demo_jobs_${n}.sql`;
  writeFileSync(out, build(batch, n, knownCompanies));
  console.log(`${file}: ${batch.companies.length} companies, ${batch.jobs.length} jobs -> demo_jobs_${n}.sql`);
}
