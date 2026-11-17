import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { admin, hasAdmin } from "@/lib/supabase/admin";
import { AiBusyError, AiUnavailableError } from "@/lib/ai/gemini";
import { limits, rateLimit } from "@/lib/ai/rate-limit";
import { PARSE_VERSION, parsedCvSchema, type ParsedCv } from "@/lib/ai/cv";
import { chanceHash, estimateChance, type ChanceResult } from "@/lib/ai/chance";
import { capScore, computeFit } from "@/lib/jobs/match";
import { mergeSkills } from "@/lib/jobs/cv-skills";
import { matchProfileHash } from "@/lib/ai/match-score";

const LEVELS = ["intern", "junior", "mid", "senior", "lead"];
const jobLevelHigher = (job: string, person: string | null) => LEVELS.indexOf(job) > LEVELS.indexOf(person ?? "");

export const maxDuration = 60;

const input = z.object({ jobId: z.uuid() });

export async function POST(request: NextRequest) {
  const parsedInput = input.safeParse(await request.json().catch(() => null));
  if (!parsedInput.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { jobId } = parsedInput.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const userId = auth.user.id;

  const { data: me } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (me?.role !== "candidate") return NextResponse.json({ error: "Only job seekers can check their chances." }, { status: 403 });

  const [{ data: job }, { data: profile }, { data: cvRow }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, field, seniority, skills, requirements, description, work_mode, status, companies(name)")
      .eq("id", jobId)
      .eq("status", "open")
      .maybeSingle(),
    supabase
      .from("candidate_profiles")
      .select("headline, desired_roles, skills, seniority, years_experience, experience, education, work_modes, embedding")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("cvs").select("parsed").eq("user_id", userId).eq("is_primary", true).maybeSingle(),
  ]);
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (!profile) return NextResponse.json({ error: "Finish your profile first." }, { status: 400 });

  const stored = cvRow?.parsed as { v?: string; data?: unknown } | null;
  const cv: ParsedCv | null = stored?.v === PARSE_VERSION ? (parsedCvSchema.safeParse(stored.data).data ?? null) : null;
  const company = (Array.isArray(job.companies) ? job.companies[0] : job.companies) as { name: string } | null;

  // Same inputs as the feed and the job page, so all three numbers agree: skills from profile + CV, semantic similarity,
  // and the AI match score when the feed has already computed one for this job.
  const cvSkills = cv?.skills ?? [];
  const skills = mergeSkills(profile.skills ?? [], cvSkills);
  let semantic: number | null = null;
  if (profile.embedding) {
    const { data: sims } = await supabase.rpc("match_jobs", { query_embedding: profile.embedding, match_count: 200 });
    semantic = ((sims ?? []) as { job_id: string; similarity: number }[]).find((r) => r.job_id === jobId)?.similarity ?? null;
  }
  const quick = computeFit({
    jobTitle: job.title,
    jobSkills: job.skills ?? [],
    jobMode: job.work_mode,
    jobLevel: job.seniority,
    skills,
    desiredRoles: profile.desired_roles ?? [],
    headline: profile.headline ?? "",
    workModes: profile.work_modes ?? [],
    level: profile.seniority ?? null,
    semantic,
  });
  const { data: aiRow } = await supabase
    .from("ai_match_scores")
    .select("score")
    .eq("job_id", jobId)
    .eq("profile_hash", await matchProfileHash(profile, cvSkills))
    .maybeSingle();
  const fit = aiRow ? capScore(aiRow.score, quick) : quick.score;

  // Whether the job's level and the person's level are far apart: the main reason a strong skills match can still be a long shot.
  const levelNote = quick.levelGap >= 2 ? (jobLevelHigher(job.seniority, profile.seniority) ? "above" : "below") : null;

  const chanceInput = {
    job: { ...job, company: company?.name ?? "Company" },
    profile,
    cv,
    fit,
    cvSkills,
    skillCheck: { has: quick.matched, via: quick.via, missing: quick.missing },
  };
  const hash = await chanceHash(chanceInput);

  const { data: cached } = await supabase.from("job_chances").select("input_hash, result, created_at").eq("job_id", jobId).maybeSingle();
  if (cached && cached.input_hash === hash) {
    return NextResponse.json({ ...(cached.result as ChanceResult), cached: true, createdAt: cached.created_at, usedCv: Boolean(cv), match: fit, level: levelNote });
  }

  const rl = rateLimit(`chance:${userId}`, limits.chance.limit, limits.chance.windowMs);
  if (!rl.ok) {
    return NextResponse.json({ error: `You've checked a lot recently. Try again in ${Math.ceil(rl.retryAfter / 60)} min.` }, { status: 429 });
  }

  try {
    const { result, model } = await estimateChance(chanceInput);
    const createdAt = new Date().toISOString();
    if (hasAdmin()) {
      await admin().from("job_chances").upsert({ user_id: userId, job_id: jobId, input_hash: hash, score: result.score, result, model, created_at: createdAt });
    }
    return NextResponse.json({ ...result, cached: false, createdAt, usedCv: Boolean(cv), match: fit, level: levelNote });
  } catch (e) {
    if (e instanceof AiBusyError) return NextResponse.json({ error: e.message }, { status: 503 });
    if (e instanceof AiUnavailableError) return NextResponse.json({ error: "AI is not configured yet." }, { status: 503 });
    return NextResponse.json({ error: "We couldn't estimate that right now. Please try again in a minute." }, { status: 500 });
  }
}
