// Backfill job embeddings. Run: node --env-file=.env.local scripts/embed-jobs.mts [--all]
// Uses the service role key (server-side only) because job rows are not writable by users.
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { jobText } from "../src/lib/ai/texts.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-2";
if (!url || !key || !apiKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or GEMINI_API_KEY in .env.local");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const ai = new GoogleGenAI({ apiKey });
const all = process.argv.includes("--all");

let query = db.from("jobs").select("id, title, field, seniority, skills, requirements, description").eq("status", "open");
if (!all) query = query.is("embedding", null);
const { data: jobs, error } = await query;
if (error) throw error;
console.log(`${jobs.length} jobs to embed with ${model}`);

const normalize = (v: number[]) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

// Free tier allows 100 embed requests/minute and each text in a batch counts as one.
const BATCH = 25;
const PAUSE_MS = 18_000;
let done = 0;
for (let i = 0; i < jobs.length; i += BATCH) {
  if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
  const chunk = jobs.slice(i, i + BATCH);
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await ai.models.embedContent({
        model,
        contents: chunk.map((j) => ({ role: "user", parts: [{ text: jobText(j) }] })),
        config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768 },
      });
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      const wait = 20_000 * (attempt + 1);
      console.log(`retrying in ${wait}ms (${e instanceof Error ? e.message.slice(0, 80) : "error"})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  const vectors = (res.embeddings ?? []).map((e) => normalize(e.values ?? []));
  if (vectors.length !== chunk.length) throw new Error("embedding count mismatch");
  for (let k = 0; k < chunk.length; k++) {
    const { error: upErr } = await db
      .from("jobs")
      .update({ embedding: `[${vectors[k].map((x) => x.toFixed(6)).join(",")}]` })
      .eq("id", chunk[k].id);
    if (upErr) throw upErr;
  }
  done += chunk.length;
  console.log(`embedded ${done}/${jobs.length}`);
}
console.log("done");
