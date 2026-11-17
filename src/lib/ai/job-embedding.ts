import "server-only";
import { admin, hasAdmin } from "../supabase/admin";
import { embed, toPgVector } from "./gemini";
import { jobText } from "./texts";

/** Recompute and store a job's embedding so it shows up in semantic matching. Never throws: matching falls back to skills. */
export async function refreshJobEmbedding(jobId: string) {
  if (!hasAdmin() || !process.env.GEMINI_API_KEY) return false;
  try {
    const db = admin();
    const { data: j } = await db.from("jobs").select("title, field, seniority, skills, requirements, description").eq("id", jobId).maybeSingle();
    if (!j) return false;
    const [vector] = await embed([jobText(j)], "RETRIEVAL_DOCUMENT", "job_embedding");
    const { error } = await db.from("jobs").update({ embedding: toPgVector(vector) }).eq("id", jobId);
    return !error;
  } catch {
    return false;
  }
}
