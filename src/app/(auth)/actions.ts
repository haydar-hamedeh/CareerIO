"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyAuthError } from "@/lib/auth/messages";
import {
  forgotSchema,
  parseRole,
  resetSchema,
  safeNext,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/schemas";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
  email?: string;
};

async function origin() {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function fields(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(fields(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const { fullName, email, password, role } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback?next=/onboarding`,
      data: { full_name: fullName, role },
    },
  });

  if (error) return { error: friendlyAuthError(error.message) };
  if (data.user && data.user.identities?.length === 0) {
    return { error: friendlyAuthError("already registered") };
  }
  if (data.session) redirect("/onboarding");
  return { success: true, email };
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(fields(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendlyAuthError(error.message) };

  redirect(safeNext(formData.get("next")));
}

export async function signInWithGoogle(formData: FormData) {
  const role = parseRole(formData.get("role"));
  const next = safeNext(formData.get("next"));
  const params = new URLSearchParams({ next });
  if (role) params.set("role", role);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?${params}` },
  });

  if (error || !data.url) {
    const back = formData.get("from") === "signup" ? "/signup" : "/login";
    redirect(`${back}?error=${encodeURIComponent(friendlyAuthError(error?.message))}`);
  }
  redirect(data.url);
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotSchema.safeParse(fields(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  if (error && /rate limit|too many/i.test(error.message)) return { error: friendlyAuthError(error.message) };

  return { success: true, email: parsed.data.email };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(fields(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: friendlyAuthError(error.message) };

  redirect("/feed");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
