"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { admin, hasAdmin } from "@/lib/supabase/admin";
import { cleanUserText } from "@/lib/ai/safety";
import { limits, rateLimit } from "@/lib/ai/rate-limit";
import { reviewApplication } from "@/lib/ai/application-review";
import { refreshJobEmbedding } from "@/lib/ai/job-embedding";
import { emailStatusChange } from "@/lib/email/notify";
import { schemaFor, type JobInput } from "@/lib/recruiter/job-schema";

type Result = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; id?: string };

async function employer() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: profile }, { data: company }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
    supabase.from("companies").select("id, name").eq("owner_id", auth.user.id).maybeSingle(),
  ]);
  if (profile?.role !== "employer" || !company) return null;
  return { supabase, user: auth.user, company };
}

const NOT_ALLOWED: Result = { error: "Only a company account can do this. Please log in again." };

/** Candidates read the first paragraph of a job as the intro, so recruiter text is stored behind a one-line intro. */
const withIntro = (company: string, title: string, location: string, description: string) =>
  `${company} is hiring a ${title}${location ? ` in ${location}` : ""}.\n\n${description}`;

export async function saveJob(input: JobInput, jobId?: string): Promise<Result> {
  const parsed = schemaFor(input.status === "open" ? "open" : "draft").safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { error: "Some details need fixing.", fieldErrors };
  }
  if (jobId && !z.uuid().safeParse(jobId).success) return { error: "Invalid job." };
  const ctx = await employer();
  if (!ctx) return NOT_ALLOWED;
  const { supabase, company } = ctx;
  const d = parsed.data;

  const unique = (list: string[]) => [...new Map(list.map((s) => [s.toLowerCase(), s])).values()];
  const row = {
    title: cleanUserText(d.title),
    description: withIntro(company.name, cleanUserText(d.title), cleanUserText(d.location), cleanUserText(d.description)),
    requirements: d.requirements.map(cleanUserText).filter(Boolean),
    skills: unique(d.skills.map(cleanUserText).filter(Boolean)),
    field: d.field,
    seniority: d.seniority,
    employment_type: d.employmentType,
    work_mode: d.workMode,
    location: cleanUserText(d.location) || null,
    salary_min: d.salaryMin ?? null,
    salary_max: d.salaryMax ?? null,
    salary_currency: d.salaryMin || d.salaryMax ? d.salaryCurrency : null,
    screening_questions: d.screeningQuestions.map((q) => ({ ...q, text: cleanUserText(q.text) })),
    status: d.status,
  };

  let id = jobId;
  if (id) {
    const { data: current } = await supabase.from("jobs").select("published_at").eq("id", id).eq("company_id", company.id).maybeSingle();
    if (!current) return { error: "We couldn't find that job." };
    const { error } = await supabase
      .from("jobs")
      .update({ ...row, published_at: current.published_at ?? (d.status === "open" ? new Date().toISOString() : null) })
      .eq("id", id)
      .eq("company_id", company.id);
    if (error) return { error: "We couldn't save the job. Please try again." };
  } else {
    const { data, error } = await supabase
      .from("jobs")
      .insert({ ...row, company_id: company.id, is_demo: false, published_at: d.status === "open" ? new Date().toISOString() : null })
      .select("id")
      .single();
    if (error || !data) return { error: "We couldn't save the job. Please try again." };
    id = data.id;
  }

  const savedId = id as string;
  after(() => refreshJobEmbedding(savedId));
  revalidatePath("/recruiter");
  revalidatePath(`/jobs/${savedId}`);
  revalidatePath("/feed");
  return { ok: true, id: savedId };
}

