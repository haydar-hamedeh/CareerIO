import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { ConversationDto } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The signed-in user's conversations, newest first, with the other person's name and the unread count. */
export async function loadConversations(supabase: Supabase, userId: string, role: "candidate" | "employer"): Promise<ConversationDto[]> {
  const [{ data: rows }, { data: unreadRows }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, employer_id, candidate_id, job_title, last_message_at, last_message_preview")
      .order("last_message_at", { ascending: false })
      .limit(100),
    supabase.rpc("conversation_unread"),
  ]);
  // Companies start the conversation; a candidate only sees it once the company has written.
  const list = (rows ?? []).filter((c) => role === "employer" || Boolean(c.last_message_preview));
  if (list.length === 0) return [];

  const otherIds = [...new Set(list.map((c) => (role === "employer" ? c.candidate_id : c.employer_id)))];
  const names = new Map<string, string>();
  if (role === "employer") {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", otherIds);
    for (const p of data ?? []) if (p.full_name) names.set(p.id, p.full_name);
  } else {
    const { data } = await supabase.from("companies").select("owner_id, name").in("owner_id", otherIds);
    for (const c of data ?? []) if (c.owner_id) names.set(c.owner_id, c.name);
  }
  const unread = new Map(((unreadRows ?? []) as { conversation_id: string; unread: number | string }[]).map((r) => [r.conversation_id, Number(r.unread)]));

  return list.map((c) => {
    const other = role === "employer" ? c.candidate_id : c.employer_id;
    return {
      id: c.id,
      otherName: names.get(other) ?? (role === "employer" ? "Candidate" : "Company"),
      jobTitle: c.job_title,
      lastPreview: c.last_message_preview ?? "",
      lastAt: c.last_message_at,
      unread: unread.get(c.id) ?? 0,
    };
  });
}
