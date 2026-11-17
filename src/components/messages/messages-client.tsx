"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Ban, Loader2, MessageSquare, RotateCw, Send } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { loadThread, markRead, refreshConversations, sendMessage, unblockConversation, type BlockState } from "@/app/messages/actions";
import { ChatMenu } from "./chat-menu";
import { MAX_MESSAGE, type ConversationDto, type MessageDto } from "@/lib/messages/types";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function listTime(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? clock(iso) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const dedupe = (list: MessageDto[]) => {
  const seen = new Set<string>();
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
};

type MessageRow = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };

export function MessagesClient({
  userId,
  role,
  initialConversations,
  initialActive,
}: {
  userId: string;
  role: "candidate" | "employer";
  initialConversations: ConversationDto[];
  initialActive: string | null;
}) {
  const [supabase] = useState(() => createClient());
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialActive);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [loading, setLoading] = useState(Boolean(initialActive));
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [blocked, setBlocked] = useState<BlockState>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const activeRef = useRef(activeId);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  function openConversation(id: string | null) {
    if (id === activeId) return;
    setActiveId(id);
    setLoading(Boolean(id));
    setMessages([]);
    setTyping(false);
    setBlocked(null);
    stick.current = true;
  }

  const reloadList = useCallback(async () => {
    try {
      setConversations(await refreshConversations());
    } catch {
      // The list refreshes again on the next event.
    }
  }, []);

  const clearUnread = useCallback((id: string) => {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    void markRead(id);
  }, []);

  // Load the thread when the open conversation changes.
  useEffect(() => {
    if (!activeId) return;
    let live = true;
    loadThread(activeId)
      .then((t) => {
        if (!live) return;
        setMessages(t.messages);
        setBlocked(t.blocked);
        setLoading(false);
        clearUnread(activeId);
      })
      .catch(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [activeId, clearUnread]);

  // Live delivery: new messages and read receipts arrive over Realtime, already filtered by Row Level Security.
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as MessageRow;
        const mine = m.sender_id === userId;
        if (m.conversation_id === activeRef.current) {
          setMessages((list) => dedupe([...list, { id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }]));
          if (!mine) {
            setTyping(false);
            if (document.visibilityState === "visible") clearUnread(m.conversation_id);
          }
        }
        setConversations((list) => {
          const known = list.find((c) => c.id === m.conversation_id);
          if (!known) {
            void reloadList();
            return list;
          }
          const unreadNow = !mine && !(m.conversation_id === activeRef.current && document.visibilityState === "visible");
          const next = { ...known, lastPreview: m.body.slice(0, 160), lastAt: m.created_at, unread: known.unread + (unreadNow ? 1 : 0) };
          return [next, ...list.filter((c) => c.id !== known.id)];
        });
      })
      .subscribe();
    const onFocus = () => activeRef.current && clearUnread(activeRef.current);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, clearUnread, reloadList]);

  // "is typing…" travels over a Broadcast channel: nothing is stored.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`typing:${activeId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId === userId) return;
        setTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3000);
      })
      .subscribe();
    typingChannel.current = channel;
    return () => {
      typingChannel.current = null;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [supabase, activeId, userId]);

  // Keep the newest message in view unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, typing, loading]);

  function onScroll() {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function onType(value: string) {
    setDraft(value.slice(0, MAX_MESSAGE));
    const now = Date.now();
    if (value && typingChannel.current && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      void typingChannel.current.send({ type: "broadcast", event: "typing", payload: { userId } });
    }
  }

  async function deliver(text: string, tempId: string) {
    if (!activeId) return;
    const res = await sendMessage(activeId, text);
    if (res.message) {
      const saved = res.message;
      setMessages((list) => dedupe(list.map((m) => (m.id === tempId ? saved : m))));
    } else {
      setMessages((list) => list.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast.error(res.error ?? "Message not sent.");
    }
  }

  function send() {
    const text = draft.trim();
    if (!text || !activeId) return;
    const tempId = `tmp-${Date.now()}`;
    stick.current = true;
    setMessages((list) => [...list, { id: tempId, senderId: userId, body: text, createdAt: new Date().toISOString(), pending: true }]);
    setDraft("");
    void deliver(text, tempId);
  }

  function retry(m: MessageDto) {
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, pending: true, failed: false } : x)));
    void deliver(m.body, m.id);
  }


  return (
    <div className="grid h-[calc(100dvh-4rem)] overflow-hidden bg-paper sm:h-[calc(100dvh-7rem)] sm:rounded-[28px] sm:shadow-soft sm:ring-1 sm:ring-line md:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={`${active ? "hidden md:flex" : "flex"} min-h-0 flex-col border-line md:border-r`} aria-label="Conversations">
        <div className="border-b border-line px-5 py-4">
          <h1 className="font-display text-[1.25rem] font-extrabold tracking-[-0.02em]">Messages</h1>
        </div>
        {conversations.length === 0 ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint text-forest">
                <MessageSquare size={22} aria-hidden />
              </span>
              <p className="mt-4 font-display text-[1.05rem] font-extrabold">No conversations yet</p>
              <p className="mt-1 text-[13.5px] leading-snug text-muted">
                {role === "employer"
                  ? "Open an applicant and choose Message to start a conversation."
                  : "When a company writes to you about an application, the conversation appears here."}
              </p>
              <Link
                href={role === "employer" ? "/recruiter" : "/applications"}
                className="mt-4 inline-flex h-10 items-center rounded-full bg-mint px-5 text-[13.5px] font-bold text-forest-deep hover:bg-mint/70"
              >
                {role === "employer" ? "Go to dashboard" : "My applications"}
              </Link>
            </div>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openConversation(c.id)}
                  aria-current={c.id === activeId ? "true" : undefined}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${c.id === activeId ? "bg-mint/50" : "hover:bg-ink/[0.03]"}`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint font-display text-[14px] font-bold text-forest-deep">{initials(c.otherName)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-[14.5px] ${c.unread ? "font-extrabold" : "font-semibold"}`}>{c.otherName}</span>
                      <span className="shrink-0 text-[11.5px] text-muted">{listTime(c.lastAt)}</span>
                    </span>
                    <span className="block truncate text-[12px] font-medium text-forest">{c.jobTitle}</span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-[13px] ${c.unread ? "font-semibold text-ink" : "text-muted"}`}>{c.lastPreview || "No messages yet"}</span>
                      {c.unread > 0 && (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-coral px-1.5 text-[11px] font-bold text-white">{c.unread > 9 ? "9+" : c.unread}</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className={`${active ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col bg-sand/40`} aria-label="Conversation">
        {!active ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-paper text-forest ring-1 ring-line">
                <MessageSquare size={24} aria-hidden />
              </span>
              <p className="mt-4 font-display text-[1.1rem] font-extrabold">Select a conversation</p>
              <p className="mt-1 text-[14px] text-muted">Messages arrive here instantly.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line bg-paper px-3 py-3 sm:px-5">
              <button type="button" onClick={() => openConversation(null)} aria-label="Back to conversations" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink md:hidden">
                <ArrowLeft size={18} aria-hidden />
              </button>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint font-display text-[13px] font-bold text-forest-deep">{initials(active.otherName)}</span>
              <div className="min-w-0">
                <p className="truncate font-display text-[1.02rem] font-bold tracking-tight">{active.otherName}</p>
                <p className="truncate text-[12.5px] text-muted">About: {active.jobTitle}</p>
              </div>
              <ChatMenu conversationId={active.id} name={active.otherName} blocked={blocked} onBlockChange={setBlocked} />
            </header>

            <div ref={scroller} onScroll={onScroll} data-lenis-prevent className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6" aria-live="polite">
              {loading ? (
                <div className="grid h-full place-items-center text-muted">
                  <Loader2 size={20} className="animate-spin" aria-label="Loading messages" />
                </div>
              ) : messages.length === 0 ? (
                <div className="grid h-full place-items-center text-center">
                  <p className="max-w-[260px] text-[14px] leading-snug text-muted">No messages yet. Say hello and introduce yourself.</p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const mine = m.senderId === userId;
                  const prev = messages[i - 1];
                  const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                  const grouped = prev && !newDay && prev.senderId === m.senderId;
                  return (
                    <div key={m.id}>
                      {newDay && (
                        <p className="my-3 text-center text-[11.5px] font-semibold tracking-wide text-muted uppercase">{dayLabel(m.createdAt)}</p>
                      )}
                      <div className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2.5"}`}>
                        <div className={`max-w-[82%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                          <p
                            className={`rounded-[20px] px-4 py-2.5 text-[14.5px] leading-snug break-words whitespace-pre-wrap ${
                              mine ? "rounded-br-md bg-forest text-white" : "rounded-bl-md bg-paper text-ink ring-1 ring-line"
                            } ${m.pending ? "opacity-70" : ""} ${m.failed ? "ring-2 ring-coral" : ""}`}
                          >
                            {m.body}
                          </p>
                          <span className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-muted">
                            {m.failed ? (
                              <button type="button" onClick={() => retry(m)} className="inline-flex items-center gap-1 font-bold text-[#b4391f] hover:underline">
                                <RotateCw size={11} aria-hidden /> Not sent. Tap to retry
                              </button>
                            ) : (
                              !m.pending && clock(m.createdAt)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {typing && (
                <div className="mt-2.5 flex" aria-label={`${active.otherName} is typing`}>
                  <span className="inline-flex items-center gap-1 rounded-[20px] rounded-bl-md bg-paper px-4 py-3 ring-1 ring-line">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </span>
                </div>
              )}
            </div>

            {blocked ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-4 py-4 sm:px-6">
                <p className="flex items-center gap-2 text-[14px] text-muted">
                  <Ban size={16} className="shrink-0" aria-hidden />
                  {blocked === "me" ? `You blocked ${active.otherName}. They can't message you here.` : "You can't reply to this conversation."}
                </p>
                {blocked === "me" && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await unblockConversation(active.id);
                      if (res.error) toast.error(res.error);
                      else setBlocked(null);
                    }}
                    className="h-10 rounded-full bg-white px-5 text-[13.5px] font-semibold ring-1 ring-line hover:bg-mint/50"
                  >
                    Unblock
                  </button>
                )}
              </div>
            ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-end gap-2 border-t border-line bg-paper px-3 py-3 sm:px-5"
            >
              <label htmlFor="chat-input" className="sr-only">
                Message
              </label>
              <textarea
                id="chat-input"
                value={draft}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Write a message…"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] bg-white px-4 py-3 text-[14.5px] leading-snug ring-1 ring-line outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-forest"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send message"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest text-white transition-[background-color,transform,opacity] hover:bg-forest-deep active:scale-95 disabled:opacity-40"
              >
                <Send size={17} aria-hidden />
              </button>
            </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
