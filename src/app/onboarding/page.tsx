import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/app/app-header";
import { CandidateWizardLoader } from "@/components/onboarding/candidate-wizard-loader";
import { EmployerForm } from "@/components/onboarding/employer-form";

export const metadata: Metadata = { title: "Set up your profile · CareerIO" };

export default function OnboardingPage() {
  return (
    <div className="min-h-dvh w-full">
      <Suspense fallback={<OnboardingSkeleton />}>
        <Onboarding />
      </Suspense>
    </div>
  );
}

async function Onboarding() {
  await connection();
  const session = await requireSession("/onboarding");
  if (session.onboarded) {
    if (session.role !== "employer") redirect("/feed");
    // An employer who finished setup but has no company still needs to create it, so don't bounce them back.
    const { data: company } = await session.supabase.from("companies").select("id").eq("owner_id", session.user.id).maybeSingle();
    if (company) redirect("/recruiter");
  }
  const geo = (await headers()).get("x-vercel-ip-country")?.toUpperCase() ?? null;

  return (
    <>
      <AppHeader name={session.fullName} showProfile={false} />
      {session.role === "employer" ? (
        <EmployerForm initialName={session.fullName} />
      ) : (
        <CandidateWizardLoader initialName={session.fullName} userId={session.user.id} geoCountry={geo} />
      )}
    </>
  );
}

function OnboardingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-16 border-b border-line bg-paper" />
      <div className="mx-auto grid max-w-[1100px] gap-10 px-6 py-14 lg:grid-cols-[260px_1fr]">
        <div className="hidden space-y-3 lg:block">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-12 rounded-2xl bg-ink/6" />
          ))}
        </div>
        <div>
          <div className="h-10 w-1/2 rounded-xl bg-ink/8" />
          <div className="mt-3 h-4 w-2/3 rounded bg-ink/6" />
          <div className="mt-8 h-80 rounded-[28px] bg-ink/6" />
        </div>
      </div>
    </div>
  );
}
