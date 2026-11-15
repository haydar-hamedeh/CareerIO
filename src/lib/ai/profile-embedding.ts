import "server-only";
import { admin, hasAdmin } from "../supabase/admin";
import { embed, toPgVector } from "./gemini";
import { profileText } from "./texts";

/** Recompute and store the candidate's profile embedding. Never throws: matching falls back to skills. */
export async function refreshProfileEmbedding(userId: string) {
  if (!hasAdmin() || !process.env.GEMINI_API_KEY) return false;
  try {
    const db = admin();
    const { data: p } = await db
      .from("candidate_profiles")
      .select("headline, desired_roles, skills, seniority, years_experience, experience, education")
      .eq("user_id", userId)
      .maybeSingle();
    if (!p) return false;
    const [vector] = await embed([profileText(p)], "RETRIEVAL_QUERY", "profile_embedding");
    const { error } = await db.from("candidate_profiles").update({ embedding: toPgVector(vector) }).eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}
