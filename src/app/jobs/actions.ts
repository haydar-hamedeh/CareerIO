"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { reviewApplication } from "@/lib/ai/application-review";
import { emailNewApplicant } from "@/lib/email/notify";
import { parseQuestions, type ScreeningAnswer } from "@/lib/jobs/screening";
import { createClient } from "@/lib/supabase/server";
import { countryByName } from "@/lib/geo/countries";
import { PHONE_RE } from "@/lib/onboarding/schema";
import { cleanUserText } from "@/lib/ai/safety";

type Result = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

const applySchema = z.object({
  jobId: z.uuid(),
  cvId: z.uuid({ error: "Choose a CV to send." }),
  phone: z
    .string()
    .trim()
    .regex(PHONE_RE, { error: "Enter a valid phone number, like +961 70 123 456." })
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 7 && digits <= 15;
    }, { error: "That number looks too short or too long." }),
  country: z
    .string()
    .trim()
    .min(1, { error: "Choose your country." })
    .refine((v) => countryByName.has(v), { error: "Choose a country from the list." }),
  coverLetter: z
    .string()
    .max(2000, { error: "Keep the note under 2,000 characters." })
    .transform(cleanUserText)
    .optional()
    .default(""),
  answers: z.record(z.string(), z.string().max(1000, { error: "Keep answers under 1,000 characters." })).optional().default({}),
});

export type ApplyInput = z.input<typeof applySchema>;

export async function applyToJob(input: ApplyInput): Promise<Result> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { error: "Some details need fixing.", fieldErrors };
  }
  const { jobId, cvId, phone, country, coverLetter, answers } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again." };

  const [{ data: cv }, { data: job }] = await Promise.all([
    supabase.from("cvs").select("id").eq("id", cvId).eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("jobs").select("screening_questions").eq("id", jobId).eq("status", "open").maybeSingle(),
  ]);
  if (!cv) return { error: "We couldn't find that CV.", fieldErrors: { cvId: "Choose one of your CVs." } };
  if (!job) return { error: "This job is no longer accepting applications." };

  // Answers are checked against the job's own questions, so only real questions are stored.
  const screening: ScreeningAnswer[] = [];
  const fieldErrors: Record<string, string> = {};
  for (const q of parseQuestions(job.screening_questions)) {
    const a = cleanUserText(answers[q.id] ?? "");
    if (!a) {
      if (q.required) fieldErrors[`q:${q.id}`] = "This question needs an answer.";
      continue;
    }
    if (q.type === "yesno" && a !== "Yes" && a !== "No") {
      fieldErrors[`q:${q.id}`] = "Choose Yes or No.";
      continue;
    }
    screening.push({ id: q.id, q: q.text, a });
  }
  if (Object.keys(fieldErrors).length) return { error: "Please answer the questions marked below.", fieldErrors };

  const { data: row, error } = await supabase
    .from("applications")
    .insert({
      job_id: jobId,
      candidate_id: auth.user.id,
      cv_id: cvId,
      cover_letter: coverLetter || null,
      contact_phone: phone,
      contact_country: country,
      screening_answers: screening,
    })
    .select("id")
    .single();

  if (error || !row) {
    if (error?.code === "23505") return { error: "You already applied to this job." };
    if (error?.code === "42501") return { error: "This job is no longer accepting applications." };
    return { error: "We couldn't send your application. Please try again." };
  }

  // The AI review runs after the response, so applying never waits for it.
  after(async () => {
    await Promise.allSettled([reviewApplication(row.id), emailNewApplicant(row.id)]);
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/applications");
  return { ok: true };
}

/**
 * Counts the person's first look at a job. The table's primary key makes every later call a no-op
 * (a duplicate-key error is expected and ignored), so opening and closing a job again never adds a view.
 */
export async function recordJobView(jobId: string): Promise<void> {
  if (!z.uuid().safeParse(jobId).success) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("job_views").insert({ job_id: jobId, user_id: auth.user.id });
}

export async function withdrawApplication(jobId: string): Promise<Result> {
  if (!z.uuid().safeParse(jobId).success) return { error: "Invalid job." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again." };
  const { error } = await supabase.from("applications").delete().eq("job_id", jobId).eq("candidate_id", auth.user.id);
  if (error) return { error: "We couldn't withdraw your application." };
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
