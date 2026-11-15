const aliases: Record<string, string> = {
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

export const normSkill = (s: string) => {
  const k = s.trim().toLowerCase().replace(/\s+/g, " ");
  return aliases[k] ?? k;
};

const STOP = new Set([
  "junior", "senior", "mid", "lead", "head", "of", "and", "the", "a", "an", "intern", "internship", "&", "-", "(", ")",
  "level", "i", "ii", "iii", "trainee", "assistant",
]);
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[()/,.]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w && !STOP.has(w));

function roleSimilarity(title: string, targets: string[]) {
  const t = new Set(words(title));
  if (!t.size) return 0;
  let best = 0;
  for (const target of targets) {
    const w = words(target);
    if (!w.length) continue;
    const hit = w.filter((x) => t.has(x)).length;
    best = Math.max(best, hit / Math.max(w.length, Math.min(t.size, 3)));
  }
  return Math.min(1, best);
}

const LEVELS = ["intern", "junior", "mid", "senior", "lead"];

export type FitInput = {
  jobTitle: string;
  jobSkills: string[];
  jobMode: string;
  jobLevel: string;
  skills: string[];
  desiredRoles: string[];
  headline: string;
  workModes: string[];
  level: string | null;
  /** Cosine similarity between profile and job embeddings, when both exist. */
  semantic?: number | null;
};

export type Fit = {
  score: number;
  matched: string[];
  missing: string[];
  skill: number;
  role: number;
  modeOk: boolean;
  levelGap: number;
  semantic: number | null;
};

export function computeFit(i: FitInput): Fit {
  const mine = new Set(i.skills.map(normSkill));
  const matched = i.jobSkills.filter((s) => mine.has(normSkill(s)));
  const missing = i.jobSkills.filter((s) => !mine.has(normSkill(s)));
  const skill = i.jobSkills.length ? matched.length / i.jobSkills.length : 0;
  const role = roleSimilarity(i.jobTitle, [...i.desiredRoles, i.headline].filter(Boolean));
  const modeOk = i.workModes.length === 0 || i.workModes.includes(i.jobMode);
  const a = LEVELS.indexOf(i.jobLevel);
  const b = i.level ? LEVELS.indexOf(i.level) : -1;
  const levelGap = a < 0 || b < 0 ? 1 : Math.abs(a - b);
  const levelScore = Math.max(0, 1 - levelGap / 3);
  const mode = modeOk ? 1 : 0;
  // gemini-embedding-2 (768d) profile-to-job cosine measured on our 152 jobs: ~0.60 (unrelated) to ~0.78 (same role).
  // Rescale that band to 0–1. Recalibrate if the embedding model changes.
  const semantic = typeof i.semantic === "number" ? Math.min(1, Math.max(0, (i.semantic - 0.6) / 0.18)) : null;
  const raw =
    semantic === null
      ? 0.55 * skill + 0.25 * role + 0.12 * mode + 0.08 * levelScore
      : 0.4 * skill + 0.3 * semantic + 0.15 * role + 0.1 * mode + 0.05 * levelScore;
  const score = Math.round(100 * raw);
  return { score, matched, missing, skill, role, modeOk, levelGap, semantic };
}

export function fitReason(f: Fit, total: number) {
  const parts: string[] = [];
  if (total) {
    if (f.missing.length === 0) parts.push(`Has all ${total} skills`);
    else {
      const miss = f.missing.slice(0, 2).join(", ") + (f.missing.length > 2 ? ` +${f.missing.length - 2}` : "");
      parts.push(`${f.matched.length} of ${total} skills · Missing: ${miss}`);
    }
  }
  if (f.role >= 0.5) parts.push("Fits a role you want");
  if (!f.modeOk) parts.push("Work mode differs from your preference");
  return parts.join(" · ");
}

export function timeAgo(iso: string | null, now: number) {
  if (!iso) return "";
  const mins = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}

export function formatSalary(min: number | null, max: number | null, currency: string | null) {
  if (!min && !max) return null;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const c = currency === "USD" || !currency ? "$" : `${currency} `;
  if (min && max) return `${c}${fmt(min)}–${c}${fmt(max)} / mo`;
  return `${c}${fmt((min ?? max) as number)} / mo`;
}

export const currentTime = () => Date.now();
