// Builds src/lib/onboarding/skills-by-field.ts from the ESCO dataset (data/esco/, not committed).
// 1) rank skills per field by how many ESCO occupations in that field need them,
// 2) have Gemini turn the top candidates into concise résumé-style skill names, anchored to our catalog.
// Run: node --env-file=.env.local --conditions react-server --import tsx scripts/build-skill-map.mts [fieldId ...]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { z } from "zod";
import { generateJson } from "../src/lib/ai/gemini";
import { fence, UNTRUSTED_RULES } from "../src/lib/ai/safety";
import { skillCatalog } from "../src/lib/onboarding/skills-catalog";
import { readCsv } from "./esco-csv.mts";

import { FIELDS, type Field } from "./fields-config.mts";

const dir = "data/esco";
const cacheDir = "data/esco/.cache";
mkdirSync(cacheDir, { recursive: true });

console.log("Reading ESCO…");
const occ = readCsv(`${dir}/occupations_en.csv`);
const rel = readCsv(`${dir}/occupationSkillRelations_en.csv`);
const skills = readCsv(`${dir}/skills_en.csv`);
const transversal = new Set(readCsv(`${dir}/transversalSkillsCollection_en.csv`).map((r) => r.conceptUri));
const label = new Map(skills.map((s) => [s.conceptUri, s.preferredLabel]));
const occIsco = new Map(occ.map((o) => [o.conceptUri, o.iscoGroup]));

function candidates(f: Field, n = 120) {
  const w = new Map<string, number>();
  for (const r of rel) {
    const isco = occIsco.get(r.occupationUri) ?? "";
    if (!f.isco.some((p) => isco.startsWith(p)) || transversal.has(r.skillUri)) continue;
    w.set(r.skillUri, (w.get(r.skillUri) ?? 0) + (r.relationType === "essential" ? 1 : 0.4));
  }
  return [...w.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([u]) => label.get(u) ?? "")
    .filter(Boolean);
}

const schema = z.object({ skills: z.array(z.string().max(60)).min(10).max(80) });

const SYSTEM = `You curate the skill suggestions shown to job seekers while they fill in their profile on a job platform.
For ONE field, return the 40 most valuable skills a hiring manager in that field expects to see on a CV.

Rules:
- Use short, standard, résumé-style names (1 to 4 words), e.g. "Financial Modeling", "Patient Assessment", "Python", "IFRS", "AutoCAD". Title Case, except well-known tools (SQL, dbt, iOS).
- Prefer exact names from the EXISTING CATALOG when one fits, so names stay consistent. Add new names only when the catalog has no equivalent.
- Mix: about 28 hard skills, tools, standards and methods, and about 12 core professional skills for the field. No personality traits ("hardworking", "team player").
- Turn ESCO verb phrases into noun skills ("manage budgets" becomes "Budget Management"). Merge duplicates and near-duplicates. Drop obscure, obsolete or irrelevant items.
- Order from most to least important for getting hired in this field.
- Output only the JSON.

${UNTRUSTED_RULES}`;

async function build(f: Field) {
  const cache = `${cacheDir}/${f.id}.json`;
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8")) as string[];
  const cands = candidates(f);
  const prompt = `Field: ${f.label}\n\n${fence("esco_candidates", cands.join("\n"), 8000)}\n\n${fence("existing_catalog", skillCatalog.join(", "), 8000)}`;
  const { data } = await generateJson({ feature: "skill_map", schema, system: SYSTEM, parts: [{ text: prompt }], thinkingBudget: 0, timeoutMs: 90_000 });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of data.skills) {
    const s = raw.replace(/\s+/g, " ").trim();
    if (s.length < 2 || s.length > 40 || /[<>{}]/.test(s) || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  const final = out.slice(0, 45);
  writeFileSync(cache, JSON.stringify(final));
  return final;
}

const only = process.argv.slice(2);
const todo = FIELDS.filter((f) => !only.length || only.includes(f.id));
const results = new Map<string, string[]>();
let next = 0;
async function worker() {
  while (next < todo.length) {
    const f = todo[next++];
    const t = Date.now();
    try {
      results.set(f.id, await build(f));
      console.log(`ok   ${f.id.padEnd(12)} ${results.get(f.id)!.length} skills  ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (e) {
      console.log(`FAIL ${f.id.padEnd(12)} ${e instanceof Error ? e.name : e}`);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);

// Fields that were not (re)built this run come from the cache, so partial runs still produce a complete file.
const all = FIELDS.map((f) => ({ ...f, skills: results.get(f.id) ?? (existsSync(`${cacheDir}/${f.id}.json`) ? (JSON.parse(readFileSync(`${cacheDir}/${f.id}.json`, "utf8")) as string[]) : []) }));
const missing = all.filter((f) => f.skills.length === 0).map((f) => f.id);
if (missing.length) {
  console.log("Missing fields (rerun the script):", missing.join(", "));
  process.exit(1);
}

const q = (s: string) => JSON.stringify(s);
const body = all
  .map((f) => `  { id: ${q(f.id)}, label: ${q(f.label)}, match: [${f.match.map(q).join(", ")}], skills: [${f.skills.map(q).join(", ")}] },`)
  .join("\n");
writeFileSync(
  "src/lib/onboarding/skills-by-field.ts",
  `// Generated by scripts/build-skill-map.mts from the ESCO classification (v1.2.1) and curated with AI. Do not edit by hand.\n// This service uses the ESCO classification of the European Commission.\n\nexport type SkillField = { id: string; label: string; match: string[]; skills: string[] };\n\nexport const skillFields: SkillField[] = [\n${body}\n];\n`,
);
console.log(`Wrote src/lib/onboarding/skills-by-field.ts (${all.length} fields)`);
