"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { companySizes } from "@/lib/onboarding/schema";
import { cleanUserText } from "@/lib/ai/safety";

type Result = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; logoPath?: string | null };

const schema = z.object({
  name: z.string().trim().min(2, { error: "Enter the company name." }).max(120),
  industry: z.string().trim().max(80, { error: "Keep the industry under 80 characters." }),
  size: z.enum(companySizes, { error: "Choose the company size." }),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), { error: "Use a full link, like https://example.com." }),
  location: z.string().trim().min(2, { error: "Where is the company based?" }).max(120),
  description: z.string().trim().min(20, { error: "Write at least a sentence about the company." }).max(4000),
});

export type CompanyInput = z.input<typeof schema>;

async function owner() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: company } = await supabase.from("companies").select("id, logo_path").eq("owner_id", data.user.id).maybeSingle();
  if (!company) return null;
  return { supabase, userId: data.user.id, company };
}

const NOT_ALLOWED: Result = { error: "Only the company owner can do this. Please log in again." };

function refresh(companyId: string) {
  revalidatePath("/recruiter/company");
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/feed");
}

export async function saveCompany(input: CompanyInput): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { error: "Some details need fixing.", fieldErrors };
  }
  const ctx = await owner();
  if (!ctx) return NOT_ALLOWED;
  const d = parsed.data;
  const { error } = await ctx.supabase
    .from("companies")
    .update({
      name: cleanUserText(d.name),
      industry: cleanUserText(d.industry) || null,
      size: d.size,
      website: d.website || null,
      location: cleanUserText(d.location),
      description: cleanUserText(d.description),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.company.id);
  if (error) return { error: "We couldn't save your company. Please try again." };
  refresh(ctx.company.id);
  return { ok: true };
}

/** Called after the browser uploaded a logo to the user's own folder. Points the company at it and removes the old one. */
export async function setCompanyLogo(path: string): Promise<Result> {
  const ctx = await owner();
  if (!ctx) return NOT_ALLOWED;
  if (!new RegExp(`^${ctx.userId}/[0-9a-f-]{36}\\.(png|jpg|webp)$`).test(path)) return { error: "That logo file isn't valid." };
  const old = ctx.company.logo_path as string | null;
  const { error } = await ctx.supabase.from("companies").update({ logo_path: path, updated_at: new Date().toISOString() }).eq("id", ctx.company.id);
  if (error) return { error: "We couldn't save the logo. Please try again." };
  if (old && old !== path) await ctx.supabase.storage.from("company-logos").remove([old]);
  refresh(ctx.company.id);
  return { ok: true, logoPath: path };
}

export async function removeCompanyLogo(): Promise<Result> {
  const ctx = await owner();
  if (!ctx) return NOT_ALLOWED;
  const old = ctx.company.logo_path as string | null;
  const { error } = await ctx.supabase.from("companies").update({ logo_path: null, updated_at: new Date().toISOString() }).eq("id", ctx.company.id);
  if (error) return { error: "We couldn't remove the logo. Please try again." };
  if (old) await ctx.supabase.storage.from("company-logos").remove([old]);
  refresh(ctx.company.id);
  return { ok: true, logoPath: null };
}
