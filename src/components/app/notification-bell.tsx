"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Popover } from "radix-ui";
import { Bell, CalendarCheck, CheckCheck, MessageSquare, UserPlus } from "lucide-react";
import { getNotifications, markNotificationsRead, type NotificationItem } from "@/app/notifications/actions";

const ago = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

const icon = { applied: UserPlus, interview: CalendarCheck, status: CheckCheck, message: MessageSquare } as const;

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getNotifications();
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      // The bell is a convenience; a failed refresh just leaves the last state.
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 60_000);
    window.addEventListener("focus", load);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      void markNotificationsRead();
    }
    if (!next) setItems((list) => list.map((n) => ({ ...n, read: true })));
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink"
      >
        <Bell size={17} aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[10.5px] font-bold text-white ring-2 ring-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          data-lenis-prevent
          className="z-50 max-h-[min(70dvh,480px)] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-3xl bg-paper p-2 shadow-lift ring-1 ring-line outline-none"
        >
          <p className="px-3 pt-2 pb-1.5 font-display text-[15px] font-extrabold tracking-tight">Notifications</p>
          {items.length === 0 ? (
            <p className="px-3 pt-1 pb-4 text-[13.5px] leading-snug text-muted">Nothing yet. Updates about your applications show up here.</p>
          ) : (
            <ul>
              {items.map((n) => {
                const Icon = icon[n.kind] ?? Bell;
                const body = (
                  <span className="flex items-start gap-3">
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${n.kind === "interview" ? "bg-forest text-white" : "bg-mint text-forest-deep"}`}>
                      <Icon size={15} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`text-[13.5px] leading-snug ${n.read ? "font-medium" : "font-bold"}`}>{n.title}</span>
                        <span className="shrink-0 text-[11.5px] text-muted">{ago(n.createdAt)}</span>
                      </span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-muted">{n.body}</span>}
                    </span>
                  </span>
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => setOpen(false)} className="block rounded-2xl px-3 py-2.5 transition-colors hover:bg-ink/[0.04]">
                        {body}
                      </Link>
                    ) : (
                      <div className="rounded-2xl px-3 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
