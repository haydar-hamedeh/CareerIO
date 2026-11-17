"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { admin, hasAdmin } from "@/lib/supabase/admin";
import { friendlyAuthError } from "@/lib/auth/messages";
import { password } from "@/lib/auth/schemas";

type Result = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

async function current() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return { supabase, user: data.user, role: (profile?.role ?? "candidate") as "candidate" | "employer" };
}

const LOGIN: Result = { error: "Please log in again." };

const notificationSchema = z.object({
  emailNotifications: z.boolean(),
  jobAlerts: z.enum(["off", "daily", "weekly"]).optional(),
  discoverable: z.boolean().optional(),
});

export async function saveSettings(input: z.input<typeof notificationSchema>): Promise<Result> {
  const parsed = notificationSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  const ctx = await current();
  if (!ctx) return LOGIN;
  const d = parsed.data;
  const row: Record<string, unknown> = { user_id: ctx.user.id, email_notifications: d.emailNotifications, updated_at: new Date().toISOString() };
  // Only job seekers have alerts and a searchable profile.
  if (ctx.role === "candidate") {
    if (d.jobAlerts) row.job_alerts = d.jobAlerts;
    if (typeof d.discoverable === "boolean") row.discoverable = d.discoverable;
  }
  const { error } = await ctx.supabase.from("user_settings").upsert(row, { onConflict: "user_id" });
  if (error) return { error: "We couldn't save your settings. Please try again." };
  revalidatePath("/settings");
  return { ok: true };
}

export async function changeEmail(input: { email: string }): Promise<Result> {
  const parsed = z.email({ error: "Enter a valid email address." }).trim().toLowerCase().safeParse(input.email);
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0]?.message ?? "Enter a valid email address." } };
  const ctx = await current();
  if (!ctx) return LOGIN;
  if (parsed.data === ctx.user.email?.toLowerCase()) return { fieldErrors: { email: "That is already your email." } };
  const h = await headers();
  const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await ctx.supabase.auth.updateUser({ email: parsed.data }, { emailRedirectTo: `${origin}/auth/callback?next=/settings` });
  if (error) return { error: friendlyAuthError(error.message) };
  return { ok: true };
}

const passwordSchema = z
  .object({ current: z.string().max(200).optional(), password, confirm: z.string().min(1, { error: "Confirm your password." }) })
  .refine((v) => v.password === v.confirm, { error: "Passwords do not match.", path: ["confirm"] });

export async function changePassword(input: { current?: string; password: string; confirm: string }): Promise<Result> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "password")] ??= i.message;
    return { fieldErrors };
  }
  const ctx = await current();
  if (!ctx) return LOGIN;

  // Accounts that already have a password must prove they know it. Google-only accounts are just adding one.
  const hasPassword = Array.isArray(ctx.user.app_metadata?.providers) && ctx.user.app_metadata.providers.includes("email");
  if (hasPassword) {
    if (!parsed.data.current) return { fieldErrors: { current: "Enter your current password." } };
    const { error: authError } = await ctx.supabase.auth.signInWithPassword({ email: ctx.user.email ?? "", password: parsed.data.current });
    if (authError) return { fieldErrors: { current: "That password isn't right." } };
  }
  const { error } = await ctx.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: friendlyAuthError(error.message) };
  return { ok: true };
}

async function removeFolder(bucket: string, uid: string) {
  const db = admin();
  const { data } = await db.storage.from(bucket).list(uid, { limit: 1000 });
  const paths = (data ?? []).map((f) => `${uid}/${f.name}`);
  if (paths.length) await db.storage.from(bucket).remove(paths);
}

/** Permanently deletes the account and everything that belongs to it (database rows cascade from the profile). */
export async function deleteAccount(input: { confirm: string }): Promise<Result> {
  if (input.confirm !== "DELETE") return { fieldErrors: { confirm: "Type DELETE to confirm." } };
  const ctx = await current();
  if (!ctx) return LOGIN;
  if (!hasAdmin()) return { error: "We couldn't delete your account right now." };
  try {
    await Promise.all([removeFolder("cvs", ctx.user.id), removeFolder("company-logos", ctx.user.id)]);
    const { error } = await admin().auth.admin.deleteUser(ctx.user.id);
    if (error) return { error: "We couldn't delete your account. Please try again." };
  } catch {
    return { error: "We couldn't delete your account. Please try again." };
  }
  await ctx.supabase.auth.signOut();
  redirect("/");
}
