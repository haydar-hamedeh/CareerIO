import { skillFields, type SkillField } from "./skills-by-field";
import { skillCatalog } from "./skills-catalog";
import { majorField } from "./education";

export { skillFields };
export type { SkillField };

/** Core professional skills useful in any field. Shown when no field can be inferred. */
export const commonSkills = [
  "Communication", "Teamwork", "Problem Solving", "Time Management", "Leadership", "Project Management",
  "Microsoft Office", "Customer Service", "Presentation", "Critical Thinking", "Excel", "Research",
] as const;

/** Autocomplete pool: the job catalog plus every field's suggestions, deduplicated case-insensitively. */
export const allSkills: readonly string[] = (() => {
  const seen = new Map<string, string>();
  for (const s of [...skillCatalog, ...skillFields.flatMap((f) => f.skills)]) if (!seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
})();

export type FieldSignals = {
  education: { degree: string; field: string }[];
  desiredRoles: string[];
  headline: string;
  positions: { title: string }[];
  /** Skills already chosen: a strong hint of the field once the person has picked some. */
  skills?: string[];
};

const fieldSkillSets = new Map(skillFields.map((f) => [f.id, new Set(f.skills.map((s) => s.toLowerCase()))]));

const hits = (text: string, keywords: string[]) => {
  const padded = ` ${text.toLowerCase()} `;
  return keywords.reduce((n, k) => n + (padded.includes(k) ? 1 : 0), 0);
};

/**
 * Rank fields by how well they match the person. Study counts most, then the roles they want,
 * then their headline, then past job titles. Returns ids with at least one hit, best first.
 */
export function inferFields(s: FieldSignals): string[] {
  const scored = skillFields.map((f) => {
    const score =
      12 * s.education.filter((e) => majorField.get(e.field.trim().toLowerCase()) === f.id).length +
      3 * s.education.reduce((n, e) => n + hits(`${e.field} ${e.degree}`, f.match), 0) +
      2 * s.desiredRoles.reduce((n, r) => n + hits(r, f.match), 0) +
      2 * hits(s.headline, f.match) +
      2 * (s.skills ?? []).filter((k) => fieldSkillSets.get(f.id)?.has(k.toLowerCase())).length +
      s.positions.reduce((n, p) => n + hits(p.title, f.match), 0);
    return { id: f.id, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);
}
