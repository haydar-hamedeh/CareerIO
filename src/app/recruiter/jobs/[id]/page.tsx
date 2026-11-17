import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { z } from "zod";
import { requireEmployer } from "@/lib/auth/employer";
import { AppHeader } from "@/components/app/app-header";
import { Applicants } from "@/components/recruiter/applicants";
import { JobStatusButton } from "@/components/recruiter/job-status-button";
import { levelShort, typeLabel } from "@/lib/jobs/format";
import { workModeLabel } from "@/lib/onboarding/schema";
import type { ApplicantDto, AppStatus } from "@/lib/recruiter/types";

export const metadata: Metadata = { title: "Applicants · CareerIO" };

type Search = { app?: string };

export default function JobApplicantsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  return (
    <div className="min-h-dvh w-full">
      <Suspense fallback={<div className="h-16 border-b border-line bg-paper" />}>
        <JobApplicants params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

async function JobApplicants({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, company, fullName } = await requireEmployer(`/recruiter/jobs/${id}`);

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, status, seniority, employment_type, work_mode, location, skills, view_count")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!job) notFound();

  const { data: apps } = await supabase
    .from("applications")
    .select(
      "id, candidate_id, cv_id, status, cover_letter, match_score, match_explanation, feedback, reviewed_at, contact_phone, contact_country, screening_answers, interview_at, interview_note, created_at",
    )
    .eq("job_id", id)
    .order("created_at", { ascending: false });
  const rows = apps ?? [];
  const appIds = rows.map((a) => a.id);
  const candIds = [...new Set(rows.map((a) => a.candidate_id))];

  const [{ data: reviews }, { data: people }, { data: cps }] = rows.length
    ? await Promise.all([
        supabase.from("application_reviews").select("application_id, questions, skill_check, flagged, used_cv").in("application_id", appIds),
        supabase.from("profiles").select("id, full_name").in("id", candIds),
        supabase.from("candidate_profiles").select("user_id, headline, seniority, years_experience, skills, location").in("user_id", candIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const reviewOf = new Map((reviews ?? []).map((r) => [r.application_id, r]));
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name as string | null]));
  const profileOf = new Map((cps ?? []).map((p) => [p.user_id, p]));

  const applicants: ApplicantDto[] = rows.map((a) => {
    const r = reviewOf.get(a.id);
    const p = profileOf.get(a.candidate_id);
    const fb = (a.feedback ?? {}) as { strengths?: unknown; gaps?: unknown };
    const sc = r?.skill_check as ApplicantDto["skillCheck"] | undefined;
    return {
      id: a.id,
      name: nameOf.get(a.candidate_id) || "Applicant",
      headline: p?.headline ?? "",
      level: p?.seniority ? (levelShort[p.seniority] ?? p.seniority) : null,
      years: p?.years_experience !== null && p?.years_experience !== undefined ? Number(p.years_experience) : null,
      location: p?.location ?? "",
      skills: p?.skills ?? [],
      status: a.status as AppStatus,
      score: a.match_score,
      summary: a.match_explanation,
      strengths: strings(fb.strengths),
      gaps: strings(fb.gaps),
      questions: strings(r?.questions),
      skillCheck: sc && Array.isArray(sc.has) ? sc : null,
      flagged: Boolean(r?.flagged),
      usedCv: Boolean(r?.used_cv),
      phone: a.contact_phone,
      country: a.contact_country,
      note: a.cover_letter,
      answers: (Array.isArray(a.screening_answers) ? (a.screening_answers as { q?: string; a?: string }[]) : [])
        .filter((x) => x?.q && x?.a)
        .map((x) => ({ q: x.q as string, a: x.a as string })),
      hasCv: Boolean(a.cv_id),
      interviewAt: a.interview_at,
      interviewNote: a.interview_note,
      createdAt: a.created_at,
    };
  });

  const meta = [levelShort[job.seniority], typeLabel[job.employment_type], workModeLabel[job.work_mode as keyof typeof workModeLabel], job.location].filter(Boolean).join(" · ");

  return (
    <>
      <AppHeader name={fullName} active="recruiter" role="employer" />
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:py-10">
        <Link href="/recruiter" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-muted transition-colors hover:bg-ink/5 hover:text-ink">
          <ArrowLeft size={15} aria-hidden /> Back to dashboard
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.2rem)] leading-tight font-extrabold tracking-[-0.03em]">{job.title}</h1>
            <p className="mt-1 text-[14px] text-muted">
              <span className="font-semibold capitalize text-ink">{job.status}</span> · {meta}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JobStatusButton jobId={job.id} status={job.status} />
            <Link href={`/recruiter/jobs/${job.id}/edit`} className="inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold text-muted ring-1 ring-line transition-colors hover:bg-ink/5 hover:text-ink">
              Edit
            </Link>
            <Link href={`/jobs/${job.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-muted ring-1 ring-line transition-colors hover:bg-ink/5 hover:text-ink">
              Candidate view <ExternalLink size={12} aria-hidden />
            </Link>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Views", value: String(job.view_count), hint: "Each person counted once" },
            { label: "Applicants", value: String(applicants.length), hint: "Total received" },
            {
              label: "Applied",
              value: job.view_count > 0 ? `${Math.min(100, Math.round((applicants.length / job.view_count) * 100))}%` : "–",
              hint: "Of the people who viewed",
            },
          ].map((t) => (
            <div key={t.label} className="rounded-[20px] bg-paper p-4 shadow-soft ring-1 ring-line">
              <dt className="text-[13px] font-semibold text-muted">{t.label}</dt>
              <dd className="mt-1 font-display text-[1.7rem] leading-none font-extrabold tabular-nums">{t.value}</dd>
              <p className="mt-1.5 hidden text-[12px] text-muted sm:block">{t.hint}</p>
            </div>
          ))}
        </dl>

        <Applicants applicants={applicants} jobSkills={job.skills ?? []} initialOpen={sp.app ?? null} />
      </main>
    </>
  );
}
