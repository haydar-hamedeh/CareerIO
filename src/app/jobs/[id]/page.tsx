import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, Briefcase, Building2, Check, Clock, Globe, MapPin, Users, Wallet } from "lucide-react";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/app/app-header";
import { MatchRing } from "@/components/feed/job-card";
import { ChanceCard } from "@/components/jobs/chance-card";
import { ViewTracker } from "@/components/jobs/view-tracker";
import { ApplyCard, type ApplicationInfo } from "@/components/jobs/apply-card";
import { CompanyAvatar } from "@/components/company/company-avatar";
import { fitTone, levelShort, parseDescription, typeLabel } from "@/lib/jobs/format";
import { capScore, computeFit, currentTime, fitReason, formatSalary, timeAgo } from "@/lib/jobs/match";
import { mergeSkills, primaryCvSkills } from "@/lib/jobs/cv-skills";
import { matchProfileHash } from "@/lib/ai/match-score";
import { workModeLabel } from "@/lib/onboarding/schema";
import { parseQuestions } from "@/lib/jobs/screening";
import { PageTransition } from "@/components/page-transition";

export const maxDuration = 120;
export const metadata: Metadata = { title: "Job · CareerIO" };

type Props = { params: Promise<{ id: string }> };

export default function JobPage({ params }: Props) {
  return (
    <PageTransition>
      <Suspense fallback={<JobSkeleton />}>
        <Job params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function Job({ params }: Props) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const session = await requireSession(`/jobs/${id}`);
  if (!session.onboarded) redirect("/onboarding");
  const { supabase, user, role, fullName } = session;
  const isCandidate = role === "candidate";

  const { data: j } = await supabase
    .from("jobs")
    .select(
      "id, title, description, requirements, skills, seniority, employment_type, work_mode, location, salary_min, salary_max, salary_currency, status, published_at, is_demo, screening_questions, companies(id, owner_id, name, size, location, website, description, logo_path)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!j) notFound();

  const [{ data: profile }, { data: cvRows }, { data: app }, { data: savedRow }] = await Promise.all([
    isCandidate
      ? supabase
          .from("candidate_profiles")
          .select("headline, skills, desired_roles, work_modes, seniority, years_experience, experience, education, phone, country, embedding")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isCandidate
      ? supabase.from("cvs").select("id, file_name, is_primary").eq("user_id", user.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    isCandidate ? supabase.from("applications").select("status, created_at").eq("job_id", id).eq("candidate_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    isCandidate ? supabase.from("saved_jobs").select("job_id").eq("user_id", user.id).eq("job_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // The same inputs the feed uses, so the score here always matches the feed: skills from the profile and the CV,
  // and the AI score from the cached AI pass when there is one for the current profile.
  const cvSkills = isCandidate ? await primaryCvSkills(supabase, user.id) : [];
  const matchSkills = mergeSkills(profile?.skills ?? [], cvSkills);
  let ai: { score: number; reason: string } | null = null;
  if (isCandidate && profile) {
    const hash = await matchProfileHash(profile, cvSkills);
    const { data: row } = await supabase.from("ai_match_scores").select("score, reason").eq("job_id", id).eq("profile_hash", hash).maybeSingle();
    if (row) ai = { score: row.score, reason: row.reason };
  }

  let semantic: number | null = null;
  if (isCandidate && profile?.embedding) {
    const { data: sims } = await supabase.rpc("match_jobs", { query_embedding: profile.embedding, match_count: 200 });
    semantic = ((sims ?? []) as { job_id: string; similarity: number }[]).find((r) => r.job_id === id)?.similarity ?? null;
  }

  const c = (Array.isArray(j.companies) ? j.companies[0] : j.companies) as {
    id: string;
    logo_path: string | null;
    owner_id: string | null;
    name: string;
    size: string | null;
    location: string | null;
    website: string | null;
    description: string | null;
  } | null;
  const company = c?.name ?? "Company";
  const skills: string[] = j.skills ?? [];

  const fit = isCandidate
    ? computeFit({
        jobTitle: j.title,
        jobSkills: skills,
        jobMode: j.work_mode,
        jobLevel: j.seniority,
        skills: matchSkills,
        desiredRoles: profile?.desired_roles ?? [],
        headline: profile?.headline ?? "",
        workModes: profile?.work_modes ?? [],
        level: profile?.seniority ?? null,
        semantic,
      })
    : null;
  if (ai && fit) ai = { ...ai, score: capScore(ai.score, fit) };
  const matched = new Set((fit?.matched ?? []).map((s) => s.toLowerCase()));
  const { intro, sections } = parseDescription(j.description, j.requirements ?? []);
  const salary = formatSalary(j.salary_min, j.salary_max, j.salary_currency);
  const mode = workModeLabel[j.work_mode as keyof typeof workModeLabel] ?? j.work_mode;
  const level = levelShort[j.seniority] ?? j.seniority;
  const type = typeLabel[j.employment_type] ?? j.employment_type;
  const posted = timeAgo(j.published_at, currentTime());
  const websiteHost = c?.website ? c.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;
  const isLiveWebsite = Boolean(c?.website && !c.website.includes(".example."));
  const closed = j.status !== "open";
  const ownsJob = !isCandidate && c?.owner_id === user.id;
  const application: ApplicationInfo | null = app ? { status: app.status as ApplicationInfo["status"], createdAt: app.created_at } : null;

  return (
    <>
      <AppHeader name={fullName} active={isCandidate ? "feed" : "recruiter"} role={role} />
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:py-10">
        {isCandidate && <ViewTracker jobId={j.id} />}
        <Link href={isCandidate ? "/feed" : "/recruiter"} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-muted transition-colors hover:bg-ink/5 hover:text-ink">
          <ArrowLeft size={15} aria-hidden />
          {isCandidate ? "Back to jobs" : "Back to dashboard"}
        </Link>

        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <div className="min-w-0 space-y-4">
            <section className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-8">
              <header className="flex items-start gap-4">
                <CompanyAvatar name={company} logoPath={c?.logo_path} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-[14px] text-muted">
                    {c?.id ? (
                      <Link href={`/companies/${c.id}`} className="font-semibold text-ink hover:underline">
                        {company}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">{company}</span>
                    )}
                    {c?.size && <span>· {c.size} people</span>}
                    {posted && (
                      <span className="inline-flex items-center gap-1">
                        · <Clock size={12} aria-hidden /> {posted} ago
                      </span>
                    )}
                  </p>
                  <h1 className="mt-1 font-display text-[clamp(1.6rem,3.2vw,2.2rem)] leading-[1.1] font-extrabold tracking-[-0.03em]">{j.title}</h1>
                </div>
                {fit && <MatchRing pct={ai?.score ?? fit.score} ai={Boolean(ai)} />}
              </header>

              <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
                <Meta icon={<MapPin size={13} aria-hidden />}>{j.location || "Location flexible"}</Meta>
                <Meta icon={<Building2 size={13} aria-hidden />}>{mode}</Meta>
                <Meta icon={<Briefcase size={13} aria-hidden />}>
                  {level} · {type}
                </Meta>
                {salary && <Meta icon={<Wallet size={13} aria-hidden />}>{salary}</Meta>}
                {j.is_demo && <span className="rounded-full bg-ink/[0.05] px-2.5 py-1 font-medium text-muted">Sample listing</span>}
                {closed && <span className="rounded-full bg-coral/15 px-2.5 py-1 font-semibold text-[#b4391f]">No longer accepting applications</span>}
              </div>

              {fit && (
                <div className="mt-5 rounded-2xl bg-sand px-4 py-3 text-[14px] leading-snug">
                  <p>
                    <span className={`font-bold ${fitTone(ai?.score ?? fit.score).text}`}>{fitTone(ai?.score ?? fit.score).label}: </span>
                    {ai ? ai.reason : fitReason(fit, skills.length) || "Add skills to your profile for a better match."}
                  </p>
                  {ai && fitReason(fit, skills.length) && <p className="mt-1.5 text-[13px] text-muted">{fitReason(fit, skills.length)}</p>}
                </div>
              )}
            </section>

            <section className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-8">
              <h2 className="font-display text-[1.15rem] font-extrabold tracking-[-0.02em]">About the role</h2>
              <p className="mt-3 text-[15.5px] leading-relaxed text-ink/90">{intro}</p>
              <div className="mt-6 space-y-6">
                {sections.map((sec, idx) => (
                  <section key={`${sec.heading ?? "block"}-${idx}`} className="space-y-2.5">
                    {sec.heading && <h3 className="font-display text-[15px] font-bold tracking-tight">{sec.heading}</h3>}
                    {sec.paragraphs.map((p, pi) => (
                      <p key={pi} className="text-[15px] leading-relaxed text-ink/85">
                        {p}
                      </p>
                    ))}
                    {sec.bullets.length > 0 && (
                      <ul className="space-y-2 text-[15px] leading-relaxed text-ink/85">
                        {sec.bullets.map((b, bi) => (
                          <li key={bi} className="flex items-start gap-2.5">
                            <span className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-mint text-forest-deep" aria-hidden>
                              <Check size={10} strokeWidth={3} />
                            </span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>

              {skills.length > 0 && (
                <div className="mt-7 border-t border-line pt-6">
                  <h3 className="font-display text-[15px] font-bold tracking-tight">Skills</h3>
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills">
                    {skills.map((s) => {
                      const has = matched.has(s.toLowerCase());
                      return (
                        <li key={s} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${has ? "bg-forest text-white" : "bg-white text-ink/70 ring-1 ring-line"}`}>
                          {s}
                          {has && <span className="sr-only"> (you have this)</span>}
                        </li>
                      );
                    })}
                  </ul>
                  {isCandidate && fit && <p className="mt-2.5 text-[12.5px] text-muted">Green skills are ones on your profile.</p>}
                </div>
              )}
            </section>

            {(c?.description || c?.location || websiteHost) && (
              <section className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-[1.15rem] font-extrabold tracking-[-0.02em]">About {company}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
                    {c?.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} aria-hidden />
                        {c.location}
                      </span>
                    )}
                    {c?.size && (
                      <span className="inline-flex items-center gap-1">
                        <Users size={13} aria-hidden />
                        {c.size} people
                      </span>
                    )}
                    {websiteHost &&
                      (isLiveWebsite && c?.website ? (
                        <a href={c.website} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium text-forest hover:underline">
                          <Globe size={13} aria-hidden />
                          {websiteHost}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Globe size={13} aria-hidden />
                          {websiteHost}
                        </span>
                      ))}
                  </div>
                </div>
                {c?.description && <p className="mt-3 text-[15px] leading-relaxed text-ink/85">{c.description}</p>}
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-[32px] bg-ink/[0.035] p-2 shadow-soft ring-1 ring-line">
              <div className="rounded-[26px] bg-paper p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.75)]">
                <p className="font-display text-[1.05rem] font-extrabold tracking-[-0.02em]">{closed ? "Closed" : isCandidate ? "Interested?" : "Employer view"}</p>
                <p className="mt-1 mb-4 text-[13.5px] leading-snug text-muted">
                  {closed
                    ? "This job isn't taking new applications."
                    : isCandidate
                      ? "Your details are filled in from your profile. You can change them before sending."
                      : "Only job seekers can apply. Switch to a candidate account to try the apply flow."}
                </p>
                {isCandidate && !closed ? (
                  <ApplyCard
                    jobId={j.id}
                    title={j.title}
                    company={company}
                    cvs={(cvRows ?? []).map((r) => ({ id: r.id, fileName: r.file_name, isPrimary: r.is_primary }))}
                    profile={{ phone: profile?.phone ?? null, country: profile?.country ?? null }}
                    application={application}
                    questions={parseQuestions(j.screening_questions)}
                    saved={Boolean(savedRow)}
                  >
                    <ChanceCard jobId={j.id} />
                  </ApplyCard>
                ) : ownsJob ? (
                  <Link
                    href={`/recruiter/jobs/${j.id}`}
                    className="inline-flex h-12 w-full items-center justify-center rounded-full bg-forest font-display text-[15px] font-bold text-white shadow-lift transition-colors hover:bg-forest-deep"
                  >
                    View applicants
                  </Link>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-ink/80 ring-1 ring-line">
      {icon}
      {children}
    </span>
  );
}

function JobSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading job" className="animate-pulse">
      <div className="h-16 border-b border-line bg-paper" />
      <div className="mx-auto grid max-w-[1100px] gap-6 px-6 py-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="h-52 rounded-[28px] bg-ink/6" />
          <div className="h-96 rounded-[28px] bg-ink/6" />
        </div>
        <div className="h-72 rounded-[32px] bg-ink/6" />
      </div>
    </div>
  );
}
