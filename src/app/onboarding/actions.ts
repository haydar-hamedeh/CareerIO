"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { refreshProfileEmbedding } from "@/lib/ai/profile-embedding";
import { createClient } from "@/lib/supabase/server";
import {
  candidateOnboardingSchema,
  employerOnboardingSchema,
  fieldErrors,
  type CandidateOnboarding,
  type EmployerOnboarding,
} from "@/lib/onboarding/schema";

export type SaveResult = { error?: string; fieldErrors?: Record<string, string> };

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/onboarding");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  return { supabase, user: data.user, role: profile?.role };
}

export async function saveCandidateOnboarding(input: CandidateOnboarding): Promise<SaveResult> {
  const parsed = candidateOnboardingSchema.safeParse(input);
  if (!parsed.success) return { error: "Some details need fixing.", fieldErrors: fieldErrors(parsed.error) };

  const { supabase, user, role } = await currentUser();
  if (role !== "candidate") return { error: "This form is for job seekers." };

  const { basics, experience, education, skills, preferences } = parsed.data;
  const unique = (list: string[]) => [...new Map(list.map((s) => [s.toLowerCase(), s])).values()];

  const { error: cpError } = await supabase
    .from("candidate_profiles")
    .update({
      headline: basics.headline,
      phone: basics.phone,
      country: basics.country,
      location: basics.city,
      seniority: experience.seniority,
      years_experience: experience.yearsExperience,
      experience: experience.positions,
      education: education.education,
      skills: unique(skills.skills),
      languages: unique(skills.languages),
      desired_roles: unique(preferences.desiredRoles),
      work_modes: preferences.workModes,
      preferred_locations: unique(preferences.preferredLocations),
      salary_min: preferences.salaryMin ?? null,
      salary_max: preferences.salaryMax ?? null,
      salary_currency: preferences.salaryMin || preferences.salaryMax ? preferences.salaryCurrency : null,
    })
    .eq("user_id", user.id);
  if (cpError) return { error: "We couldn't save your profile. Please try again." };

  const { error: pError } = await supabase
    .from("profiles")
    .update({ full_name: basics.fullName, onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (pError) return { error: "We couldn't save your profile. Please try again." };

  after(() => refreshProfileEmbedding(user.id));
  redirect("/feed?welcome=1");
}

export async function saveEmployerOnboarding(input: EmployerOnboarding): Promise<SaveResult> {
  const parsed = employerOnboardingSchema.safeParse(input);
  if (!parsed.success) return { error: "Some details need fixing.", fieldErrors: fieldErrors(parsed.error) };

  const { supabase, user, role } = await currentUser();
  if (role !== "employer") return { error: "This form is for employers." };

  const d = parsed.data;
  const { data: existing } = await supabase.from("companies").select("id").eq("owner_id", user.id).maybeSingle();
  const company = {
    name: d.companyName,
    size: d.size,
    website: d.website || null,
    location: d.location,
    description: d.description,
  };
  const { error: cError } = existing
    ? await supabase.from("companies").update(company).eq("id", existing.id)
    : await supabase.from("companies").insert({ ...company, owner_id: user.id });
  if (cError) return { error: "We couldn't save your company. Please try again." };

  const { error: pError } = await supabase
    .from("profiles")
    .update({ full_name: d.fullName, onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (pError) return { error: "We couldn't save your profile. Please try again." };

  redirect("/feed?welcome=1");
}
