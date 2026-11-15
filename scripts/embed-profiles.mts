// Backfill candidate profile embeddings (new saves refresh automatically).
// Run: npx tsx --env-file=.env.local scripts/embed-profiles.mts [--all]
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { profileText } from "../src/lib/ai/texts.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.GEMINI_API_KEY;
if (!url || !key || !apiKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or GEMINI_API_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const ai = new GoogleGenAI({ apiKey });
const model = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-2";

let q = db.from("candidate_profiles").select("user_id, headline, desired_roles, skills, seniority, years_experience, experience, education");
if (!process.argv.includes("--all")) q = q.is("embedding", null);
const { data: rows, error } = await q;
if (error) throw error;
const ready = rows.filter((r) => (r.skills ?? []).length > 0 || r.headline);
console.log(`${ready.length} profiles to embed`);

for (const r of ready) {
  const res = await ai.models.embedContent({
    model,
    contents: [{ role: "user", parts: [{ text: profileText(r) }] }],
    config: { taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 },
  });
  const v = res.embeddings?.[0]?.values ?? [];
  const n = Math.hypot(...v) || 1;
  const { error: upErr } = await db
    .from("candidate_profiles")
    .update({ embedding: `[${v.map((x) => (x / n).toFixed(6)).join(",")}]` })
    .eq("user_id", r.user_id);
  if (upErr) throw upErr;
}
console.log("done");
