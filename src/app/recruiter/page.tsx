import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { CalendarCheck, ChevronRight, ClipboardList, Eye, Inbox, Plus, Sparkles, Users } from "lucide-react";
import { requireEmployer } from "@/lib/auth/employer";
import { AppHeader } from "@/components/app/app-header";
import { JobStatusButton } from "@/components/recruiter/job-status-button";
import { MatchRing } from "@/components/feed/job-card";
import { currentTime, timeAgo } from "@/lib/jobs/match";
import { levelShort, typeLabel } from "@/lib/jobs/format";
import { workModeLabel } from "@/lib/onboarding/schema";

export const metadata: Metadata = { title: "Recruiter dashboard · CareerIO" };

export default function RecruiterPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  return (
    <div className="min-h-dvh w-full">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const statusChip: Record<string, string> = {
  open: "bg-mint text-forest-deep",
  draft: "bg-sun/35 text-[#6b4700]",
  closed: "bg-ink/[0.07] text-muted",
  archived: "bg-ink/[0.07] text-muted",
};

async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  await connection();
  const sp = await searchParams;
  const { supabase, company, fullName } = await requireEmployer("/recruiter");

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, field, seniority, employment_type, work_mode, location, published_at, created_at, view_count")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });
  const ids = (jobs ?? []).map((j) => j.id);

  const { data: apps } = ids.length
    ? await supabase
        .from("applications")
        .select("id, job_id, candidate_id, status, match_score, created_at")
        .in("job_id", ids)
        .order("created_at", { ascending: false })
        .limit(1000)
    : { data: [] };
  const all = apps ?? [];

  const byJob = new Map<string, { total: number; fresh: number; top: number | null }>();
  for (const a of all) {
    const s = byJob.get(a.job_id) ?? { total: 0, fresh: 0, top: null };
    s.total++;
    if (a.status === "applied") s.fresh++;
    if (typeof a.match_score === "number") s.top = Math.max(s.top ?? 0, a.match_score);
    byJob.set(a.job_id, s);
  }
  const count = (status: string) => all.filter((a) => a.status === status).length;
  const openJobs = (jobs ?? []).filter((j) => j.status === "open").length;

  const recent = all.slice(0, 6);
  const recentIds = [...new Set(recent.map((a) => a.candidate_id))];
  const [{ data: people }, { data: cps }] = recentIds.length
    ? await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", recentIds),
        supabase.from("candidate_profiles").select("user_id, headline").in("user_id", recentIds),
      ])
    : [{ data: [] }, { data: [] }];
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name as string | null]));
  const headlineOf = new Map((cps ?? []).map((p) => [p.user_id, p.headline as string | null]));
  const titleOf = new Map((jobs ?? []).map((j) => [j.id, j.title]));
  const now = currentTime();

  const tiles = [
    { label: "Open jobs", value: openJobs, Icon: ClipboardList },
    { label: "New applicants", value: count("applied"), Icon: Inbox },
    { label: "In review", value: count("in_review"), Icon: Users },
    { label: "Interviews", value: count("interview"), Icon: CalendarCheck },
  ];

  return (
    <>
      <AppHeader name={fullName} active="recruiter" role="employer" />
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-muted">{company.name}</p>
            <h1 className="mt-1 font-display text-[clamp(1.8rem,3.6vw,2.4rem)] leading-tight font-extrabold tracking-[-0.03em]">Hiring dashboard</h1>
          </div>
          <Link
            href="/recruiter/jobs/new"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-forest px-6 font-display text-[15px] font-bold text-white shadow-soft transition-colors hover:bg-forest-deep"
          >
            <Plus size={17} aria-hidden /> Post a job
          </Link>
        </div>

        {sp.welcome === "1" && (
          <div className="mt-6 rounded-[24px] bg-forest p-5 text-white sm:p-6">
            <p className="font-display text-lg font-bold">Your company is ready{fullName ? `, ${fullName.split(" ")[0]}` : ""}.</p>
            <p className="mt-1 text-[14.5px] text-white/80">Post your first job. Every applicant is read and scored by the AI against your requirements, and you decide who moves forward.</p>
          </div>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map(({ label, value, Icon }) => (
            <div key={label} className="rounded-[24px] bg-paper p-4 shadow-soft ring-1 ring-line sm:p-5">
              <dt className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                <Icon size={15} aria-hidden /> {label}
              </dt>
              <dd className="mt-2 font-display text-[2rem] leading-none font-extrabold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-labelledby="my-jobs">
            <h2 id="my-jobs" className="font-display text-[1.15rem] font-extrabold tracking-[-0.02em]">
              Your jobs
            </h2>
            {(jobs ?? []).length === 0 ? (
              <div className="mt-3 rounded-[28px] bg-paper p-8 text-center shadow-soft ring-1 ring-line">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint text-forest">
                  <Sparkles size={22} aria-hidden />
                </span>
                <p className="mt-4 font-display text-[1.15rem] font-extrabold">No jobs yet</p>
                <p className="mx-auto mt-1 max-w-sm text-[14px] text-muted">Post one and candidates whose skills fit will see it ranked by match.</p>
                <Link href="/recruiter/jobs/new" className="mt-5 inline-flex h-11 items-center rounded-full bg-forest px-6 text-[14.5px] font-bold text-white hover:bg-forest-deep">
                  Post your first job
                </Link>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {(jobs ?? []).map((j) => {
                  const s = byJob.get(j.id) ?? { total: 0, fresh: 0, top: null };
                  return (
                    <li key={j.id} className="rounded-[24px] bg-paper p-4 shadow-soft ring-1 ring-line sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/recruiter/jobs/${j.id}`} className="font-display text-[1.05rem] font-bold tracking-tight hover:underline">
                              {j.title}
                            </Link>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold capitalize ${statusChip[j.status] ?? statusChip.closed}`}>{j.status}</span>
                          </div>
                          <p className="mt-1 text-[13px] text-muted">
                            {[levelShort[j.seniority], typeLabel[j.employment_type], workModeLabel[j.work_mode as keyof typeof workModeLabel], j.location]
                              .filter(Boolean)
                              .join(" · ")}
                            {j.published_at ? ` · posted ${timeAgo(j.published_at, now)} ago` : ""}
                          </p>
                        </div>
                        {s.top !== null && <MatchRing pct={s.top} ai />}
                      </div>
                      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px]">
                          <span className="inline-flex items-center gap-1.5" title="People who opened this job. Each person is counted once.">
                            <Eye size={14} className="text-muted" aria-hidden />
                            <span className="font-bold tabular-nums">{j.view_count}</span> view{j.view_count === 1 ? "" : "s"}
                          </span>
                          <span>
                            <span className="font-bold tabular-nums">{s.total}</span> applicant{s.total === 1 ? "" : "s"}
                            {s.fresh > 0 && <span className="ml-2 rounded-full bg-coral/15 px-2 py-0.5 text-[12px] font-bold text-[#b4391f]">{s.fresh} new</span>}
                          </span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <JobStatusButton jobId={j.id} status={j.status} />
                          <Link href={`/recruiter/jobs/${j.id}/edit`} className="inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold text-muted ring-1 ring-line transition-colors hover:bg-ink/5 hover:text-ink">
                            Edit
                          </Link>
                          <Link href={`/recruiter/jobs/${j.id}`} className="inline-flex h-9 items-center gap-1 rounded-full bg-mint px-4 text-[13px] font-bold text-forest-deep transition-colors hover:bg-mint/70">
                            Applicants <ChevronRight size={14} aria-hidden />
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside aria-labelledby="latest" className="lg:sticky lg:top-24">
            <h2 id="latest" className="font-display text-[1.15rem] font-extrabold tracking-[-0.02em]">
              Latest applicants
            </h2>
            <div className="mt-3 rounded-[24px] bg-paper p-2 shadow-soft ring-1 ring-line">
              {recent.length === 0 ? (
                <p className="px-3 py-5 text-[13.5px] leading-snug text-muted">No applicants yet. They show up here with their match score as soon as someone applies.</p>
              ) : (
                <ul>
                  {recent.map((a) => (
                    <li key={a.id}>
                      <Link href={`/recruiter/jobs/${a.job_id}?app=${a.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-ink/[0.04]">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint font-display text-[13px] font-bold text-forest-deep">
                          {(nameOf.get(a.candidate_id) ?? "?")
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p) => p[0]?.toUpperCase())
                            .join("") || "?"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{nameOf.get(a.candidate_id) ?? "Applicant"}</span>
                          <span className="block truncate text-[12.5px] text-muted">
                            {headlineOf.get(a.candidate_id) || titleOf.get(a.job_id)} · {timeAgo(a.created_at, now)}
                          </span>
                        </span>
                        {typeof a.match_score === "number" ? (
                          <span className="rounded-full bg-mint px-2.5 py-1 text-[12.5px] font-extrabold text-forest-deep tabular-nums">{a.match_score}%</span>
                        ) : (
                          <span className="text-[11.5px] font-semibold text-muted">Scoring…</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="animate-pulse">
      <div className="h-16 border-b border-line bg-paper" />
      <div className="mx-auto max-w-[1100px] space-y-4 px-6 py-10">
        <div className="h-12 w-1/2 rounded-xl bg-ink/8" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 rounded-[24px] bg-ink/6" />
          ))}
        </div>
        <div className="h-64 rounded-[28px] bg-ink/6" />
      </div>
    </div>
  );
}
