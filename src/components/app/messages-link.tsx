"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUnreadMessages } from "@/app/messages/actions";

export function MessagesLink({ active }: { active: boolean }) {
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      setUnread(await getUnreadMessages());
    } catch {
      // Keep the last count; the badge is a convenience.
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const first = setTimeout(load, 0);
    // A new message anywhere in the person's conversations updates the badge straight away.
    const channel = supabase
      .channel("unread-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_reads" }, load)
      .subscribe();
    window.addEventListener("focus", load);
    return () => {
      clearTimeout(first);
      window.removeEventListener("focus", load);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <Link
      href="/messages"
      aria-current={active ? "page" : undefined}
      aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
      className={`group relative inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors ${
        active ? "bg-mint text-forest-deep" : "text-muted hover:bg-ink/5 hover:text-ink"
      }`}
    >
      <MessageSquare size={16} className="transition-transform group-hover:-translate-y-0.5" aria-hidden />
      <span className="hidden sm:inline">Messages</span>
      {unread > 0 && (
        <span className="absolute -top-0.5 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[10.5px] font-bold text-white ring-2 ring-paper">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
