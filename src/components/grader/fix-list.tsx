"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ListTodo } from "lucide-react";
import { ease } from "@/lib/site";
import type { Result } from "./types";

type Item = { id: string; title: string; why: string; gain: number | null; level: "must" | "high" | "medium" | "low"; anchor?: string };

const levelUi = {
  must: { label: "Must fix", chip: "bg-coral/20 text-[#b4391f]" },
  high: { label: "High impact", chip: "bg-forest text-white" },
  medium: { label: "Medium", chip: "bg-sun/35 text-[#6b4700]" },
  low: { label: "Quick win", chip: "bg-ink/[0.07] text-muted" },
} as const;

const levelOf = (gain: number): Item["level"] => (gain >= 8 ? "high" : gain >= 4 ? "medium" : "low");

/** Turn a grade into a short, ordered to-do list. Pure and instant: no extra AI call. */
export function buildFixList(r: Result): Item[] {
  const targeted = typeof r.fit === "number";
  const factor = targeted ? 0.45 : 1;
  const items: Item[] = [];

  if (r.checks.some((c) => c.id === "injection" && !c.passed)) {
    items.push({
      id: "injection",
      title: "Remove hidden instructions from your CV",
      why: "Text aimed at AI tools was found and ignored. Recruiters' software may flag your CV for it.",
      gain: null,
      level: "must",
    });
  }

  for (const c of r.rubric) {
    const gain = Math.round(c.weight * Math.max(0, 90 - c.score) * factor);
    if (gain >= 2) items.push({ id: `rubric-${c.key}`, title: `Improve ${c.label.toLowerCase()}`, why: c.comment, gain, level: levelOf(gain) });
  }

  if (targeted && (r.fit as number) < 80) {
    const gain = Math.round(0.55 * (85 - (r.fit as number)));
    const gaps = r.roleFit.gaps.slice(0, 2).join(" ");
    items.push({
      id: "fit",
      title: `Close the gaps for ${r.targetLabel}`,
      why: gaps || r.roleFit.nextSteps[0] || "Show more experience and skills that match this target.",
      gain,
      level: levelOf(gain),
    });
  }

  if (r.issues.length > 0) {
    const gain = Math.min(8, r.issues.length * 2);
    items.push({
      id: "lines",
      title: `Rewrite ${r.issues.length} weak ${r.issues.length === 1 ? "line" : "lines"}`,
      why: "Each one has an exact before and after below. Fill in the [brackets] with your real numbers.",
      gain,
      level: levelOf(gain),
      anchor: "lines-to-improve",
    });
  }

  if (r.missingKeywords.length > 0) {
    const gain = Math.min(6, Math.round(r.missingKeywords.length * 1.5));
    items.push({
      id: "keywords",
      title: `Add ${r.missingKeywords.length} missing ${r.missingKeywords.length === 1 ? "keyword" : "keywords"} (only if true)`,
      why: r.missingKeywords.slice(0, 6).join(", "),
      gain,
      level: levelOf(gain),
    });
  }

  for (const c of r.checks) {
    if (c.passed || c.id === "injection") continue;
    items.push({ id: `check-${c.id}`, title: c.label, why: c.detail, gain: 1, level: "low" });
  }

  const rank = (i: Item) => (i.level === "must" ? 1000 : (i.gain ?? 0));
  return items.sort((a, b) => rank(b) - rank(a)).slice(0, 5);
}

export function FixList({ r }: { r: Result }) {
  const items = useMemo(() => buildFixList(r), [r]);
  const [done, setDone] = useState<Set<string>>(new Set());
  if (items.length === 0) return null;

  const toggle = (id: string) =>
    setDone((d) => {
      const next = new Set(d);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const total = items.reduce((s, i) => s + (i.gain ?? 0), 0);
  const left = items.filter((i) => !done.has(i.id)).reduce((s, i) => s + (i.gain ?? 0), 0);

  return (
    <section className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint text-forest-deep">
            <ListTodo size={18} aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.02em]">Fix these first</h2>
            <p className="mt-0.5 text-[13.5px] text-muted">Ordered by how many points each could add. Tick them off as you edit your CV.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] font-bold tabular-nums">
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-line">
            {done.size} of {items.length} done
          </span>
          {total > 0 && <span className="rounded-full bg-mint px-3 py-1 text-forest-deep">Up to +{left} pts left</span>}
        </div>
      </div>

      <ol className="mt-5 space-y-2.5">
        {items.map((it, i) => {
          const isDone = done.has(it.id);
          const ui = levelUi[it.level];
          return (
            <motion.li
              key={it.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease, delay: i * 0.05 }}
              className={`flex items-start gap-3.5 rounded-2xl p-4 ring-1 transition-colors ${isDone ? "bg-mint/30 ring-forest/20" : "bg-white ring-line"}`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                aria-label={`Mark "${it.title}" as done`}
                onClick={() => toggle(it.id)}
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ring-1 transition-colors ${
                  isDone ? "bg-forest text-white ring-forest" : "bg-white text-transparent ring-ink/25 hover:ring-forest"
                }`}
              >
                <AnimatePresence initial={false}>
                  {isDone && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 26 }}>
                      <Check size={14} strokeWidth={3} aria-hidden />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-[14.5px] font-bold ${isDone ? "text-muted line-through" : ""}`}>{it.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ui.chip}`}>{ui.label}</span>
                  {it.gain !== null && it.gain >= 2 && <span className="text-[12px] font-bold text-forest-deep tabular-nums">+{it.gain} pts</span>}
                </div>
                <p className="mt-1 text-[13.5px] leading-snug text-muted">{it.why}</p>
                {it.anchor && (
                  <a href={`#${it.anchor}`} className="mt-1.5 inline-block text-[13px] font-semibold text-forest hover:underline">
                    See the rewrites
                  </a>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
