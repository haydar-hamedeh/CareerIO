"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Bookmark, Loader2, Search, X } from "lucide-react";
import { JobCard, type FeedJob } from "./job-card";
import { seniorities, seniorityLabel, workModeLabel, workModes } from "@/lib/onboarding/schema";
import { ease } from "@/lib/site";

type Filters = { q: string; mode: string; level: string; field: string; saved: boolean; sort: "match" | "recent" };
type AiScore = { score: number; reason: string };


const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length > 1);

function keywordScore(job: FeedJob, terms: string[]) {
  if (!terms.length) return 0;
  const title = job.title.toLowerCase();
  const skills = job.skills.join(" ").toLowerCase();
  const meta = `${job.field} ${job.company}`.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (title.includes(t)) score += 3;
    else if (skills.includes(t)) score += 2;
    else if (meta.includes(t)) score += 1.5;
    else if (job.searchText.includes(t)) score += 1;
  }
  return score;
}

export function FeedClient({
  jobs,
  fields,
  isCandidate,
  initial,
  topGaps,
}: {
  jobs: FeedJob[];
  fields: string[];
  isCandidate: boolean;
  initial: Filters;
  topGaps: [string, number][];
}) {
  const [f, setF] = useState<Filters>(initial);
  const [semantic, setSemantic] = useState<{ q: string; hits: Map<string, { rank: number; reason: string }> } | null>(null);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "error">("idle");
  const [searchError, setSearchError] = useState<string>();
  const [aiScores, setAiScores] = useState<Record<string, AiScore>>({});
  const [aiState, setAiState] = useState<"idle" | "loading" | "done" | "error">(isCandidate ? "loading" : "idle");
  const [aiNote, setAiNote] = useState<string>();
  const abort = useRef<AbortController | null>(null);

  const set = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.mode) p.set("mode", f.mode);
    if (f.level) p.set("level", f.level);
    if (f.field) p.set("field", f.field);
    if (f.saved) p.set("saved", "1");
    if (f.sort === "recent") p.set("sort", "recent");
    const s = p.toString();
    window.history.replaceState(null, "", s ? `/feed?${s}` : "/feed");
  }, [f]);

  useEffect(() => {
    const q = f.q.trim();
    if (q.length < 3) return;
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setSearchState("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "AI search failed");
        const results = body.results as { id: string; reason: string }[];
        setSemantic({ q, hits: new Map(results.map((r, i) => [r.id, { rank: 1 - i / Math.max(results.length, 1), reason: r.reason }])) });
        setSearchState("idle");
        setSearchError(undefined);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setSearchState("error");
        setSearchError(e instanceof Error ? e.message : "AI search failed");
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [f.q]);

  useEffect(() => {
    if (!isCandidate) return;
    let alive = true;
    fetch("/api/match", { method: "POST" })
      .then((r) => r.json())
      .then((body: { ai?: Record<string, AiScore>; error?: string }) => {
        if (!alive) return;
        setAiScores(body.ai ?? {});
        setAiNote(body.error);
        setAiState(body.error && !Object.keys(body.ai ?? {}).length ? "error" : "done");
      })
      .catch(() => alive && setAiState("error"));
    return () => {
      alive = false;
    };
  }, [isCandidate]);

  const q = f.q.trim();
  const hits = semantic && semantic.q === q ? semantic.hits : null;

  const list = useMemo(() => {
    const terms = tokens(q);
    const base = jobs
      .filter((j) => !f.mode || j.rawMode === f.mode)
      .filter((j) => !f.level || j.rawLevel === f.level)
      .filter((j) => !f.field || j.field === f.field)
      .filter((j) => !f.saved || j.saved)
      .map((j) => ({ ...j, ai: aiScores[j.id] ?? null, foundBy: null as FeedJob["foundBy"] }));

    if (terms.length) {
      return base
        .map((j) => {
          const kw = keywordScore(j, terms);
          const ai = hits?.get(j.id);
          const rel = (ai ? 0.6 + 0.4 * ai.rank : 0) + Math.min(kw, 6) * 0.05;
          return { j: { ...j, foundBy: ai && kw === 0 ? ("ai" as const) : null, aiWhy: ai?.reason ?? null }, kw, rel, ai };
        })
        .filter((x) => x.kw > 0 || x.ai)
        .sort((a, b) => b.rel - a.rel)
        .map((x) => x.j);
    }

    const score = (j: FeedJob) => j.ai?.score ?? j.pct ?? 0;
    return [...base].sort((a, b) =>
      f.sort === "recent" || !isCandidate ? b.publishedAt - a.publishedAt : score(b) - score(a) || b.publishedAt - a.publishedAt,
    );
  }, [jobs, f.mode, f.level, f.field, f.saved, f.sort, q, hits, aiScores, isCandidate]);

  const aiOnly = list.filter((j) => j.foundBy === "ai").length;
  const active = Boolean(f.mode || f.level || f.field || f.saved || q);
  const savedCount = jobs.filter((j) => j.saved).length;

  return (
    <>
      <section className="min-w-0 space-y-4">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={f.q}
            onChange={(e) => {
              set({ q: e.target.value });
              if (e.target.value.trim().length < 3) {
                abort.current?.abort();
                setSearchState("idle");
              }
            }}
            placeholder="Search jobs — try “food”, “numbers”, “kids” or “React”"
            aria-label="Search jobs"
            className="h-12 w-full rounded-full bg-paper pr-12 pl-11 text-[15px] shadow-soft ring-1 ring-line outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-forest"
          />
          {f.q && (
            <button
              type="button"
              onClick={() => set({ q: "" })}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:hidden">
          {workModes.map((m) => (
            <Pill key={m} active={f.mode === m} onClick={() => set({ mode: f.mode === m ? "" : m })}>
              {workModeLabel[m]}
            </Pill>
          ))}
          <Pill active={f.saved} onClick={() => set({ saved: !f.saved })}>
            Saved
          </Pill>
          {fields.map((x) => (
            <Pill key={x} active={f.field === x} onClick={() => set({ field: f.field === x ? "" : x })}>
              {x}
            </Pill>
          ))}
        </div>

        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-[14px] text-muted" aria-live="polite">
            <span className="font-semibold text-ink">{list.length}</span> {list.length === 1 ? "job" : "jobs"}
            {q
              ? " · most relevant first"
              : isCandidate && f.sort === "match"
                ? " · best match first"
                : " · newest first"}
          </p>
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
              {q.length >= 3 && searchState === "loading" && (
                <Status key="l">
                  <Loader2 size={13} className="animate-spin" aria-hidden /> Searching by meaning…
                </Status>
              )}
              {q.length >= 3 && searchState === "idle" && hits && aiOnly > 0 && (
                <Status key="d" tone="ok">
                  AI added {aiOnly} related {aiOnly === 1 ? "job" : "jobs"}
                </Status>
              )}
              {q.length >= 3 && searchState === "error" && (
                <Status key="e" tone="warn">
                  {searchError}
                </Status>
              )}
              {!q && isCandidate && aiState === "loading" && (
                <Status key="m">
                  <Loader2 size={13} className="animate-spin" aria-hidden /> AI is scoring your top matches…
                </Status>
              )}
              {!q && isCandidate && aiState !== "loading" && aiNote && (
                <Status key="n" tone="warn">
                  {aiNote}
                </Status>
              )}
            </AnimatePresence>
            {isCandidate && !q && (
              <button
                type="button"
                onClick={() => set({ sort: f.sort === "match" ? "recent" : "match" })}
                className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-forest hover:bg-mint/60"
              >
                {f.sort === "match" ? "Sort by newest" : "Sort by match"}
              </button>
            )}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-ink/15 px-6 py-14 text-center">
            <p className="font-display text-lg font-bold">
              {f.saved ? "No saved jobs yet" : searchState === "loading" ? "Looking for related jobs…" : "No jobs match these filters"}
            </p>
            <p className="mt-1 text-muted">
              {f.saved ? "Tap Save on any job to keep it here." : "Try removing a filter or searching for something broader."}
            </p>
            {active && (
              <button
                type="button"
                onClick={() => setF({ ...initial, q: "", mode: "", level: "", field: "", saved: false })}
                className="mt-5 inline-flex h-11 items-center rounded-full bg-forest px-5 font-semibold text-white"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <LayoutGroup>
            {list.map((job, i) => (
              <motion.div key={job.id} layout="position" transition={{ duration: 0.45, ease }}>
                <JobCard job={job} index={i} canGrade={isCandidate} />
              </motion.div>
            ))}
          </LayoutGroup>
        )}
      </section>

      <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:self-start">
        <section className="rounded-[24px] bg-paper p-5 ring-1 ring-line">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold">Filters</h2>
            {active && (
              <button
                type="button"
                onClick={() => setF({ ...f, q: "", mode: "", level: "", field: "", saved: false })}
                className="text-[13px] font-semibold text-forest hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <FilterGroup title="Work mode">
            {workModes.map((m) => (
              <Pill key={m} active={f.mode === m} onClick={() => set({ mode: f.mode === m ? "" : m })}>
                {workModeLabel[m]}
              </Pill>
            ))}
          </FilterGroup>
          <FilterGroup title="Level">
            {seniorities.map((l) => (
              <Pill key={l} active={f.level === l} onClick={() => set({ level: f.level === l ? "" : l })}>
                {seniorityLabel[l]}
              </Pill>
            ))}
          </FilterGroup>
          <FilterGroup title="Field">
            {fields.map((x) => (
              <Pill key={x} active={f.field === x} onClick={() => set({ field: f.field === x ? "" : x })}>
                {x}
              </Pill>
            ))}
          </FilterGroup>
          <button
            type="button"
            onClick={() => set({ saved: !f.saved })}
            aria-pressed={f.saved}
            className={`mt-5 flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-[14px] font-semibold transition-colors ${
              f.saved ? "bg-forest text-white" : "bg-white ring-1 ring-line hover:ring-ink/25"
            }`}
          >
            <Bookmark size={15} aria-hidden /> Saved jobs ({savedCount})
          </button>
        </section>

        {isCandidate && topGaps.length > 0 && (
          <section className="rounded-[24px] bg-paper p-5 ring-1 ring-line">
            <h2 className="font-display text-[15px] font-bold">Skills to learn next</h2>
            <p className="mt-1 text-[13px] leading-snug text-muted">Most requested in jobs you partly match.</p>
            <ul className="mt-4 space-y-2.5">
              {topGaps.map(([skill, n]) => (
                <li key={skill} className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="font-medium">{skill}</span>
                  <span className="rounded-full bg-sun/30 px-2 py-0.5 text-[12px] font-bold text-[#8a5a00]">
                    {n} {n === 1 ? "job" : "jobs"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </>
  );
}

function Status({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "ok" | "warn" }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold ${
        tone === "ok" ? "bg-mint text-forest-deep" : tone === "warn" ? "bg-sun/30 text-[#8a5a00]" : "bg-ink/5 text-muted"
      }`}
    >
      {children}
    </motion.span>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-[12.5px] font-semibold text-muted">{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-200 ${
        active ? "bg-forest text-white" : "bg-white text-ink/80 ring-1 ring-line hover:ring-ink/25"
      }`}
    >
      {children}
    </button>
  );
}
