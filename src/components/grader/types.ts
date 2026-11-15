export type Cv = { id: string; fileName: string; isPrimary: boolean };
export type GradePoint = { id: string; cvId: string; score: number; target: string; createdAt: string };
export type Job ={ id: string; title: string; company: string } | null;
export type Rubric = { key: string; label: string; weight: number; score: number; comment: string };
export type Issue = { section: string; quote: string; problem: string; rewrite: string };
export type Check = { id: string; label: string; passed: boolean; detail: string };
export type Result = {
  cached: boolean;
  score: number;
  rubric: Rubric[];
  issues: Issue[];
  checks: Check[];
  strengths: string[];
  roleFit: { summary: string; strengths: string[]; gaps: string[]; nextSteps: string[] };
  missingKeywords: string[];
  targetLabel: string;
  createdAt: string;
  quality?: number;
  fit?: number | null;
};

export type TargetKind = "role" | "job" | "general";

export const RUBRIC_AXES = [
  { key: "impact", label: "Impact & results", weight: 25, hint: "Quantified outcomes over passive duties" },
  { key: "skills", label: "Skills relevance", weight: 20, hint: "Alignment with your chosen target" },
  { key: "clarity", label: "Clarity", weight: 15, hint: "Scannable titles and concise bullets" },
  { key: "ats", label: "ATS readability", weight: 15, hint: "Clean headings, dates, selectable text" },
  { key: "structure", label: "Structure", weight: 15, hint: "Logical flow, length, bullet depth" },
  { key: "language", label: "Language & tone", weight: 10, hint: "Grammar, tense, active phrasing" },
] as const;

export const verdict = (s: number) =>
  s >= 80
    ? { label: "Strong CV", note: "Recruiters will have little to push back on." }
    : s >= 65
      ? { label: "Good, with clear fixes", note: "A few targeted edits will lift this noticeably." }
      : s >= 45
        ? { label: "Needs work", note: "Fix the flagged lines below to move the needle fast." }
        : { label: "Needs major work", note: "Start with the top issues below, then re-grade." };

export const scoreTone = (s: number) => (s >= 70 ? "forest" : s >= 50 ? "sun" : "coral");
