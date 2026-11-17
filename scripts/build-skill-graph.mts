// Builds src/lib/jobs/skill-graph.ts: which skill names mean the same thing, and which skills imply others.
//   same name:  "Postgres" = "PostgreSQL", "MS Excel" = "Excel", "Photoshop" = "Adobe Photoshop"
//   implies:    Next.js -> React -> JavaScript, NestJS -> Node.js, Django -> Python, PostgreSQL -> SQL
// Generated once with AI over our whole skill vocabulary, then used by plain code at match time (fast, no AI call per request).
// Run: node --env-file=.env.local --conditions react-server --import tsx scripts/build-skill-graph.mts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { generateJson } from "../src/lib/ai/gemini";
import { fence, UNTRUSTED_RULES } from "../src/lib/ai/safety";
import { allSkills } from "../src/lib/onboarding/skill-fields";

const cacheDir = "data/esco/.cache";
mkdirSync(cacheDir, { recursive: true });

const vocab = [...allSkills];
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const vocabKeys = new Map(vocab.map((s) => [key(s), s]));

const schema = z.object({
  items: z.array(
    z.object({
      skill: z.string(),
      aliases: z.array(z.string().max(60)).max(8).default([]),
      implies: z.array(z.string().max(60)).max(10).default([]),
    }),
  ),
});

const SYSTEM = `You build a skills knowledge graph for a job-matching product, so a candidate is not marked as "missing" a skill they clearly have under another name.

For EACH skill in <batch>, return:
- aliases: other names people write for the SAME skill: abbreviations, spellings, full names, "with/without brand" forms, common versions. Examples: "PostgreSQL" -> ["Postgres", "psql"]; "Microsoft Excel" -> ["MS Excel", "Excel"]; "Adobe Photoshop" -> ["Photoshop"]; "Node.js" -> ["Node", "NodeJS"]. Never include a broader or narrower skill as an alias.
- implies: other skills that anyone with solid working knowledge of this skill has for certain. Only include skills that appear in <vocabulary> (use their exact spelling). Examples: "Next.js" -> ["React", "JavaScript"]; "NestJS" -> ["Node.js", "TypeScript"]; "Django" -> ["Python"]; "Spring Boot" -> ["Java"]; "PostgreSQL" -> ["SQL"]; "React Native" -> ["React", "JavaScript"]; "Financial Modeling" -> ["Excel"]. Be conservative: if it is only likely and not certain, leave it out. Soft skills usually imply nothing.
- Use [] when there are none. Return every skill from <batch> exactly once, spelled as given.

${UNTRUSTED_RULES}`;

type Item = { skill: string; aliases: string[]; implies: string[] };

async function runBatch(index: number, batch: string[]): Promise<Item[]> {
  const cache = `${cacheDir}/graph-${index}.json`;
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8")) as Item[];
  const prompt = `${fence("vocabulary", vocab.join(", "), 30000)}\n\n${fence("batch", batch.join("\n"), 6000)}`;
  const { data } = await generateJson({ feature: "skill_graph", schema, system: SYSTEM, parts: [{ text: prompt }], thinkingBudget: 0, timeoutMs: 120_000 });
  writeFileSync(cache, JSON.stringify(data.items));
  return data.items;
}

const SIZE = 50;
const batches: string[][] = [];
for (let i = 0; i < vocab.length; i += SIZE) batches.push(vocab.slice(i, i + SIZE));
console.log(`${vocab.length} skills in ${batches.length} batches`);

