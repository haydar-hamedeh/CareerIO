import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireEmployer } from "@/lib/auth/employer";
import { AppHeader } from "@/components/app/app-header";
import { JobForm, type JobFormInitial } from "@/components/recruiter/job-form";
import { parseQuestions } from "@/lib/jobs/screening";

export const metadata: Metadata = { title: "Edit job · CareerIO" };

export default function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="min-h-dvh w-full">
      <Suspense fallback={<div className="h-16 border-b border-line bg-paper" />}>
        <EditJob params={params} />
      </Suspense>
    </div>
  );
}

async function EditJob({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, company, fullName } = await requireEmployer(`/recruiter/jobs/${id}/edit`);

  const { data: j } = await supabase
    .from("jobs")
    .select(
      "id, title, description, requirements, skills, field, seniority, employment_type, work_mode, location, salary_min, salary_max, salary_currency, screening_questions",
    )
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!j) notFound();

  // The first paragraph is the one-line intro added on save; the form edits the rest.
  const body = j.description.split(/\n\n+/).slice(1).join("\n\n");
  const initial: JobFormInitial = {
    title: j.title,
    field: j.field,
    seniority: j.seniority,
    employmentType: j.employment_type,
    workMode: j.work_mode,
    location: j.location ?? "",
    salaryMin: j.salary_min ? String(j.salary_min) : "",
    salaryMax: j.salary_max ? String(j.salary_max) : "",
    salaryCurrency: j.salary_currency ?? "USD",
    description: body,
    requirements: (j.requirements ?? []).join("\n"),
    skills: j.skills ?? [],
    screeningQuestions: parseQuestions(j.screening_questions),
  };

  return (
    <>
      <AppHeader name={fullName} active="recruiter" role="employer" />
      <main className="mx-auto max-w-[760px] px-4 py-6 sm:px-6 lg:py-10">
        <Link href="/recruiter" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-muted transition-colors hover:bg-ink/5 hover:text-ink">
          <ArrowLeft size={15} aria-hidden /> Back to dashboard
        </Link>
        <h1 className="mt-4 mb-6 font-display text-[clamp(1.8rem,3.6vw,2.4rem)] leading-tight font-extrabold tracking-[-0.03em]">Edit job</h1>
        <JobForm jobId={j.id} initial={initial} />
      </main>
    </>
  );
}
