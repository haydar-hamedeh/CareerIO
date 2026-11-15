import { NextResponse, type NextRequest } from "next/server";
import mammoth from "mammoth";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { admin, hasAdmin } from "@/lib/supabase/admin";
import { AiBusyError, AiUnavailableError } from "@/lib/ai/gemini";
import { limits, rateLimit } from "@/lib/ai/rate-limit";
import {
  GRADE_VERSION,
  PARSE_VERSION,
  extractCv,
  judgeCv,
  missingKeywords,
  parsedCvSchema,
  runChecks,
  InvalidTargetError,
  type Target,
} from "@/lib/ai/cv";

export const maxDuration = 120;

const input = z.object({
  cvId: z.uuid(),
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("general") }),
    z.object({ kind: z.literal("role"), role: z.string().trim().min(2).max(120) }),
    z.object({ kind: z.literal("job"), jobId: z.uuid() }),
  ]),
});

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(request: NextRequest) {
  const parsedInput = input.safeParse(await request.json().catch(() => null));
  if (!parsedInput.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { cvId, target: t } = parsedInput.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const userId = auth.user.id;

  const { data: cv } = await supabase
    .from("cvs")
    .select("id, storage_path, mime_type, content_hash, parsed")
    .eq("id", cvId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!cv) return NextResponse.json({ error: "CV not found." }, { status: 404 });

  let target: Target = { kind: "general" };
  let targetKey = "general";
  let targetLabel = "General review";
  let jobSkills: string[] = [];
  if (t.kind === "role") {
    target = { kind: "role", role: t.role };
    targetKey = `role:${t.role.toLowerCase()}`;
    targetLabel = t.role;
  } else if (t.kind === "job") {
    const { data: job } = await supabase
      .from("jobs")
      .select("id, title, skills, requirements, description, companies(name)")
      .eq("id", t.jobId)
      .maybeSingle();
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    const company = (Array.isArray(job.companies) ? job.companies[0] : job.companies) as { name: string } | null;
    jobSkills = job.skills ?? [];
    target = {
      kind: "job",
      title: job.title,
      company: company?.name ?? "",
      skills: jobSkills,
      requirements: job.requirements ?? [],
      summary: job.description.split("\n\n").slice(0, 2).join("\n").slice(0, 900),
    };
    targetKey = `job:${job.id}`;
    targetLabel = `${job.title}${company ? ` at ${company.name}` : ""}`;
  }

  const { data: cached } = await supabase
    .from("cv_grades")
    .select("score, rubric, issues, checks, feedback, model, created_at")
    .eq("cv_id", cvId)
    .eq("prompt_version", GRADE_VERSION)
    .eq("target_role", targetKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cached) {
    return NextResponse.json({
      cached: true,
      targetLabel,
      score: cached.score,
      rubric: cached.rubric,
      issues: cached.issues,
      checks: cached.checks,
      ...(cached.feedback as object),
      model: cached.model,
      createdAt: cached.created_at,
    });
  }

  const rl = rateLimit(`grade:${userId}`, limits.grade.limit, limits.grade.windowMs);
  if (!rl.ok) {
    return NextResponse.json({ error: `You've graded a lot recently. Try again in ${Math.ceil(rl.retryAfter / 60)} min.` }, { status: 429 });
  }

  try {
    const stored = cv.parsed as { v?: string; data?: unknown } | null;
    let parsed = stored?.v === PARSE_VERSION ? parsedCvSchema.safeParse(stored.data).data : undefined;

    if (!parsed) {
      const { data: blob, error } = await supabase.storage.from("cvs").download(cv.storage_path);
      if (error || !blob) return NextResponse.json({ error: "We couldn't open your CV file. Try uploading it again." }, { status: 500 });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const text = cv.mime_type === DOCX ? (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value : undefined;
      if (cv.mime_type === DOCX && !text?.trim()) {
        return NextResponse.json({ error: "That Word file looks empty. Try a PDF instead." }, { status: 422 });
      }
      const res = await extractCv({ bytes, mime: cv.mime_type, text });
      parsed = res.data;
      await supabase.from("cvs").update({ parsed: { v: PARSE_VERSION, data: parsed }, parse_status: "parsed" }).eq("id", cvId);
    }

    const checks = runChecks(parsed);
    const grade = await judgeCv(parsed, target, checks);
    const feedback = {
      strengths: grade.strengths,
      roleFit: grade.roleFit,
      missingKeywords: target.kind === "job" ? missingKeywords(parsed, jobSkills) : [],
      targetLabel,
      quality: grade.quality,
      fit: grade.fit,
    };

    const createdAt = new Date().toISOString();
    if (hasAdmin()) {
      await admin().from("cv_grades").insert({
        cv_id: cvId,
        user_id: userId,
        job_id: t.kind === "job" ? t.jobId : null,
        target_role: targetKey,
        score: grade.score,
        rubric: grade.rubric,
        issues: grade.issues,
        checks: checks.checks,
        feedback,
        model: grade.model,
        prompt_version: GRADE_VERSION,
      });
    }

    return NextResponse.json({
      cached: false,
      score: grade.score,
      rubric: grade.rubric,
      issues: grade.issues,
      checks: checks.checks,
      ...feedback,
      model: grade.model,
      createdAt,
    });
  } catch (e) {
    await supabase.from("cvs").update({ parse_status: "failed" }).eq("id", cvId).is("parsed", null);
    if (e instanceof InvalidTargetError) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof AiBusyError) return NextResponse.json({ error: e.message }, { status: 503 });
    if (e instanceof AiUnavailableError) return NextResponse.json({ error: "AI is not configured yet." }, { status: 503 });
    return NextResponse.json({ error: "Grading failed. Please try again in a minute." }, { status: 500 });
  }
}
