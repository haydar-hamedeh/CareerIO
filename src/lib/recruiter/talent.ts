import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { computeFit } from "@/lib/jobs/match";
import type { TalentDto } from "./talent-types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Row = {
  user_id: string;
  full_name: string | null;
  headline: string | null;
  summary: string | null;
  seniority: string | null;
  years: number | string | null;
  location: string | null;
  country: string | null;
  skills: string[] | null;
  desired_roles: string[] | null;
  work_modes: string[] | null;
};

/** Searches people who allow it, ranked by fit to one of the employer's jobs when one is chosen. */
export async function runTalentSearch(supabase: Supabase, input: { q: string; jobId: string | null }): Promise<TalentDto[]> {
  const q = input.q.replace(/[%_\\]/g, " ").trim().slice(0, 100);
  const { data } = await supabase.rpc("search_candidates", { q: q || null, lim: 120 });
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  let job: { title: string; skills: string[] | null; work_mode: string; seniority: string } | null = null;
  const invited = new Set<string>();
  const applied = new Set<string>();
  if (input.jobId) {
    const [{ data: j }, { data: inv }, { data: apps }] = await Promise.all([
      supabase.from("jobs").select("title, skills, work_mode, seniority").eq("id", input.jobId).maybeSingle(),
      supabase.from("job_invites").select("candidate_id").eq("job_id", input.jobId),
      supabase.from("applications").select("candidate_id").eq("job_id", input.jobId),
    ]);
    job = j;
    for (const r of inv ?? []) invited.add(r.candidate_id);
    for (const r of apps ?? []) applied.add(r.candidate_id);
  }

  const list = rows.map((r): TalentDto => {
    const fit = job
      ? computeFit({
          jobTitle: job.title,
          jobSkills: job.skills ?? [],
          jobMode: job.work_mode,
          jobLevel: job.seniority,
          skills: r.skills ?? [],
          desiredRoles: r.desired_roles ?? [],
          headline: r.headline ?? "",
          workModes: r.work_modes ?? [],
          level: r.seniority,
        })
      : null;
    return {
      id: r.user_id,
      name: r.full_name?.trim() || "Candidate",
      headline: r.headline ?? "",
      summary: (r.summary ?? "").slice(0, 400),
      level: r.seniority,
      years: r.years === null ? null : Number(r.years),
      location: r.location ?? "",
      country: r.country,
      skills: r.skills ?? [],
      desiredRoles: r.desired_roles ?? [],
      score: fit ? fit.score : null,
      matched: fit?.matched ?? [],
      invited: invited.has(r.user_id),
      applied: applied.has(r.user_id),
    };
  });

  return job ? list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : list;
}
