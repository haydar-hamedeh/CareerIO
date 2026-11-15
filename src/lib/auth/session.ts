import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, onboarded_at")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    supabase,
    user: data.user,
    role: (profile?.role ?? "candidate") as "candidate" | "employer",
    fullName: (profile?.full_name as string | null) ?? "",
    onboarded: Boolean(profile?.onboarded_at),
  };
});

export async function requireSession(next: string) {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}
