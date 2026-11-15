import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/app/app-header";
import { ProfileClient } from "@/components/profile/profile-client";
import type { ProfileRow } from "@/components/onboarding/sections";
import type { CvItem } from "./actions";
import { normSkill } from "@/lib/jobs/match";

export const metadata: Metadata = { title: "Your profile · CareerIO" };

export default function ProfilePage() {
  return (
    <div className="min-h-dvh w-full">
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile />
      </Suspense>
    </div>
  );
}

async function Profile() {
  await connection();
  const session = await requireSession("/profile");
  if (!session.onboarded) redirect("/onboarding");
  if (session.role !== "candidate") redirect("/feed");
  const { supabase, user, fullName } = session;

  const [{ data: row }, { data: cvRows }, { data: jobSkills }, { data: lastGrade }] = await Promise.all([
    supabase
      .from("candidate_profiles")
      .select(
        "headline, phone, country, location, seniority, years_experience, experience, education, skills, languages, desired_roles, work_modes, preferred_locations, salary_min, salary_max, salary_currency",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("cvs")
      .select("id, file_name, mime_type, size_bytes, is_primary, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("jobs").select("skills").eq("status", "open").limit(500),
    supabase.from("cv_grades").select("score, feedback, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const demandAll = new Map<string, number>();
  for (const j of jobSkills ?? []) for (const s of new Set(((j.skills ?? []) as string[]).map(normSkill))) demandAll.set(s, (demandAll.get(s) ?? 0) + 1);
  const demand: Record<string, number> = {};
  for (const s of (row?.skills as string[] | null) ?? []) demand[s] = demandAll.get(normSkill(s)) ?? 0;
  const grade = lastGrade
    ? {
        score: lastGrade.score as number,
        target: ((lastGrade.feedback as { targetLabel?: string } | null)?.targetLabel ?? "General review") as string,
        createdAt: lastGrade.created_at as string,
      }
    : null;

  const cvs: CvItem[] = (cvRows ?? []).map((c) => ({
    id: c.id,
    fileName: c.file_name,
    mimeType: c.mime_type,
    size: c.size_bytes,
    isPrimary: c.is_primary,
    createdAt: c.created_at,
  }));

  return (
    <>
      <AppHeader name={fullName} active="profile" />
      <ProfileClient userId={user.id} email={user.email ?? ""} fullName={fullName} row={row as ProfileRow | null} cvs={cvs} demand={demand} grade={grade} />
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile" className="animate-pulse">
      <div className="h-16 border-b border-line bg-paper" />
      <div className="mx-auto grid max-w-[1100px] gap-6 px-6 py-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="h-64 rounded-[28px] bg-ink/6" />
          <div className="h-40 rounded-[24px] bg-ink/6" />
          <div className="h-40 rounded-[24px] bg-ink/6" />
        </div>
        <div className="space-y-4">
          <div className="h-28 rounded-[24px] bg-ink/6" />
          <div className="h-72 rounded-[24px] bg-ink/6" />
        </div>
      </div>
    </div>
  );
}
