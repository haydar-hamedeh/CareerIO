"use server";

import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { emailNewMessage } from "@/lib/email/notify";
import { admin, hasAdmin } from "@/lib/supabase/admin";
import { cleanUserText } from "@/lib/ai/safety";
import { limits, rateLimit } from "@/lib/ai/rate-limit";
import { loadConversations } from "@/lib/messages/load";
import { MAX_MESSAGE, type ConversationDto, type MessageDto } from "@/lib/messages/types";

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return { supabase, userId: data.user.id, role: (profile?.role ?? "candidate") as "candidate" | "employer" };
}

/** Opens (or finds) the conversation for an application. Either the company owner or the applicant can do this. */
export async function startConversation(applicationId: string): Promise<{ id?: string; error?: string }> {
  if (!z.uuid().safeParse(applicationId).success) return { error: "Invalid request." };
  const ctx = await me();
  if (!ctx) return { error: "Please log in again." };
  const { supabase, userId } = ctx;

  const { data: existing } = await supabase.from("conversations").select("id").eq("application_id", applicationId).maybeSingle();
  if (existing) return { id: existing.id };

  // Row Level Security only lets each side read its own applications.
  const { data: app } = await supabase
    .from("applications")
    .select("id, job_id, candidate_id, jobs(title, companies(owner_id))")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "We couldn't find that application." };
  const job = (Array.isArray(app.jobs) ? app.jobs[0] : app.jobs) as { title: string; companies: { owner_id: string | null } | { owner_id: string | null }[] | null } | null;
  const company = job ? ((Array.isArray(job.companies) ? job.companies[0] : job.companies) as { owner_id: string | null } | null) : null;
  const employerId = company?.owner_id;
  if (!job || !employerId) return { error: "This job's company can't receive messages." };
  if (userId !== employerId) return { error: "Only the company can start a conversation." };

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ application_id: app.id, employer_id: employerId, candidate_id: app.candidate_id, job_id: app.job_id, job_title: job.title })
    .select("id")
    .single();
  if (error || !created) {
    if (error?.code === "23505") {
      const { data: again } = await supabase.from("conversations").select("id").eq("application_id", applicationId).maybeSingle();
      if (again) return { id: again.id };
    }
    return { error: "We couldn't open the conversation. Please try again." };
  }
  return { id: created.id };
}

export async function sendMessage(conversationId: string, body: string): Promise<{ message?: MessageDto; error?: string }> {
  if (!z.uuid().safeParse(conversationId).success) return { error: "Invalid request." };
  const text = cleanUserText(body);
  if (!text) return { error: "Write a message first." };
  if (text.length > MAX_MESSAGE) return { error: `Keep messages under ${MAX_MESSAGE.toLocaleString("en-US")} characters.` };
  const ctx = await me();
  if (!ctx) return { error: "Please log in again." };
  const rl = rateLimit(`message:${ctx.userId}`, limits.message.limit, limits.message.windowMs);
  if (!rl.ok) return { error: `You're sending messages very fast. Try again in ${rl.retryAfter}s.` };

  const { data, error } = await ctx.supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: ctx.userId, body: text })
    .select("id, sender_id, body, created_at")
    .single();
  if (error || !data) {
    // The restrictive "not blocked" policy rejects sends into a blocked conversation.
    if (error?.code === "42501") return { error: "You can't send messages in this conversation." };
    return { error: "Message not sent. Check your connection and try again." };
  }
  after(() => emailNewMessage(conversationId, ctx.userId, data.created_at, text));
  return { message: { id: data.id, senderId: data.sender_id, body: data.body, createdAt: data.created_at } };
}

