import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/app/app-header";
import { GraderClient } from "@/components/grader/grader-client";

export const metadata: Metadata = { title: "CV Grader · CareerIO" };

export default function GraderPage({ searchParams }: PageProps<"/grader">) {
  return (
    <div className="min-h-dvh w-full">
      <Suspense fallback={<GraderSkeleton />}>
        <Grader searchParams={searchParams as Promise<{ job?: string }>} />
      </Suspense>
    </div>
  );
}

function GraderSkeleton() {
  return (
    <>
      <div className="h-16 border-b border-line bg-paper" />
      <div className="mx-auto max-w-[1240px] animate-pulse px-4 py-8 sm:px-6 lg:py-12" aria-hidden>
        <div className="h-6 w-28 rounded-full bg-mint" />
        <div className="mt-4 h-12 w-64 rounded-2xl bg-ink/[0.07]" />
        <div className="mt-4 h-4 w-full max-w-[460px] rounded-full bg-ink/[0.05]" />
        <div className="mt-10 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-8">
          <div className="h-[520px] rounded-[32px] bg-ink/[0.04] ring-1 ring-line" />
          <div className="space-y-4">
            <div className="h-[226px] rounded-[32px] bg-forest/15" />
            <div className="h-[260px] rounded-[28px] bg-ink/[0.04] ring-1 ring-line" />
          </div>
        </div>
      </div>
    </>
  );
}

async function Grader({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  await connection();
  const sp = await searchParams;
  const session = await requireSession("/grader");
  if (!session.onboarded) redirect("/onboarding");
  if (session.role !== "candidate") redirect("/feed");
  const { supabase, user, fullName } = session;

  const jobId = z.uuid().safeParse(sp.job).success ? sp.job : null;
  const [{ data: cvRows }, { data: profile }, { data: jobRow }, { data: gradeRows }] = await Promise.all([
    supabase.from("cvs").select("id, file_name, is_primary").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("candidate_profiles").select("desired_roles").eq("user_id", user.id).maybeSingle(),
    jobId ? supabase.from("jobs").select("id, title, companies(name)").eq("id", jobId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("cv_grades").select("id, cv_id, score, target_role, created_at").eq("user_id", user.id).order("created_at", { ascending: true }).limit(200),
  ]);

  const company = jobRow ? ((Array.isArray(jobRow.companies) ? jobRow.companies[0] : jobRow.companies) as { name: string } | null) : null;

  return (
    <>
      <AppHeader name={fullName} active="grader" />
      <GraderClient
        userId={user.id}
        cvs={(cvRows ?? []).map((c) => ({ id: c.id, fileName: c.file_name, isPrimary: c.is_primary }))}
        roles={profile?.desired_roles ?? []}
        job={jobRow ? { id: jobRow.id, title: jobRow.title, company: company?.name ?? "" } : null}
        history={(gradeRows ?? []).map((g) => ({ id: g.id, cvId: g.cv_id, score: g.score, target: g.target_role, createdAt: g.created_at }))}
      />
    </>
  );
}
