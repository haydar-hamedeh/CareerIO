import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { MapPin } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/app/app-header";
import type { FeedJob } from "@/components/feed/job-card";
import { FeedClient } from "@/components/feed/feed-client";
import { computeFit, currentTime, fitReason, formatSalary, timeAgo } from "@/lib/jobs/match";
import { levelShort, typeLabel } from "@/lib/jobs/format";
import { jobFields } from "@/lib/recruiter/job-schema";
import { PageTransition } from "@/components/page-transition";

const list = (v?: string) => (v ? v.split(",").filter(Boolean).slice(0, 30) : []);
import { mergeSkills, primaryCvSkills } from "@/lib/jobs/cv-skills";
import { workModeLabel } from "@/lib/onboarding/schema";

export const metadata: Metadata = { title: "Your job feed · CareerIO" };

type Search = { q?: string; mode?: string; level?: string; field?: string; saved?: string; sort?: string; welcome?: string };

export default function FeedPage({ searchParams }: PageProps<"/feed">) {
  return (
    <PageTransition>
      <Suspense fallback={<FeedSkeleton />}>
        <Feed searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </PageTransition>
  );
}

async function Feed({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const sp = await searchParams;
  const session = await requireSession("/feed");
  if (!session.onboarded) redirect("/onboarding");
  if (session.role === "employer") redirect("/recruiter");
  const { supabase, user, fullName } = session;
  const role: string = session.role;

  const [{ data: profile }, { data: company }, { data: jobsRaw }, { data: savedRows }] = await Promise.all([
    role === "candidate"
      ? supabase
          .from("candidate_profiles")
          .select("headline, location, country, skills, desired_roles, work_modes, seniority, embedding")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    role === "employer"
      ? supabase.from("companies").select("name, location").eq("owner_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("jobs")
      .select(
        "id, title, description, requirements, skills, field, seniority, employment_type, work_mode, location, salary_min, salary_max, salary_currency, published_at, is_demo, companies(id, name, size, location, website, description, logo_path)",
      )
      .eq("status", "open")
      .order("published_at", { ascending: false })
      .limit(200),
    supabase.from("saved_jobs").select("job_id").eq("user_id", user.id),
  ]);

  const mySkills: string[] = profile?.skills ?? [];
  // Matching counts the skills on the person's CV too, not only the ones typed into the profile.
  const cvSkills = role === "candidate" ? await primaryCvSkills(supabase, user.id) : [];
  const matchSkills = mergeSkills(mySkills, cvSkills);
  const myModes: string[] = profile?.work_modes ?? [];
  const myRoles: string[] = profile?.desired_roles ?? [];
  const saved = new Set((savedRows ?? []).map((r) => r.job_id as string));
  const now = currentTime();
  const isCandidate = role === "candidate";

  const semantic = new Map<string, number>();
  if (isCandidate && profile?.embedding) {
    const { data: sims } = await supabase.rpc("match_jobs", { query_embedding: profile.embedding, match_count: 200 });
    for (const r of (sims ?? []) as { job_id: string; similarity: number }[]) semantic.set(r.job_id, r.similarity);
  }

  type Row = NonNullable<typeof jobsRaw>[number];
  const companyOf = (j: Row) =>
    (Array.isArray(j.companies) ? j.companies[0] : j.companies) as {
      id: string;
      logo_path: string | null;
      name: string;
      size: string | null;
      location: string | null;
      website: string | null;
      description: string | null;
    } | null;

  // Every field a company can pick, then any older field names that still have jobs.
  const known = jobFields.map((x) => x.name);
  const extra = [...new Set((jobsRaw ?? []).map((j) => j.field as string))].filter((x) => !known.includes(x)).sort();
  const fields = [...known, ...extra];

  const all = (jobsRaw ?? []).map((j) => {
    const m = computeFit({
      jobTitle: j.title,
      jobSkills: j.skills ?? [],
      jobMode: j.work_mode,
      jobLevel: j.seniority,
      skills: matchSkills,
      desiredRoles: myRoles,
      headline: profile?.headline ?? "",
      workModes: myModes,
      level: profile?.seniority ?? null,
      semantic: semantic.get(j.id) ?? null,
    });
    return { j, m, c: companyOf(j) };
  });

  const jobs: FeedJob[] = all.map(({ j, m, c }) => ({
    id: j.id,
    title: j.title,
    description: j.description,
    requirements: j.requirements ?? [],
    skills: j.skills ?? [],
    matched: m.matched,
    company: c?.name ?? "Company",
    companyId: c?.id ?? null,
    companyLogo: c?.logo_path ?? null,
    companySize: c?.size ?? null,
    companyLocation: c?.location ?? null,
    companyWebsite: c?.website ?? null,
    companyDescription: c?.description ?? null,
    location: j.location ?? "",
    mode: workModeLabel[j.work_mode as keyof typeof workModeLabel] ?? j.work_mode,
    level: levelShort[j.seniority] ?? j.seniority,
    type: typeLabel[j.employment_type] ?? j.employment_type,
    salary: formatSalary(j.salary_min, j.salary_max, j.salary_currency),
    posted: timeAgo(j.published_at, now),
    isSample: Boolean(j.is_demo),
    pct: isCandidate ? m.score : null,
    reason: isCandidate ? fitReason(m, (j.skills ?? []).length) : "",
    saved: saved.has(j.id),
    field: j.field,
    rawMode: j.work_mode,
    rawLevel: j.seniority,
    publishedAt: new Date(j.published_at).getTime(),
    searchText: `${j.description} ${(j.requirements ?? []).join(" ")}`.toLowerCase(),
  }));

  const gaps = new Map<string, number>();
  if (isCandidate) {
    for (const { m } of all.filter((x) => x.m.skill >= 0.3)) for (const s of m.missing) gaps.set(s, (gaps.get(s) ?? 0) + 1);
  }
  const topGaps = [...gaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const strong = all.filter((x) => x.m.score >= 70).length;

  const initial = {
    q: sp.q ?? "",
    mode: list(sp.mode),
    level: list(sp.level),
    field: list(sp.field),
    saved: sp.saved === "1",
    sort: (sp.sort === "recent" ? "recent" : "match") as "match" | "recent",
  };

  return (
    <>
      <AppHeader name={fullName} active="feed" showProfile={isCandidate} />
      <main className="mx-auto grid max-w-[1240px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)_280px] lg:py-8">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="overflow-hidden rounded-[24px] bg-paper shadow-soft ring-1 ring-line">
            <div className="h-16 bg-forest" />
            <div className="-mt-8 px-5 pb-5">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-mint font-display text-xl font-extrabold text-forest-deep ring-4 ring-paper">
                {fullName.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?"}
              </span>
              <h1 className="mt-3 font-display text-[1.1rem] font-bold">{fullName || "Welcome"}</h1>
              <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
                {isCandidate ? profile?.headline : company ? `Hiring at ${company.name}` : "Employer"}
              </p>
              {(profile?.location || company?.location) && (
                <p className="mt-2 inline-flex items-center gap-1 text-[13px] text-muted">
                  <MapPin size={13} aria-hidden />
                  {isCandidate ? [profile?.location, profile?.country].filter(Boolean).join(", ") : company?.location}
                </p>
              )}
            </div>
            {isCandidate && (
              <div className="px-5 pb-4">
                <Link
                  href="/profile"
                  className="inline-flex h-9 w-full items-center justify-center rounded-full text-[13.5px] font-semibold text-forest ring-1 ring-line transition-colors hover:bg-mint/50"
                >
                  View and edit profile
                </Link>
              </div>
            )}
            {isCandidate && (
              <dl className="grid grid-cols-2 border-t border-line text-center">
                <div className="border-r border-line px-3 py-3">
                  <dt className="text-[12px] text-muted">Strong fits</dt>
                  <dd className="font-display text-lg font-extrabold text-forest">{strong}</dd>
                </div>
                <div className="px-3 py-3">
                  <dt className="text-[12px] text-muted">Saved</dt>
                  <dd className="font-display text-lg font-extrabold">{saved.size}</dd>
                </div>
              </dl>
            )}
          </section>

          {isCandidate && mySkills.length > 0 && (
            <section className="hidden rounded-[24px] bg-paper p-5 ring-1 ring-line lg:block">
              <h2 className="text-[13px] font-semibold text-muted">Your skills</h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {mySkills.map((s) => (
                  <li key={s} className="rounded-full bg-mint px-2.5 py-1 text-[12.5px] font-semibold text-forest-deep">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <div className="min-w-0 space-y-4 lg:col-span-2">
          {sp.welcome === "1" && (
            <div className="rounded-[24px] bg-forest p-5 text-white sm:p-6">
              <p className="font-display text-lg font-bold">Your profile is ready{fullName ? `, ${fullName.split(" ")[0]}` : ""}.</p>
              <p className="mt-1 text-[14.5px] text-white/80">
                {isCandidate
                  ? "Jobs are ranked by your skills, the meaning of your profile, the roles you want and your work mode. The AI re-scores your top matches."
                  : "Here's what's on CareerIO right now. Posting your own jobs is coming next."}
              </p>
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <FeedClient jobs={jobs} fields={fields} isCandidate={isCandidate} initial={initial} topGaps={topGaps} />
          </div>
        </div>
      </main>
    </>
  );
}

function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading jobs" className="animate-pulse">
      <div className="h-16 border-b border-line bg-paper" />
      <div className="mx-auto grid max-w-[1240px] gap-6 px-6 py-8 lg:grid-cols-[260px_1fr_280px]">
        <div className="hidden h-64 rounded-[24px] bg-ink/6 lg:block" />
        <div className="space-y-4">
          <div className="h-12 rounded-full bg-ink/6" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-72 rounded-[24px] bg-ink/6" />
          ))}
        </div>
        <div className="hidden h-80 rounded-[24px] bg-ink/6 lg:block" />
      </div>
    </div>
  );
}
