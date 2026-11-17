"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CalendarCheck, Check, Download, Inbox, Loader2, MapPin, Minus, Phone, Plus, RefreshCw, Search, SearchX, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { MatchRing } from "@/components/feed/job-card";
import { MessageButton, MessageIconButton } from "@/components/messages/message-button";
import { addApplicationNote, getApplicationNotes, getCvLink, reviewNow, updateApplication } from "@/app/recruiter/actions";
import { statusLabel, statusTone, type ApplicantDto, type AppStatus } from "@/lib/recruiter/types";
import { fitTone } from "@/lib/jobs/format";

const filters: { key: "all" | AppStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "applied", label: "New" },
  { key: "in_review", label: "In review" },
  { key: "interview", label: "Interview" },
  { key: "hired", label: "Hired" },
  { key: "rejected", label: "Rejected" },
];

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

const ago = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export function Applicants({ applicants, jobSkills, initialOpen }: { applicants: ApplicantDto[]; jobSkills: string[]; initialOpen: string | null }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | AppStatus>("all");
  const [sort, setSort] = useState<"score" | "recent">("score");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpen && applicants.some((a) => a.id === initialOpen) ? initialOpen : null);
  const [overrides, setOverrides] = useState<Record<string, Partial<ApplicantDto>>>({});

  const list = useMemo(() => applicants.map((a) => ({ ...a, ...overrides[a.id] })), [applicants, overrides]);

  // Reviews run in the background right after someone applies; poll until the recent ones are scored.
  const unscored = list.filter((a) => a.score === null).length;
  useEffect(() => {
    if (unscored === 0) return;
    let ticks = 0;
    const t = setInterval(() => {
      if (++ticks > 30) return clearInterval(t);
      router.refresh();
    }, 8000);
    return () => clearInterval(t);
  }, [unscored, router]);

  const needle = query.trim().toLowerCase();
  const matches = (a: ApplicantDto) =>
    !needle || [a.name, a.headline, a.level, a.location, a.summary, ...a.skills].some((v) => v?.toLowerCase().includes(needle));
  const searched = list.filter(matches);
  const counts = (key: "all" | AppStatus) => (key === "all" ? searched.length : searched.filter((a) => a.status === key).length);
  const shown = searched
    .filter((a) => filter === "all" || a.status === filter)
    .sort((a, b) =>
      sort === "score" ? (b.score ?? -1) - (a.score ?? -1) || +new Date(b.createdAt) - +new Date(a.createdAt) : +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  const open = list.find((a) => a.id === openId) ?? null;

  if (list.length === 0) {
    return (
      <div className="mt-6 rounded-[28px] bg-paper p-8 text-center shadow-soft ring-1 ring-line">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint text-forest">
          <Inbox size={22} aria-hidden />
        </span>
        <p className="mt-4 font-display text-[1.15rem] font-extrabold">No applicants yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[14px] text-muted">When someone applies, they appear here already scored against your requirements.</p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        animate={{ boxShadow: focused ? "0 10px 30px -12px rgba(14,92,66,0.35)" : "0 1px 2px rgba(0,0,0,0.04)" }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className={`mt-6 flex h-12 items-center gap-3 rounded-full bg-paper px-4 ring-1 transition-[box-shadow,--tw-ring-color] ${focused ? "ring-2 ring-forest" : "ring-line"}`}
      >
        <motion.span animate={{ scale: focused ? 1.12 : 1, rotate: focused ? -8 : 0 }} transition={{ type: "spring", stiffness: 380, damping: 18 }} className={focused ? "text-forest" : "text-muted"}>
          <Search size={18} aria-hidden />
        </motion.span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search by name, role, skill or location"
          aria-label="Search applicants"
          className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <AnimatePresence>
          {query && (
            <motion.span
              key="count"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="shrink-0 text-[12.5px] font-semibold text-muted tabular-nums"
            >
              {searched.length} found
            </motion.span>
          )}
          {query && (
            <motion.button
              key="clear"
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              initial={{ opacity: 0, scale: 0.4, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.4, rotate: 90 }}
              whileTap={{ scale: 0.85 }}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/5 text-muted hover:bg-ink/10 hover:text-ink"
            >
              <X size={14} aria-hidden />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter applicants" className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors ${filter === f.key ? "bg-forest text-white" : "bg-paper text-muted ring-1 ring-line hover:text-ink"}`}
            >
              {f.label} <span className="tabular-nums opacity-70">{counts(f.key)}</span>
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-[13px] font-medium text-muted">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as "score" | "recent")} className="h-9 rounded-full bg-paper px-3 text-[13px] font-semibold text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-forest">
            <option value="score">Best match</option>
            <option value="recent">Newest</option>
          </select>
        </label>
      </div>

      <ul className="mt-4 space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
        {shown.map((a) => (
          <motion.li
            key={a.id}
            layout="position"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 rounded-[24px] bg-paper p-4 shadow-soft ring-1 ring-line transition-shadow hover:ring-forest/40 sm:p-5"
          >
            <button type="button" onClick={() => setOpenId(a.id)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
              <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-full bg-mint font-display text-[14px] font-bold text-forest-deep sm:grid">{initials(a.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-display text-[1.02rem] font-bold tracking-tight">{a.name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${statusTone[a.status]}`}>{statusLabel[a.status]}</span>
                  {a.flagged && <AlertTriangle size={14} className="text-[#b4391f]" aria-label="Flagged by the AI review" />}
                </span>
                <span className="mt-0.5 block truncate text-[13.5px] text-muted">
                  {[a.headline, a.level, a.years !== null ? `${a.years} yrs` : null].filter(Boolean).join(" · ") || "No headline"}
                </span>
                {a.summary ? (
                  <span className="mt-1.5 line-clamp-2 block text-[13.5px] leading-snug text-ink/80">{a.summary}</span>
                ) : (
                  <span className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
                    <Loader2 size={12} className="animate-spin" aria-hidden /> AI is reading this application…
                  </span>
                )}
                <span className="mt-1 block text-[12px] text-muted">Applied {ago(a.createdAt)}</span>
              </span>
              {a.score !== null && <MatchRing pct={a.score} ai />}
            </button>
            <MessageIconButton applicationId={a.id} name={a.name} />
          </motion.li>
        ))}
        </AnimatePresence>
        {shown.length === 0 && (
          <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] bg-paper p-8 text-center ring-1 ring-line">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-mint text-forest">
              <SearchX size={20} aria-hidden />
            </span>
            <p className="mt-3 text-[14.5px] font-semibold">{needle ? `No applicants match “${query.trim()}”` : "No applicants in this stage."}</p>
            {needle && (
              <button type="button" onClick={() => setQuery("")} className="mt-2 text-[13.5px] font-semibold text-forest hover:underline">
                Clear search
              </button>
            )}
          </motion.li>
        )}
      </ul>

      <Dialog.Root open={Boolean(open)} onOpenChange={(o) => !o && setOpenId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
          <Dialog.Content
            data-lenis-prevent
            className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[760px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-[28px] bg-paper shadow-lift ring-1 ring-line outline-none"
          >
            {open && (
              <Panel
                key={open.id}
                a={open}
                jobSkills={jobSkills}
                onPatch={(p) => setOverrides((o) => ({ ...o, [open.id]: { ...o[open.id], ...p } }))}
                onRefresh={() => router.refresh()}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function Panel({ a, jobSkills, onPatch, onRefresh }: { a: ApplicantDto; jobSkills: string[]; onPatch: (p: Partial<ApplicantDto>) => void; onRefresh: () => void }) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"none" | "interview" | "reject">("none");
  const [when, setWhen] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<{ id: string; body: string; createdAt: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [cvBusy, setCvBusy] = useState(false);
  const tone = a.score !== null ? fitTone(a.score) : null;

  useEffect(() => {
    let live = true;
    getApplicationNotes(a.id).then((n) => live && setNotes(n));
    return () => {
      live = false;
    };
  }, [a.id]);

  const act = (status: Exclude<AppStatus, "applied">, extra?: { interviewAt?: string; message?: string }) =>
    start(async () => {
      const res = await updateApplication({ applicationId: a.id, status, ...extra });
      if (res.error) return void toast.error(res.error);
      onPatch({ status, ...(status === "interview" ? { interviewAt: extra?.interviewAt ? new Date(extra.interviewAt).toISOString() : null, interviewNote: extra?.message ?? null } : {}) });
      setMode("none");
      toast.success(status === "interview" ? "Interview invite sent. The candidate was notified." : `Marked as ${statusLabel[status].toLowerCase()}. The candidate was notified.`);
      onRefresh();
    });

  const rerun = () =>
    start(async () => {
      const res = await reviewNow(a.id);
      if (res.error) return void toast.error(res.error);
      toast.success("Review updated");
      onRefresh();
    });

  async function openCv() {
    setCvBusy(true);
    // Open the tab first, inside the click, so the browser doesn't block it; point it at the file once we have the link.
    const tab = window.open("", "_blank");
    const res = await getCvLink(a.id);
    setCvBusy(false);
    if (res.url && tab) tab.location.href = res.url;
    else {
      tab?.close();
      toast.error(res.error ?? "We couldn't open that CV.");
    }
  }

  async function saveNote() {
    const res = await addApplicationNote(a.id, noteText);
    if (res.error) return void toast.error(res.error);
    setNoteText("");
    setNotes(await getApplicationNotes(a.id));
  }

  return (
    <div className="p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Dialog.Title className="font-display text-[1.4rem] leading-tight font-extrabold tracking-[-0.025em]">{a.name}</Dialog.Title>
          <Dialog.Description className="mt-1 text-[14px] text-muted">
            {[a.headline, a.level, a.years !== null ? `${a.years} yrs experience` : null].filter(Boolean).join(" · ") || "Applicant"}
          </Dialog.Description>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
            <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${statusTone[a.status]}`}>{statusLabel[a.status]}</span>
            {a.phone && (
              <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 font-medium text-ink hover:underline">
                <Phone size={13} aria-hidden /> {a.phone}
              </a>
            )}
            {(a.country || a.location) && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} aria-hidden /> {[a.location, a.country].filter(Boolean).join(", ")}
              </span>
            )}
            <span>Applied {ago(a.createdAt)}</span>
          </div>
        </div>
        <Dialog.Close aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted ring-1 ring-line transition-colors hover:bg-ink/5 hover:text-ink">
          <X size={16} aria-hidden />
        </Dialog.Close>
      </div>

      <section className="mt-5 rounded-2xl bg-sand p-4" aria-label="AI review">
        <div className="flex items-start gap-4">
          {a.score !== null && tone ? (
            <MatchRing pct={a.score} ai />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white ring-1 ring-line">
              <Loader2 size={18} className="animate-spin text-muted" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.1em] text-forest-deep uppercase">
              <Sparkles size={13} aria-hidden /> AI review {tone && <span className={`normal-case tracking-normal ${tone.text}`}>· {tone.label}</span>}
            </p>
            <p className="mt-1 text-[14.5px] leading-snug">{a.summary ?? "The AI is still reading this application. This page updates by itself."}</p>
            {a.score === null && (
              <button type="button" onClick={rerun} disabled={pending} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-forest-deep hover:underline disabled:opacity-60">
                <RefreshCw size={13} className={pending ? "animate-spin" : ""} aria-hidden /> Run the review now
              </button>
            )}
          </div>
        </div>
        {a.flagged && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-coral/10 px-3 py-2 text-[13px] leading-snug text-[#9a3412]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
            Some text in this application looked like an attempt to influence the AI. It was ignored and the score is capped. Read the application yourself.
          </p>
        )}
        {a.score !== null && !a.usedCv && <p className="mt-3 text-[12.5px] text-muted">The CV could not be read, so this review is based on the profile and the note only.</p>}
      </section>

      {a.skillCheck && jobSkills.length > 0 && (
        <section className="mt-5" aria-label="Skills">
          <h3 className="font-display text-[15px] font-bold tracking-tight">Skills for this job</h3>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {a.skillCheck.has.map((s) => {
              const via = a.skillCheck?.via.find((v) => v.skill === s);
              return (
                <li key={s} className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1 text-[13px] font-semibold text-white">
                  <Check size={12} strokeWidth={3} aria-hidden /> {s}
                  {via && <span className="font-normal opacity-80">· from {via.from}</span>}
                </li>
              );
            })}
            {a.skillCheck.missing.map((s) => (
              <li key={s} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-[#b4391f] ring-1 ring-coral/40">
                <Minus size={12} strokeWidth={3} aria-hidden /> {s}
                <span className="sr-only"> (missing)</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(a.strengths.length > 0 || a.gaps.length > 0) && (
        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Strengths", items: a.strengths, kind: "plus" as const },
            { title: "Gaps", items: a.gaps, kind: "minus" as const },
          ].map(({ title, items, kind }) =>
            items.length ? (
              <div key={title}>
                <h3 className="font-display text-[15px] font-bold tracking-tight">{title}</h3>
                <ul className="mt-2 space-y-2">
                  {items.map((x, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[14px] leading-snug">
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${kind === "plus" ? "bg-forest text-white" : "bg-coral/20 text-[#b4391f]"}`} aria-hidden>
                        {kind === "plus" ? <Plus size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
                      </span>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </section>
      )}

      {a.questions.length > 0 && (
        <section className="mt-5 rounded-2xl bg-mint/40 p-4">
          <h3 className="font-display text-[15px] font-bold tracking-tight">Suggested interview questions</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-snug marker:font-bold marker:text-forest">
            {a.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </section>
      )}

      {(a.note || a.answers.length > 0) && (
        <section className="mt-5 space-y-3">
          {a.answers.map((x, i) => (
            <div key={i} className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
              <p className="text-[12.5px] font-semibold text-muted">{x.q}</p>
              <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap">{x.a}</p>
            </div>
          ))}
          {a.note && (
            <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
              <p className="text-[12.5px] font-semibold text-muted">Note from the candidate</p>
              <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap">{a.note}</p>
            </div>
          )}
        </section>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {a.hasCv && (
          <button
            type="button"
            onClick={openCv}
            disabled={cvBusy}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold ring-1 ring-line transition-colors hover:bg-mint/50 hover:ring-forest/30 disabled:opacity-60"
          >
            {cvBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Download size={15} aria-hidden />} Open CV
          </button>
        )}
        <MessageButton applicationId={a.id} />
      </div>

      <section className="mt-6 border-t border-line pt-5" aria-label="Decision">
        {a.status === "interview" && (a.interviewAt || a.interviewNote) && (
          <p className="mb-3 flex items-start gap-2 rounded-xl bg-mint/60 px-3 py-2 text-[13.5px] text-forest-deep">
            <CalendarCheck size={15} className="mt-0.5 shrink-0" aria-hidden />
            {a.interviewNote ?? "Interview invited."}
          </p>
        )}
        {mode === "interview" ? (
          <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
            <p className="font-display text-[15px] font-bold">Invite to interview</p>
            <label className="block text-[13.5px] font-semibold">
              Date and time <span className="font-normal text-muted">(optional)</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="mt-1.5 block h-11 w-full rounded-xl bg-paper px-3 text-[14px] ring-1 ring-line outline-none focus:ring-2 focus:ring-forest"
              />
            </label>
            <label className="block text-[13.5px] font-semibold">
              Message to the candidate <span className="font-normal text-muted">(optional)</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 900))}
                rows={3}
                placeholder="Where to meet or the video link, and who they will talk to."
                className="mt-1.5 block w-full resize-none rounded-xl bg-paper px-3 py-2.5 text-[14px] ring-1 ring-line outline-none focus:ring-2 focus:ring-forest"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMode("none")} className="h-10 rounded-full px-4 text-[13.5px] font-semibold text-muted hover:bg-ink/5">
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => act("interview", { interviewAt: when || undefined, message: message || undefined })}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-[13.5px] font-bold text-white hover:bg-forest-deep disabled:opacity-70"
              >
                {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} Send invite
              </button>
            </div>
          </div>
        ) : mode === "reject" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-coral/[0.07] px-4 py-3">
            <p className="text-[14px] font-medium text-[#9a3412]">Reject this applicant? They will be notified.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("none")} className="h-10 rounded-full px-4 text-[13.5px] font-semibold text-muted hover:bg-ink/5">
                Keep
              </button>
              <button type="button" disabled={pending} onClick={() => act("rejected")} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#c2410c] px-5 text-[13.5px] font-bold text-white disabled:opacity-70">
                {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} Reject
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending || a.status === "in_review"} onClick={() => act("in_review")} className="h-11 rounded-full bg-white px-5 text-[14px] font-semibold ring-1 ring-line transition-colors hover:bg-sun/20 disabled:opacity-50">
              Move to review
            </button>
            <button type="button" disabled={pending} onClick={() => setMode("interview")} className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-[14px] font-bold text-white transition-colors hover:bg-forest-deep disabled:opacity-60">
              <CalendarCheck size={15} aria-hidden /> {a.status === "interview" ? "Update interview" : "Invite to interview"}
            </button>
            <button type="button" disabled={pending || a.status === "hired"} onClick={() => act("hired")} className="h-11 rounded-full bg-mint px-5 text-[14px] font-bold text-forest-deep transition-colors hover:bg-mint/70 disabled:opacity-50">
              Hire
            </button>
            <button type="button" disabled={pending || a.status === "rejected"} onClick={() => setMode("reject")} className="h-11 rounded-full px-5 text-[14px] font-semibold text-[#b4391f] ring-1 ring-coral/30 transition-colors hover:bg-coral/10 disabled:opacity-50">
              Reject
            </button>
          </div>
        )}
      </section>

      <section className="mt-6" aria-label="Private notes">
        <h3 className="font-display text-[15px] font-bold tracking-tight">Private notes</h3>
        <div className="mt-2 flex gap-2">
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value.slice(0, 4000))}
            onKeyDown={(e) => e.key === "Enter" && noteText.trim() && saveNote()}
            placeholder="Only your team sees this"
            className="h-11 min-w-0 flex-1 rounded-xl bg-white px-3.5 text-[14px] ring-1 ring-line outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-forest"
          />
          <button type="button" onClick={saveNote} disabled={!noteText.trim()} className="h-11 rounded-xl bg-ink px-4 text-[13.5px] font-bold text-white disabled:opacity-40">
            Add
          </button>
        </div>
        {notes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl bg-white px-3.5 py-2.5 text-[13.5px] leading-snug ring-1 ring-line">
                {n.body}
                <span className="mt-1 block text-[11.5px] text-muted">{ago(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-[12px] leading-snug text-muted">
        The AI scores skills, experience and answers only. It never sees name, photo, phone, country, age or gender. It is a guide: you make the decision.
      </p>
    </div>
  );
}
