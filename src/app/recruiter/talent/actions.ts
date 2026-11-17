"use server";

import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cleanUserText } from "@/lib/ai/safety";
import { rateLimit } from "@/lib/ai/rate-limit";
import { emailInvite } from "@/lib/email/notify";
import { runTalentSearch } from "@/lib/recruiter/talent";
import type { TalentDto } from "@/lib/recruiter/talent-types";

async function employer() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "employer") return null;
  return { supabase, userId: auth.user.id };
}

export async function searchTalent(input: { q: string; jobId: string | null }): Promise<TalentDto[]> {
  const parsed = z.object({ q: z.string().max(200), jobId: z.uuid().nullable() }).safeParse(input);
  if (!parsed.success) return [];
  const ctx = await employer();
  if (!ctx) return [];
  const rl = rateLimit(`talent:${ctx.userId}`, 60, 60_000);
  if (!rl.ok) return [];
  return runTalentSearch(ctx.supabase, parsed.data);
}

const inviteSchema = z.object({
  jobId: z.uuid({ error: "Choose a job." }),
  candidateId: z.uuid(),
  message: z.string().max(500, { error: "Keep the message under 500 characters." }).optional(),
});

export async function inviteCandidate(input: z.input<typeof inviteSchema>): Promise<{ ok?: boolean; error?: string }> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const ctx = await employer();
  if (!ctx) return { error: "Only a company account can invite candidates." };
  const rl = rateLimit(`invite:${ctx.userId}`, 30, 60 * 60_000);
  if (!rl.ok) return { error: "You've sent a lot of invitations. Try again in a little while." };

  const { jobId, candidateId } = parsed.data;
  // Row Level Security only returns this company's own jobs.
  const { data: job } = await ctx.supabase.from("jobs").select("id, status").eq("id", jobId).maybeSingle();
  if (!job) return { error: "We couldn't find that job." };
  if (job.status !== "open") return { error: "Publish the job before inviting people to it." };
  const { data: applied } = await ctx.supabase.from("applications").select("id").eq("job_id", jobId).eq("candidate_id", candidateId).maybeSingle();
  if (applied) return { error: "This person already applied to that job." };

  const message = cleanUserText(parsed.data.message ?? "") || null;
  const { error } = await ctx.supabase.from("job_invites").insert({ job_id: jobId, candidate_id: candidateId, employer_id: ctx.userId, message });
  if (error) {
    if (error.code === "23505") return { error: "You already invited this person to that job." };
    if (error.code === "42501") return { error: "This person can't be invited." };
    return { error: "We couldn't send the invitation. Please try again." };
  }
  after(() => emailInvite(candidateId, jobId, message));
  return { ok: true };
}