const results: Item[][] = new Array(batches.length);
let next = 0;
async function worker() {
  while (next < batches.length) {
    const i = next++;
    const t = Date.now();
    try {
      results[i] = await runBatch(i, batches[i]);
      console.log(`ok   batch ${String(i + 1).padStart(2)}/${batches.length}  ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (e) {
      console.log(`FAIL batch ${i + 1}: ${e instanceof Error ? e.name : e}`);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);
const failed = results.map((r, i) => (r ? -1 : i + 1)).filter((i) => i > 0);
if (failed.length) {
  console.log("Rerun to retry batches:", failed.join(", "));
  process.exit(1);
}

// Equivalence classes via union-find. A class is capped so one bad suggestion can't merge unrelated skills.
const parent = new Map<string, string>();
const size = new Map<string, number>();
const find = (k: string): string => {
  if (!parent.has(k)) {
    parent.set(k, k);
    size.set(k, 1);
  }
  let r = k;
  while (parent.get(r) !== r) r = parent.get(r)!;
  parent.set(k, r);
  return r;
};
const union = (a: string, b: string) => {
  const ra = find(a);
  const rb = find(b);
  if (ra === rb) return;
  const total = (size.get(ra) ?? 1) + (size.get(rb) ?? 1);
  if (total > 6) return;
  parent.set(rb, ra);
  size.set(ra, total);
};

const impliesRaw = new Map<string, Set<string>>();
const aliasOf = new Map<string, Set<string>>();
for (const item of results.flat()) {
  const k = vocabKeys.has(key(item.skill)) ? key(item.skill) : null;
  if (!k) continue;
  find(k);
  aliasOf.set(k, new Set(item.aliases.map(key).filter((a) => a.length >= 2 && a !== k)));
  const imp = item.implies.map(key).filter((x) => vocabKeys.has(x) && x !== k);
  if (imp.length) impliesRaw.set(k, new Set([...(impliesRaw.get(k) ?? []), ...imp]));
}
// Two skills that are both real entries in our vocabulary only merge when each names the other
// ("Photoshop" = "Adobe Photoshop"). One-sided claims ("Problem Solving" = "Debugging") are dropped.
// Names that are not vocabulary entries are plain spelling variants ("Postgres") and always merge.
// Names that look like synonyms but are different skills, checked by hand.
const NEVER_MERGE = new Set(["5g", "unix", "cad", "management", "asp.net", "training", "valuation", "word"]);
for (const [k, set] of aliasOf) {
  for (const a of set) {
    if (NEVER_MERGE.has(a) || NEVER_MERGE.has(k)) continue;
    if (!vocabKeys.has(a) || aliasOf.get(a)?.has(k)) union(k, a);
  }
}

const groups = new Map<string, string[]>();
for (const k of parent.keys()) {
  const r = find(k);
  groups.set(r, [...(groups.get(r) ?? []), k]);
}
const equivalent = [...groups.values()].filter((g) => g.length >= 2).map((g) => g.sort());
const canonOf = new Map<string, string>();
for (const g of equivalent) for (const k of g) canonOf.set(k, g[0]);
const c = (k: string) => canonOf.get(k) ?? k;

// Implications between canonical names; drop self-links created by merging.
const implies: Record<string, string[]> = {};
for (const [k, set] of impliesRaw) {
  const from = c(k);
  const to = [...new Set([...set].map(c))].filter((x) => x !== from);
  if (to.length) implies[from] = [...new Set([...(implies[from] ?? []), ...to])].sort();
}

const q = (s: string) => JSON.stringify(s);
const sameBody = equivalent.map((g) => `  [${g.map(q).join(", ")}],`).join("\n");
const impBody = Object.keys(implies)
  .sort()
  .map((k) => `  ${q(k)}: [${implies[k].map(q).join(", ")}],`)
  .join("\n");
writeFileSync(
  "src/lib/jobs/skill-graph.ts",
  `// Generated by scripts/build-skill-graph.mts (AI over our skill vocabulary). Do not edit by hand.\n\n/** Groups of names that mean the same skill (lowercase). The first name is the canonical one. */\nexport const sameSkill: string[][] = [\n${sameBody}\n];\n\n/** canonical skill -> canonical skills someone with it certainly has. */\nexport const impliedSkills: Record<string, string[]> = {\n${impBody}\n};\n`,
);
console.log(`Wrote skill-graph.ts: ${equivalent.length} same-skill groups, ${Object.keys(implies).length} skills with implications`);
