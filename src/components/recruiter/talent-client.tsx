"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog } from "radix-ui";
import { Check, Loader2, MapPin, Search, SearchX, Send, Users, X } from "lucide-react";
import { toast } from "sonner";
import { MatchRing } from "@/components/feed/job-card";
import { inviteCandidate, searchTalent } from "@/app/recruiter/talent/actions";
import { levelShort } from "@/lib/jobs/format";
import { normSkill } from "@/lib/jobs/match";
import type { TalentDto, TalentJob } from "@/lib/recruiter/talent-types";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

export function TalentClient({ jobs, initialJobId, initial }: { jobs: TalentJob[]; initialJobId: string | null; initial: TalentDto[] }) {
  const [query, setQuery] = useState("");
  const [jobId, setJobId] = useState(initialJobId);
  const [results, setResults] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inviting, setInviting] = useState<TalentDto | null>(null);
  const first = useRef(true);

  // Debounced search; the first render already has results from the server.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchTalent({ q: query, jobId });
        if (live) setResults(rows);
      } finally {
        if (live) setLoading(false);
      }
    }, 320);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, jobId]);

  const jobTitle = jobs.find((j) => j.id === jobId)?.title;

  return (
    <main className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 lg:py-10">
      <h1 className="font-display text-[clamp(1.8rem,3.6vw,2.4rem)] leading-tight font-extrabold tracking-[-0.03em]">Find talent</h1>
      <p className="mt-2 text-muted">People who let companies find them. Search by skill, role or place, then invite them to apply.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <motion.div
          animate={{ boxShadow: focused ? "0 10px 30px -12px rgba(14,92,66,0.35)" : "0 1px 2px rgba(0,0,0,0.04)" }}
          transition={{ duration: 0.25 }}
          className={`flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-paper px-4 ring-1 ${focused ? "ring-2 ring-forest" : "ring-line"}`}
        >
          <motion.span animate={{ scale: focused ? 1.12 : 1, rotate: focused ? -8 : 0 }} transition={{ type: "spring", stiffness: 380, damping: 18 }} className={focused ? "text-forest" : "text-muted"}>
            {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Search size={18} aria-hidden />}
          </motion.span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="react beirut · data analyst · senior"
            aria-label="Search talent"
            className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          <AnimatePresence>
            {query && (
              <motion.button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                initial={{ opacity: 0, scale: 0.4, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.4, rotate: 90 }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/5 text-muted hover:bg-ink/10 hover:text-ink"
              >
                <X size={14} aria-hidden />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
        {jobs.length > 0 && (
          <label className="inline-flex h-12 items-center gap-2 rounded-full bg-paper px-4 text-[13px] font-medium text-muted ring-1 ring-line">
            Fit to
            <select value={jobId ?? ""} onChange={(e) => setJobId(e.target.value || null)} className="max-w-[200px] truncate bg-transparent text-[13.5px] font-semibold text-ink outline-none">
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {jobs.length === 0 && (
        <p className="mt-4 rounded-2xl bg-sun/25 px-4 py-3 text-[13.5px] leading-snug text-[#6b4700]">
          You have no open jobs yet. <Link href="/recruiter/jobs/new" className="font-bold underline">Post one</Link> to rank people by fit and invite them.
        </p>
      )}

      <p className="mt-5 text-[13px] font-medium text-muted" aria-live="polite">
        {results.length} {results.length === 1 ? "person" : "people"}
        {jobTitle ? <> ranked by fit to <span className="font-semibold text-ink">{jobTitle}</span></> : null}
      </p>

      <ul className="mt-3 space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
          {results.map((p) => (
            <TalentCard key={p.id} p={p} canInvite={Boolean(jobId)} onInvite={() => setInviting(p)} />
          ))}
        </AnimatePresence>
        {results.length === 0 && !loading && (
          <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] bg-paper p-8 text-center ring-1 ring-line">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-mint text-forest">
              <SearchX size={20} aria-hidden />
            </span>
            <p className="mt-3 text-[14.5px] font-semibold">{query ? `No one matches “${query.trim()}”` : "No one is searchable yet"}</p>
            <p className="mt-1 text-[13.5px] text-muted">Try fewer words, or a skill like “react” or a city.</p>
          </motion.li>
        )}
      </ul>

      <InviteDialog
        person={inviting}
        jobs={jobs}
        defaultJobId={jobId}
        onClose={() => setInviting(null)}
        onSent={(personId, forJobId) => {
          if (forJobId === jobId) setResults((r) => r.map((x) => (x.id === personId ? { ...x, invited: true } : x)));
        }}
      />
    </main>
  );
}

function TalentCard({ p, canInvite, onInvite }: { p: TalentDto; canInvite: boolean; onInvite: () => void }) {
  const matched = new Set(p.matched.map(normSkill));
  const shown = [...p.skills].sort((a, b) => Number(matched.has(normSkill(b))) - Number(matched.has(normSkill(a)))).slice(0, 8);
  const meta = [p.level ? levelShort[p.level] ?? p.level : null, p.years !== null ? `${p.years} yrs` : null].filter(Boolean).join(" · ");
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[24px] bg-paper p-4 shadow-soft ring-1 ring-line sm:p-5"
    >
      <div className="flex items-start gap-4">
        <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-full bg-mint font-display text-[14px] font-bold text-forest-deep sm:grid">{initials(p.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[1.02rem] font-bold tracking-tight">{p.name}</p>
          <p className="truncate text-[13.5px] text-muted">{[p.headline, meta].filter(Boolean).join(" · ") || "No headline"}</p>
          {p.location && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-muted">
              <MapPin size={12} aria-hidden /> {p.location}
            </p>
          )}
        </div>
        {p.score !== null && <MatchRing pct={p.score} />}
      </div>
      {p.summary && <p className="mt-3 line-clamp-2 text-[13.5px] leading-snug text-ink/80">{p.summary}</p>}
      {shown.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shown.map((s) => (
            <span key={s} className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${matched.has(normSkill(s)) ? "bg-mint text-forest-deep" : "bg-white text-ink/70 ring-1 ring-line"}`}>
              {s}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        {p.applied ? (
          <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-sand px-4 text-[13.5px] font-semibold text-muted">
            <Check size={14} aria-hidden /> Already applied
          </span>
        ) : p.invited ? (
          <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-mint px-4 text-[13.5px] font-semibold text-forest-deep">
            <Check size={14} aria-hidden /> Invited
          </span>
        ) : (
          <button
            type="button"
            onClick={onInvite}
            disabled={!canInvite}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-forest-deep disabled:opacity-50"
          >
            <Send size={14} aria-hidden /> Invite to apply
          </button>
        )}
      </div>
    </motion.li>
  );
}

function InviteDialog({ person, jobs, defaultJobId, onClose, onSent }: { person: TalentDto | null; jobs: TalentJob[]; defaultJobId: string | null; onClose: () => void; onSent: (personId: string, jobId: string) => void }) {
  return (
    <Dialog.Root open={Boolean(person)} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-paper p-6 shadow-lift ring-1 ring-line outline-none sm:p-7">
          {person && <InviteForm key={person.id} person={person} jobs={jobs} defaultJobId={defaultJobId} onDone={(jobId) => { onSent(person.id, jobId); onClose(); }} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InviteForm({ person, jobs, defaultJobId, onDone }: { person: TalentDto; jobs: TalentJob[]; defaultJobId: string | null; onDone: (jobId: string) => void }) {
  const [jobId, setJobId] = useState(defaultJobId ?? jobs[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const res = await inviteCandidate({ jobId, candidateId: person.id, message });
      if (res.error) return void toast.error(res.error);
      toast.success(`Invitation sent to ${person.name}.`);
      onDone(jobId);
    });

  return (
    <>
      <Dialog.Title className="font-display text-[1.25rem] font-extrabold tracking-tight">Invite {person.name}</Dialog.Title>
      <Dialog.Description className="mt-1.5 text-[14px] leading-snug text-muted">
        They get a notification and can open the job. Their contact details stay private until they apply.
      </Dialog.Description>
      <label className="mt-5 block text-[14px] font-semibold">
        Job
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="mt-2 h-12 w-full rounded-2xl bg-white px-4 text-[15px] font-normal ring-1 ring-line outline-none focus:ring-2 focus:ring-forest">
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-[14px] font-semibold">
        Message (optional)
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="Why you think they'd be a great fit."
          className="mt-2 w-full resize-none rounded-2xl bg-white px-4 py-3 text-[14.5px] font-normal ring-1 ring-line outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-forest"
        />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Dialog.Close className="h-11 rounded-full px-5 text-[14px] font-semibold text-muted hover:bg-ink/5">Cancel</Dialog.Close>
        <button type="button" onClick={send} disabled={pending || !jobId} className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-6 text-[14px] font-bold text-white hover:bg-forest-deep disabled:opacity-60">
          {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Users size={14} aria-hidden />} Send invitation
        </button>
      </div>
    </>
  );
}
