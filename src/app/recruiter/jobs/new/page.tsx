import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { requireEmployer } from "@/lib/auth/employer";
import { AppHeader } from "@/components/app/app-header";
import { JobForm, emptyJob } from "@/components/recruiter/job-form";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Post a job · CareerIO" };

export default function NewJobPage() {
  return (
    <PageTransition>
      <Suspense fallback={<div className="h-16 border-b border-line bg-paper" />}>
        <NewJob />
      </Suspense>
    </PageTransition>
  );
}

async function NewJob() {
  await connection();
  const { company, fullName } = await requireEmployer("/recruiter/jobs/new");
  return (
    <>
      <AppHeader name={fullName} active="post" role="employer" />
      <main className="mx-auto max-w-[760px] px-4 py-6 sm:px-6 lg:py-10">
        <Link href="/recruiter" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-muted transition-colors hover:bg-ink/5 hover:text-ink">
          <ArrowLeft size={15} aria-hidden /> Back to dashboard
        </Link>
        <h1 className="mt-4 font-display text-[clamp(1.8rem,3.6vw,2.4rem)] leading-tight font-extrabold tracking-[-0.03em]">Post a job</h1>
        <p className="mt-2 mb-6 text-muted">Skills decide who sees it first. Be specific about the ones that matter.</p>
        <JobForm initial={emptyJob} defaultLocation={company.location ?? ""} />
      </main>
    </>
  );
}
