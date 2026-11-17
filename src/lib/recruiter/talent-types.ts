export type TalentDto = {
  id: string;
  name: string;
  headline: string;
  summary: string;
  level: string | null;
  years: number | null;
  location: string;
  country: string | null;
  skills: string[];
  desiredRoles: string[];
  /** Fit to the chosen job, when one is chosen. */
  score: number | null;
  matched: string[];
  invited: boolean;
  applied: boolean;
};

export type TalentJob = { id: string; title: string };