/** The latest messages of a conversation, oldest first, and when the other person last read it. */
export async function loadThread(conversationId: string): Promise<{ messages: MessageDto[]; otherReadAt: string | null; hasMore: boolean; blocked: BlockState }> {
  const empty = { messages: [], otherReadAt: null, hasMore: false, blocked: null };
  if (!z.uuid().safeParse(conversationId).success) return empty;
  const ctx = await me();
  if (!ctx) return empty;
  const PAGE = 100;
  const [{ data: rows }, { data: reads }] = await Promise.all([
    ctx.supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(PAGE + 1),
    ctx.supabase.from("conversation_reads").select("user_id, last_read_at").eq("conversation_id", conversationId),
  ]);
  const list = rows ?? [];
  const other = (reads ?? []).find((r) => r.user_id !== ctx.userId);
  return {
    messages: list
      .slice(0, PAGE)
      .reverse()
      .map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at })),
    otherReadAt: other?.last_read_at ?? null,
    hasMore: list.length > PAGE,
    blocked: await blockState(conversationId, ctx.userId, ctx.supabase),
  };
}

export async function markRead(conversationId: string): Promise<void> {
  if (!z.uuid().safeParse(conversationId).success) return;
  const ctx = await me();
  if (!ctx) return;
  await ctx.supabase.rpc("mark_conversation_read", { cid: conversationId });
}

export async function refreshConversations(): Promise<ConversationDto[]> {
  const ctx = await me();
  if (!ctx) return [];
  return loadConversations(ctx.supabase, ctx.userId, ctx.role);
}

export async function getUnreadMessages(): Promise<number> {
  const ctx = await me();
  if (!ctx) return 0;
  const { data } = await ctx.supabase.rpc("conversation_unread");
  return ((data ?? []) as { unread: number | string }[]).reduce((n, r) => n + Number(r.unread), 0);
}

export type BlockState = "me" | "them" | null;

/** Whether this conversation is blocked, and by whom. The other person's block is only visible with the service role. */
async function blockState(conversationId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<BlockState> {
  const { data: mine } = await supabase.from("conversation_blocks").select("blocker_id").eq("conversation_id", conversationId).eq("blocker_id", userId).maybeSingle();
  if (mine) return "me";
  if (!hasAdmin()) return null;
  const { data: theirs } = await admin().from("conversation_blocks").select("blocker_id").eq("conversation_id", conversationId).limit(1);
  return theirs?.length ? "them" : null;
}

export async function blockConversation(conversationId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!z.uuid().safeParse(conversationId).success) return { error: "Invalid request." };
  const ctx = await me();
  if (!ctx) return { error: "Please log in again." };
  const { error } = await ctx.supabase.from("conversation_blocks").insert({ conversation_id: conversationId, blocker_id: ctx.userId });
  if (error && error.code !== "23505") return { error: "We couldn't block this person. Please try again." };
  return { ok: true };
}

export async function unblockConversation(conversationId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!z.uuid().safeParse(conversationId).success) return { error: "Invalid request." };
  const ctx = await me();
  if (!ctx) return { error: "Please log in again." };
  const { error } = await ctx.supabase.from("conversation_blocks").delete().eq("conversation_id", conversationId).eq("blocker_id", ctx.userId);
  if (error) return { error: "We couldn't unblock. Please try again." };
  return { ok: true };
}

const reportSchema = z.object({
  conversationId: z.uuid(),
  reason: z.enum(["spam", "harassment", "scam", "inappropriate", "other"]),
  details: z.string().max(500, { error: "Keep the details under 500 characters." }).optional(),
});

export async function reportConversation(input: z.input<typeof reportSchema>): Promise<{ ok?: boolean; error?: string }> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const ctx = await me();
  if (!ctx) return { error: "Please log in again." };
  const rl = rateLimit(`report:${ctx.userId}`, 10, 60 * 60_000);
  if (!rl.ok) return { error: "You've sent several reports. Try again later." };
  const { error } = await ctx.supabase.from("message_reports").insert({
    reporter_id: ctx.userId,
    conversation_id: parsed.data.conversationId,
    reason: parsed.data.reason,
    details: cleanUserText(parsed.data.details ?? "") || null,
  });
  if (error) return { error: "We couldn't send your report. Please try again." };
  return { ok: true };
}
