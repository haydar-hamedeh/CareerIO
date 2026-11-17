import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { z } from "zod";
import { requireEmployer } from "@/lib/auth/employer";
import { AppHeader } from "@/components/app/app-header";
import { TalentClient } from "@/components/recruiter/talent-client";
import { runTalentSearch } from "@/lib/recruiter/talent";

export const metadata: Metadata = { title: "Find talent · CareerIO" };

export default function TalentPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  return (
    <div className="min-h-dvh w-full">
      <Suspense fallback={<div className="h-16 border-b border-line bg-paper" />}>
        <Talent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Talent({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  await connection();
  const sp = await searchParams;
  const { supabase, company, fullName } = await requireEmployer("/recruiter/talent");

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("company_id", company.id)
    .eq("status", "open")
    .order("published_at", { ascending: false })
    .limit(50);
  const openJobs = jobs ?? [];
  const wanted = z.uuid().safeParse(sp.job).success ? sp.job : undefined;
  const jobId = openJobs.find((j) => j.id === wanted)?.id ?? openJobs[0]?.id ?? null;
  const initial = await runTalentSearch(supabase, { q: "", jobId });

  return (
    <>
      <AppHeader name={fullName} active="talent" role="employer" />
      <TalentClient jobs={openJobs} initialJobId={jobId} initial={initial} />
    </>
  );
}
