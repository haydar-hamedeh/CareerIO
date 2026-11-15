"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { refreshProfileEmbedding } from "@/lib/ai/profile-embedding";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  basicsSchema,
  educationSchema,
  experienceSchema,
  fieldErrors,
  preferencesSchema,
  skillsSchema,
  type CandidateOnboarding,
} from "@/lib/onboarding/schema";

type Result = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };
type SectionKey = keyof CandidateOnboarding;

const schemas = {
  basics: basicsSchema,
  experience: experienceSchema,
  education: educationSchema,
  skills: skillsSchema,
  preferences: preferencesSchema,
} as const;

const unique = (list: string[]) => [...new Map(list.map((s) => [s.toLowerCase(), s])).values()];

async function candidate() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  if (p?.role !== "candidate") return null;
  return { supabase, userId: data.user.id };
}

export async function updateProfileSection<K extends SectionKey>(key: K, input: CandidateOnboarding[K]): Promise<Result> {
  if (!(key in schemas)) return { error: "Unknown section." };
  const parsed = schemas[key].safeParse(input);
  if (!parsed.success) return { error: "Some details need fixing.", fieldErrors: fieldErrors(parsed.error) };

  const ctx = await candidate();
  if (!ctx) return { error: "Please log in again." };
  const { supabase, userId } = ctx;

  let update: Record<string, unknown> = {};
  if (key === "basics") {
    const b = parsed.data as z.infer<typeof basicsSchema>;
    const { error } = await supabase.from("profiles").update({ full_name: b.fullName }).eq("id", userId);
    if (error) return { error: "We couldn't save your changes. Please try again." };
    update = { headline: b.headline, phone: b.phone, country: b.country, location: b.city };
  } else if (key === "experience") {
    const e = parsed.data as z.infer<typeof experienceSchema>;
    update = { seniority: e.seniority, years_experience: e.yearsExperience, experience: e.positions };
  } else if (key === "education") {
    update = { education: (parsed.data as z.infer<typeof educationSchema>).education };
  } else if (key === "skills") {
    const s = parsed.data as z.infer<typeof skillsSchema>;
    update = { skills: unique(s.skills), languages: unique(s.languages) };
  } else if (key === "preferences") {
    const p = parsed.data as z.infer<typeof preferencesSchema>;
    update = {
      desired_roles: unique(p.desiredRoles),
      work_modes: p.workModes,
      preferred_locations: unique(p.preferredLocations),
      salary_min: p.salaryMin ?? null,
      salary_max: p.salaryMax ?? null,
      salary_currency: p.salaryMin || p.salaryMax ? p.salaryCurrency : null,
    };
  }

  const { error } = await supabase.from("candidate_profiles").update(update).eq("user_id", userId);
  if (error) return { error: "We couldn't save your changes. Please try again." };

  after(() => refreshProfileEmbedding(userId));
  revalidatePath("/profile");
  revalidatePath("/feed");
  return { ok: true };
}

const MIMES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const;

const cvInput = z.object({
  path: z.string().min(10).max(300),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(MIMES),
  size: z.number().int().positive().max(5 * 1024 * 1024),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type CvItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  isPrimary: boolean;
  createdAt: string;
};

export async function registerCv(input: z.input<typeof cvInput>): Promise<Result & { cv?: CvItem }> {
  const parsed = cvInput.safeParse(input);
  if (!parsed.success) return { error: "That file can't be used. Upload a PDF or Word file up to 5 MB." };
  const ctx = await candidate();
  if (!ctx) return { error: "Please log in again." };
  const { supabase, userId } = ctx;
  const v = parsed.data;
  if (!v.path.startsWith(`${userId}/`)) return { error: "Upload location is not allowed." };

  const { error: clearErr } = await supabase.from("cvs").update({ is_primary: false }).eq("user_id", userId).eq("is_primary", true);
  if (clearErr) return { error: "We couldn't save your CV. Please try again." };

  const { data, error } = await supabase
    .from("cvs")
    .insert({
      user_id: userId,
      storage_path: v.path,
      file_name: v.fileName,
      mime_type: v.mimeType,
      size_bytes: v.size,
      content_hash: v.hash,
      is_primary: true,
    })
    .select("id, file_name, mime_type, size_bytes, is_primary, created_at")
    .single();
  if (error || !data) {
    await supabase.storage.from("cvs").remove([v.path]);
    return { error: "We couldn't save your CV. Please try again." };
  }

  revalidatePath("/profile");
  return {
    ok: true,
    cv: {
      id: data.id,
      fileName: data.file_name,
      mimeType: data.mime_type,
      size: data.size_bytes,
      isPrimary: data.is_primary,
      createdAt: data.created_at,
    },
  };
}

const id = z.uuid();

export async function getCvLink(cvId: string): Promise<{ url?: string; error?: string }> {
  if (!id.safeParse(cvId).success) return { error: "Not found." };
  const ctx = await candidate();
  if (!ctx) return { error: "Please log in again." };
  const { data: cv } = await ctx.supabase.from("cvs").select("storage_path").eq("id", cvId).eq("user_id", ctx.userId).maybeSingle();
  if (!cv) return { error: "Not found." };
  const { data, error } = await ctx.supabase.storage.from("cvs").createSignedUrl(cv.storage_path, 60);
  if (error || !data) return { error: "Couldn't open the file. Please try again." };
  return { url: data.signedUrl };
}

export async function setPrimaryCv(cvId: string): Promise<Result> {
  if (!id.safeParse(cvId).success) return { error: "Not found." };
  const ctx = await candidate();
  if (!ctx) return { error: "Please log in again." };
  await ctx.supabase.from("cvs").update({ is_primary: false }).eq("user_id", ctx.userId).eq("is_primary", true);
  const { error } = await ctx.supabase.from("cvs").update({ is_primary: true }).eq("id", cvId).eq("user_id", ctx.userId);
  if (error) return { error: "Couldn't update. Please try again." };
  revalidatePath("/profile");
  return { ok: true };
}

export async function deleteCv(cvId: string): Promise<Result> {
  if (!id.safeParse(cvId).success) return { error: "Not found." };
  const ctx = await candidate();
  if (!ctx) return { error: "Please log in again." };
  const { data: cv } = await ctx.supabase
    .from("cvs")
    .select("storage_path, is_primary")
    .eq("id", cvId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!cv) return { error: "Not found." };

  const { error: sErr } = await ctx.supabase.storage.from("cvs").remove([cv.storage_path]);
  if (sErr) return { error: "Couldn't delete the file. Please try again." };
  const { error } = await ctx.supabase.from("cvs").delete().eq("id", cvId).eq("user_id", ctx.userId);
  if (error) return { error: "Couldn't delete the file. Please try again." };

  if (cv.is_primary) {
    const { data: next } = await ctx.supabase
      .from("cvs")
      .select("id")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next) await ctx.supabase.from("cvs").update({ is_primary: true }).eq("id", next.id);
  }
  revalidatePath("/profile");
  return { ok: true };
}
