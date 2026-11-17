import { impliedSkills, sameSkill } from "./skill-graph";

// A few spellings the graph does not cover, kept from the first version of matching.
const handAliases: Record<string, string> = {
  reactjs: "react", "react.js": "react",
  nextjs: "next.js", next: "next.js",
  node: "node.js", nodejs: "node.js",
  js: "javascript", es6: "javascript",
  ts: "typescript",
  postgres: "postgresql", psql: "postgresql",
  tailwind: "tailwind css", tailwindcss: "tailwind css",
  "ms excel": "excel", "microsoft excel": "excel",
  "rest": "rest apis", "rest api": "rest apis", "restful apis": "rest apis",
  "ui": "ui design", "ux": "ux design",
  k8s: "kubernetes",
  "power-bi": "power bi", powerbi: "power bi",
  ml: "machine learning",
  "c sharp": "c#", csharp: "c#",
  golang: "go",
  vuejs: "vue", "vue.js": "vue",
  "adobe xd": "xd",
};

const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// name -> canonical name, from the AI-built groups of names that mean the same skill
const canonOf = new Map<string, string>();
for (const group of sameSkill) for (const k of group) canonOf.set(k, group[0]);

/** The single canonical key for a skill name: "Postgres", "psql" and "PostgreSQL" all map to the same key. */
export function normSkill(s: string) {
  const k = clean(s);
  const h = handAliases[k] ?? k;
  return canonOf.get(h) ?? h;
}

const implies = new Map<string, string[]>();
for (const [k, list] of Object.entries(impliedSkills)) implies.set(normSkill(k), list.map(normSkill));

/**
 * Everything a person can be assumed to have: the skills they list plus what those imply (Next.js -> React -> JavaScript).
 * Value = the listed skill the key came from, so the UI can say "React (from Next.js)".
 */
export function expandSkills(listed: string[]): Map<string, { from: string | null }> {
  const have = new Map<string, { from: string | null }>();
  for (const s of listed) {
    const k = normSkill(s);
    if (!have.has(k)) have.set(k, { from: null });
  }
  for (const s of listed) {
    const root = normSkill(s);
    const stack = [...(implies.get(root) ?? [])];
    const seen = new Set<string>([root]);
    while (stack.length) {
      const k = stack.pop()!;
      if (seen.has(k)) continue;
      seen.add(k);
      if (!have.has(k)) have.set(k, { from: s.trim() });
      stack.push(...(implies.get(k) ?? []));
    }
  }
  return have;
}