export async function setJobStatus(jobId: string, status: "open" | "closed"): Promise<Result> {
  if (!z.uuid().safeParse(jobId).success) return { error: "Invalid job." };
  const ctx = await employer();
  if (!ctx) return NOT_ALLOWED;
  const { supabase, company } = ctx;
  const { data: current } = await supabase.from("jobs").select("published_at").eq("id", jobId).eq("company_id", company.id).maybeSingle();
  if (!current) return { error: "We couldn't find that job." };
  const { error } = await supabase
    .from("jobs")
    .update({ status, published_at: current.published_at ?? (status === "open" ? new Date().toISOString() : null) })
    .eq("id", jobId)
    .eq("company_id", company.id);
  if (error) return { error: "We couldn't update the job." };
  if (status === "open") after(() => refreshJobEmbedding(jobId));
  revalidatePath("/recruiter");
  revalidatePath(`/recruiter/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/feed");
  return { ok: true };
}

const updateSchema = z.object({
  applicationId: z.uuid(),
  status: z.enum(["in_review", "interview", "rejected", "hired"]),
  interviewAt: z.string().max(40).optional(),
  message: z.string().max(1000, { error: "Keep the message under 1,000 characters." }).optional(),
});

export async function updateApplication(input: z.input<typeof updateSchema>): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const ctx = await employer();
  if (!ctx) return NOT_ALLOWED;
  const { supabase } = ctx;
  const { applicationId, status, interviewAt, message } = parsed.data;

  // Row Level Security only returns applications for this company's own jobs.
  const { data: app } = await supabase.from("applications").select("id, job_id").eq("id", applicationId).maybeSingle();
  if (!app) return { error: "We couldn't find that application." };

  const patch: { status: string; interview_at?: string | null; interview_note?: string | null } = { status };
  if (status === "interview") {
    const at = interviewAt ? new Date(interviewAt) : null;
    if (at && Number.isNaN(at.getTime())) return { error: "That date doesn't look right." };
    patch.interview_at = at ? at.toISOString() : null;
    patch.interview_note = cleanUserText(message ?? "") || null;
    if (at) {
      const when = at.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      patch.interview_note = [`Interview: ${when}.`, patch.interview_note].filter(Boolean).join(" ");
    }
  }
  const { error } = await supabase.from("applications").update(patch).eq("id", applicationId);
  if (error) return { error: "We couldn't update the application." };
  after(() => emailStatusChange(applicationId, status, patch.interview_note));
  revalidatePath(`/recruiter/jobs/${app.job_id}`);
  revalidatePath("/recruiter");
  revalidatePath("/applications");
  return { ok: true };
}

export async function addApplicationNote(applicationId: string, body: string): Promise<Result> {
  const text = cleanUserText(body);
  if (!z.uuid().safeParse(applicationId).success || text.length < 1 || text.length > 4000) return { error: "Write a note up to 4,000 characters." };
  const ctx = await employer();
  if (!ctx) return NOT_ALLOWED;
  const { error } = await ctx.supabase.from("application_notes").insert({ application_id: applicationId, author_id: ctx.user.id, body: text });
  if (error) return { error: "We couldn't save the note." };
  return { ok: true };
}

export async function getApplicationNotes(applicationId: string): Promise<{ id: string; body: string; createdAt: string }[]> {
  if (!z.uuid().safeParse(applicationId).success) return [];
  const ctx = await employer();
  if (!ctx) return [];
  const { data } = await ctx.supabase
    .from("application_notes")
    .select("id, body, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at }));
}

/** Runs the AI review again, for applications whose automatic review did not finish. */
export async function reviewNow(applicationId: string): Promise<Result> {
  if (!z.uuid().safeParse(applicationId).success) return { error: "Invalid request." };
  const ctx = await employer();
  if (!ctx) return NOT_ALLOWED;
  const { data: app } = await ctx.supabase.from("applications").select("id, job_id").eq("id", applicationId).maybeSingle();
  if (!app) return { error: "We couldn't find that application." };
  const rl = rateLimit(`review:${ctx.user.id}`, limits.review.limit, limits.review.windowMs);
  if (!rl.ok) return { error: `You've re-run a lot of reviews. Try again in ${Math.ceil(rl.retryAfter / 60)} min.` };
  const ok = await reviewApplication(applicationId);
  if (!ok) return { error: "The AI couldn't finish the review. Please try again in a minute." };
  revalidatePath(`/recruiter/jobs/${app.job_id}`);
  return { ok: true };
}

/** A short-lived link to the applicant's CV. Employers have no storage access of their own; this checks the application first. */
export async function getCvLink(applicationId: string): Promise<{ url?: string; error?: string }> {
  if (!z.uuid().safeParse(applicationId).success) return { error: "Invalid request." };
  const ctx = await employer();
  if (!ctx) return { error: NOT_ALLOWED.error };
  if (!hasAdmin()) return { error: "File access isn't configured." };
  const { data: app } = await ctx.supabase.from("applications").select("cv_id").eq("id", applicationId).maybeSingle();
  if (!app?.cv_id) return { error: "This applicant didn't attach a CV." };
  const { data: cv } = await ctx.supabase.from("cvs").select("storage_path").eq("id", app.cv_id).maybeSingle();
  if (!cv) return { error: "We couldn't find that CV." };
  const { data, error } = await admin().storage.from("cvs").createSignedUrl(cv.storage_path, 300);
  if (error || !data) return { error: "We couldn't open that CV." };
  return { url: data.signedUrl };
}
