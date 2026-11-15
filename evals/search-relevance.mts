// Semantic search relevance check (no DB writes). Embeds all open jobs in memory and runs sample queries.
// Run: npx tsx --env-file=.env.local evals/search-relevance.mts
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { jobText } from "../src/lib/ai/texts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const model = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-2";
const norm = (v: number[]) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function embedRetry(params: Parameters<typeof ai.models.embedContent>[0]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai.models.embedContent(params);
    } catch (e) {
      if ((e as { status?: number })?.status !== 429 || attempt >= 5) throw e;
      await sleep(20_000);
    }
  }
}

const { data: jobs, error } = await db.from("jobs").select("id, title, field, seniority, skills, requirements, description").eq("status", "open");
if (error) throw error;
const vecs: number[][] = [];
// Free tier: 100 embed requests/minute, and every text in a batch counts as one request.
for (let i = 0; i < jobs.length; i += 20) {
  if (i > 0) await sleep(20_000);
  const chunk = jobs.slice(i, i + 20);
  const r = await embedRetry({ model, contents: chunk.map((j) => ({ role: "user", parts: [{ text: jobText(j) }] })), config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768 } });
  vecs.push(...(r.embeddings ?? []).map((e) => norm(e.values ?? [])));
}
console.log(`embedded ${vecs.length} jobs`);

const queries = ["food kitchen", "cooking", "numbers and money", "working with kids", "doctor", "build websites", "law", "help people heal", "drive trucks"];
for (const q of queries) {
  const r = await embedRetry({ model, contents: [{ role: "user", parts: [{ text: `Job search: ${q}` }] }], config: { taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 } });
  const qv = norm(r.embeddings![0].values!);
  const ranked = jobs.map((j, i) => ({ t: j.title, f: j.field, s: dot(qv, vecs[i]) })).sort((a, b) => b.s - a.s);
  console.log(`\n"${q}"  (>=0.50: ${ranked.filter((x) => x.s >= 0.5).length}, >=0.55: ${ranked.filter((x) => x.s >= 0.55).length})`);
  for (const x of ranked.slice(0, 6)) console.log(`  ${x.s.toFixed(3)}  ${x.t} [${x.f}]`);
}
