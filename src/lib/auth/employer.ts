import "server-only";
import { redirect } from "next/navigation";
import { requireSession } from "./session";

/** Session for a company account that finished setup, with its company. Everyone else is sent where they belong. */
export async function requireEmployer(next: string) {
  const session = await requireSession(next);
  if (session.role !== "employer") redirect("/feed");
  if (!session.onboarded) redirect("/onboarding");
  const { data: company } = await session.supabase.from("companies").select("id, name, location").eq("owner_id", session.user.id).maybeSingle();
  if (!company) redirect("/onboarding");
  return { ...session, company: company as { id: string; name: string; location: string | null } };
}
