import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { PARSE_VERSION, parsedCvSchema } from "@/lib/ai/cv";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Skills listed on the person's main CV (once it has been read by the grader). Empty when there is none. */
export async function primaryCvSkills(supabase: Supabase, userId: string): Promise<string[]> {
  const { data } = await supabase.from("cvs").select("parsed").eq("user_id", userId).eq("is_primary", true).maybeSingle();
  const stored = data?.parsed as { v?: string; data?: unknown } | null;
  if (stored?.v !== PARSE_VERSION) return [];
  const parsed = parsedCvSchema.safeParse(stored.data);
  return parsed.success ? parsed.data.skills : [];
}

/** Profile skills plus CV skills, without duplicates (case-insensitive). */
export const mergeSkills = (...lists: string[][]) => [...new Map(lists.flat().map((s) => [s.trim().toLowerCase(), s.trim()])).values()].filter(Boolean);
