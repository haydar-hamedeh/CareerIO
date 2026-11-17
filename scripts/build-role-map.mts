// Builds role suggestions from ESCO occupations (data/esco/, not committed):
//  - src/lib/onboarding/roles-by-field.ts   ~30 common job titles per field (chips)
//  - public/data/occupations.json           every ESCO occupation title, for typing/autocomplete (lazy-loaded in the browser)
// Run: node --env-file=.env.local --conditions react-server --import tsx scripts/build-role-map.mts [fieldId ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { generateJson } from "../src/lib/ai/gemini";
import { fence, UNTRUSTED_RULES } from "../src/lib/ai/safety";
import { roleCatalog } from "../src/lib/onboarding/skills-catalog";
import { readCsv } from "./esco-csv.mts";
import { FIELDS, type Field } from "./fields-config.mts";

const dir = "data/esco";
const cacheDir = `${dir}/.cache`;
mkdirSync(cacheDir, { recursive: true });
mkdirSync("public/data", { recursive: true });

const SMALL = new Set(["of", "and", "the", "for", "in", "to", "a", "an", "on", "at", "by", "or", "with"]);
/** ESCO titles are lowercase ("clinical psychologist"); keep words that already contain capitals (acronyms, names). */
function titleCase(s: string) {
  return s
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (/[A-Z]/.test(w)) return w;
      if (i > 0 && SMALL.has(w)) return w;
      return w.replace(/(^|[-/(])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
    })
    .join(" ");
}

console.log("Reading ESCO…");
const occ = readCsv(`${dir}/occupations_en.csv`);
const rel = readCsv(`${dir}/occupationSkillRelations_en.csv`);
const richness = new Map<string, number>();
for (const r of rel) richness.set(r.occupationUri, (richness.get(r.occupationUri) ?? 0) + 1);

// 1) every occupation title, for autocomplete
const all = new Map<string, string>();
for (const o of occ) {
  const t = titleCase(o.preferredLabel);
  if (t.length >= 3 && t.length <= 60 && !all.has(t.toLowerCase())) all.set(t.toLowerCase(), t);
}
const titles = [...all.values()].sort((a, b) => a.localeCompare(b));
writeFileSync("public/data/occupations.json", JSON.stringify(titles));
console.log(`occupations.json: ${titles.length} titles`);

// 2) curated titles per field
const schema = z.object({ roles: z.array(z.string().max(60)).min(8).max(60) });
const SYSTEM = `You curate the job-title suggestions shown to job seekers while they say which roles they want.
For ONE field, return the 30 most common, recognisable job titles a person in that field would search for.

Rules:
- Use the title as employers write it in job ads, in Title Case (e.g. "Clinical Psychologist", "Financial Analyst", "Frontend Developer"). No levels like "Junior" or "Senior".
- Prefer exact names from the EXISTING TITLES list when one fits. Add new ones only when that list has no equivalent.
- Cover the whole field: core professions first, then neighbouring and specialised roles. No duplicates or near-duplicates.
- Output only the JSON.

${UNTRUSTED_RULES}`;

async function build(f: Field) {
  const cache = `${cacheDir}/roles-${f.id}.json`;
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8")) as string[];
  const cands = occ
    .filter((o) => f.isco.some((p) => o.iscoGroup.startsWith(p)))
    .sort((a, b) => (richness.get(b.conceptUri) ?? 0) - (richness.get(a.conceptUri) ?? 0))
    .slice(0, 140)
    .map((o) => titleCase(o.preferredLabel));
  const prompt = `Field: ${f.label}\n\n${fence("esco_occupations", cands.join("\n"), 8000)}\n\n${fence("existing_titles", roleCatalog.join(", "), 8000)}`;
  const { data } = await generateJson({ feature: "role_map", schema, system: SYSTEM, parts: [{ text: prompt }], thinkingBudget: 0, timeoutMs: 90_000 });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of data.roles) {
    const s = raw.replace(/\s+/g, " ").trim();
    if (s.length < 3 || s.length > 50 || /[<>{}]/.test(s) || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  const final = out.slice(0, 36);
  writeFileSync(cache, JSON.stringify(final));
  return final;
}

const only = process.argv.slice(2);
const todo = FIELDS.filter((f) => !only.length || only.includes(f.id));
let next = 0;
async function worker() {
  while (next < todo.length) {
    const f = todo[next++];
    const t = Date.now();
    try {
      const r = await build(f);
      console.log(`ok   ${f.id.padEnd(12)} ${r.length} roles  ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (e) {
      console.log(`FAIL ${f.id.padEnd(12)} ${e instanceof Error ? e.name : e}`);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);

const byField: Record<string, string[]> = {};
for (const f of FIELDS) {
  const cache = `${cacheDir}/roles-${f.id}.json`;
  if (!existsSync(cache)) {
    console.log("Missing field (rerun):", f.id);
    process.exit(1);
  }
  byField[f.id] = JSON.parse(readFileSync(cache, "utf8")) as string[];
}
const body = Object.entries(byField)
  .map(([id, roles]) => `  ${JSON.stringify(id)}: [${roles.map((r) => JSON.stringify(r)).join(", ")}],`)
  .join("\n");
writeFileSync(
  "src/lib/onboarding/roles-by-field.ts",
  `// Generated by scripts/build-role-map.mts from the ESCO classification (v1.2.1) and curated with AI. Do not edit by hand.\n// This service uses the ESCO classification of the European Commission.\n\nexport const rolesByField: Record<string, string[]> = {\n${body}\n};\n`,
);
console.log("Wrote src/lib/onboarding/roles-by-field.ts");
