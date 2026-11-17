"use server";

import { createClient } from "@/lib/supabase/server";

export type NotificationItem = {
  id: string;
  kind: "applied" | "status" | "interview" | "message";
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export async function getNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { items: [], unread: 0 };

  const [{ data }, { count }] = await Promise.all([
    supabase.from("notifications").select("id, kind, title, body, href, read_at, created_at").order("created_at", { ascending: false }).limit(15),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  return {
    unread: count ?? 0,
    items: (data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      href: n.href,
      read: Boolean(n.read_at),
      createdAt: n.created_at,
    })),
  };
}

export async function markNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", auth.user.id).is("read_at", null);
}
