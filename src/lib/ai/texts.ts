// Text used for embeddings and AI prompts. Fairness rule: never include name, gender, age,
// photo, nationality, religion, phone, email, country or city. Location is handled by filters.

export type JobForText = {
  title: string;
  field: string;
  seniority: string;
  skills: string[] | null;
  requirements: string[] | null;
  description: string;
};

export function jobText(j: JobForText) {
  // Skip the first paragraph (company intro) so company wording does not dominate role meaning.
  const about = j.description.split("\n\n").slice(1, 4).join("\n").slice(0, 2500);
  return [
    `Job title: ${j.title}`,
    `Field: ${j.field}`,
    `Level: ${j.seniority}`,
    `Skills: ${(j.skills ?? []).join(", ")}`,
    `Requirements: ${(j.requirements ?? []).join("; ")}`,
    about,
  ].join("\n");
}

type Position = { title?: string; summary?: string };
type Edu = { degree?: string; field?: string };

export type ProfileForText = {
  headline: string | null;
  desired_roles: string[] | null;
  skills: string[] | null;
  seniority: string | null;
  years_experience: number | null;
  experience: unknown;
  education: unknown;
};

export function profileText(p: ProfileForText) {
  const positions = (Array.isArray(p.experience) ? (p.experience as Position[]) : [])
    .map((x) => [x.title, x.summary].filter(Boolean).join(": "))
    .slice(0, 8);
  const edu = (Array.isArray(p.education) ? (p.education as Edu[]) : []).map((e) => [e.degree, e.field].filter(Boolean).join(" in "));
  return [
    `Headline: ${p.headline ?? ""}`,
    `Wants roles: ${(p.desired_roles ?? []).join(", ")}`,
    `Level: ${p.seniority ?? "unknown"}, ${Math.round(Number(p.years_experience ?? 0))} years of experience`,
    `Skills: ${(p.skills ?? []).join(", ")}`,
    positions.length ? `Experience: ${positions.join("; ")}` : "",
    edu.length ? `Education: ${edu.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
