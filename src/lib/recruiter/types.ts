export type AppStatus = "applied" | "in_review" | "interview" | "rejected" | "hired";

export type ApplicantDto = {
  id: string;
  name: string;
  headline: string;
  level: string | null;
  years: number | null;
  location: string;
  skills: string[];
  status: AppStatus;
  score: number | null;
  summary: string | null;
  strengths: string[];
  gaps: string[];
  questions: string[];
  skillCheck: { has: string[]; via: { skill: string; from: string }[]; missing: string[]; total: number } | null;
  flagged: boolean;
  usedCv: boolean;
  phone: string | null;
  country: string | null;
  note: string | null;
  answers: { q: string; a: string }[];
  hasCv: boolean;
  interviewAt: string | null;
  interviewNote: string | null;
  createdAt: string;
};

export const statusLabel: Record<AppStatus, string> = {
  applied: "New",
  in_review: "In review",
  interview: "Interview",
  rejected: "Rejected",
  hired: "Hired",
};

export const statusTone: Record<AppStatus, string> = {
  applied: "bg-coral/15 text-[#b4391f]",
  in_review: "bg-sun/35 text-[#6b4700]",
  interview: "bg-forest text-white",
  rejected: "bg-ink/[0.07] text-muted",
  hired: "bg-mint text-forest-deep",
};
