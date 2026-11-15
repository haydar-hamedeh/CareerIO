"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, Crosshair, ListChecks, PenLine, X } from "lucide-react";
import { AnimatedCheck, AnimatedCopy, useIconTap } from "@/components/animated-icons";
import { ScoreRing } from "@/components/ui/score-ring";
import { ease } from "@/lib/site";
import { scoreTone, verdict, type Issue, type Result } from "./types";

const barTone = { forest: "bg-forest", sun: "bg-sun", coral: "bg-coral" } as const;
const textTone = { forest: "text-forest-deep", sun: "text-[#8a5a00]", coral: "text-[#b4391f]" } as const;

function SectionHead({ icon, title, sub, aside }: { icon: React.ReactNode; title: string; sub?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint text-forest-deep">{icon}</span>
        <div>
          <h2 className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.02em]">{title}</h2>
          {sub && <p className="mt-0.5 text-[13.5px] text-muted">{sub}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}

const card = "rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-7";

export function Results({
  r,
  stale,
  onRegrade,
  canRegrade,
  afterHero,
}: {
  r: Result;
  stale: boolean;
  onRegrade: () => void;
  canRegrade: boolean;
  afterHero?: React.ReactNode;
}) {
  const v = verdict(r.score);
  const passed = r.checks.filter((c) => c.passed).length;
  const hasSplit = typeof r.fit === "number" && typeof r.quality === "number";

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="space-y-4">
      {stale && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sun/25 px-4 py-3 text-[13.5px] font-medium text-[#6b4700] ring-1 ring-sun/50">
          <span>You changed the CV or target since this grade.</span>
          <button
            type="button"
            onClick={onRegrade}
            disabled={!canRegrade}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-bold text-white transition-opacity disabled:opacity-50"
          >
            Grade again <ArrowRight size={13} aria-hidden />
          </button>
        </div>
      )}

      <section className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0b5f4a_0%,#0e7a5f_55%,#14906f_100%)] p-6 text-white shadow-lift sm:p-9">
        <div aria-hidden className="pointer-events-none absolute -top-28 -right-20 h-72 w-72 rounded-full bg-mint/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-sun/20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-7 sm:flex-row sm:gap-9">
          <div className="shrink-0 rounded-full bg-paper p-3 text-ink shadow-lift">
            <ScoreRing score={r.score} size={156} label="CV score" delay={0.1} />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[11.5px] font-bold tracking-[0.14em] text-mint uppercase">Your result</p>
            <h2 className="mt-1.5 font-display text-[clamp(1.6rem,3vw,2.1rem)] leading-[1.08] font-extrabold tracking-[-0.03em]">{v.label}</h2>
            <p className="mt-1.5 text-[15px] text-white/80">{v.note}</p>
            <p className="mt-3 text-[14px] text-white/70">
              Graded for <span className="font-semibold text-white">{r.targetLabel}</span>
            </p>
            {hasSplit && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <span className="rounded-full bg-white/12 px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-white/20 backdrop-blur">
                  CV quality <span className="ml-1 tabular-nums">{r.quality}</span>
                </span>
                <span className="rounded-full bg-white/12 px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-white/20 backdrop-blur">
                  Fit for role <span className="ml-1 tabular-nums">{r.fit}</span>
                </span>
              </div>
            )}
          </div>
        </div>
        {r.strengths?.length > 0 && (
          <ul className="relative mt-7 grid gap-2 border-t border-white/15 pt-5 sm:grid-cols-3">
            {r.strengths.slice(0, 3).map((s) => (
              <li key={s} className="flex items-start gap-2 text-[13.5px] leading-snug text-white/90">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-mint" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        )}
        <p className="relative mt-5 text-[12px] text-white/60">
          {r.cached ? "Saved result from " : "Graded "}
          {new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · AI estimate, not a guarantee
        </p>
      </section>

      {afterHero}

      <section className={card}>
        <SectionHead icon={<ListChecks size={18} aria-hidden />} title="Score breakdown" sub="Six weighted criteria add up to your score." />
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {r.rubric.map((c, i) => {
            const t = scoreTone(c.score);
            return (
              <li key={c.key} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-bold">
                    {c.label} <span className="font-medium text-muted">· {Math.round(c.weight * 100)}%</span>
                  </span>
                  <span className={`font-display text-lg font-extrabold tabular-nums ${textTone[t]}`}>{c.score}</span>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
                  <motion.div
                    className={`h-full origin-left rounded-full ${barTone[t]}`}
                    style={{ width: `${c.score}%` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.9, ease, delay: 0.15 + i * 0.07 }}
                  />
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{c.comment}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={card}>
        <SectionHead icon={<Crosshair size={18} aria-hidden />} title={`Fit for ${r.targetLabel}`} />
        <p className="mt-4 text-[15px] leading-relaxed text-ink/85">{r.roleFit.summary}</p>
        {(r.roleFit.strengths.length > 0 || r.roleFit.gaps.length > 0) && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Bullets title="What works" items={r.roleFit.strengths} tone="ok" />
            <Bullets title="Gaps to close" items={r.roleFit.gaps} tone="gap" />
          </div>
        )}
        {r.roleFit.nextSteps.length > 0 && (
          <div className="mt-3 rounded-2xl bg-ink p-5 text-white">
            <p className="text-[12px] font-bold tracking-[0.12em] text-mint uppercase">Do this next</p>
            <ol className="mt-3 space-y-2.5">
              {r.roleFit.nextSteps.map((s, i) => (
                <li key={s} className="flex gap-3 text-[14.5px] leading-snug text-white/90">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint text-[12px] font-extrabold text-forest-deep">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}
        {r.missingKeywords.length > 0 && (
          <div className="mt-5">
            <p className="text-[12px] font-bold tracking-[0.12em] text-muted uppercase">Missing from your CV</p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {r.missingKeywords.map((k) => (
                <li key={k} className="rounded-full bg-sun/35 px-3 py-1 text-[13px] font-semibold text-[#6b4700] ring-1 ring-sun/60">
                  {k}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {r.issues.length > 0 && (
        <section className={card}>
          <SectionHead
            icon={<PenLine size={18} aria-hidden />}
            title="Lines to improve"
            sub="Rewrites only rephrase what your CV already says. Fill in anything in [brackets] with your real details."
            aside={<span className="rounded-full bg-coral/12 px-3 py-1 text-[12.5px] font-bold text-[#b4391f] tabular-nums">{r.issues.length} to fix</span>}
          />
          <ul className="mt-5 space-y-4">
            {r.issues.map((i, idx) => (
              <IssueCard key={idx} issue={i} />
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <SectionHead
          icon={<CheckCircle2 size={18} aria-hidden />}
          title="Automatic checks"
          aside={
            <span className={`rounded-full px-3 py-1 text-[12.5px] font-bold tabular-nums ${passed === r.checks.length ? "bg-mint text-forest-deep" : "bg-sun/30 text-[#6b4700]"}`}>
              {passed} of {r.checks.length} passed
            </span>
          }
        />
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {r.checks.map((c) => (
            <li key={c.id} className={`flex gap-3 rounded-2xl p-3.5 ring-1 ${c.passed ? "bg-white ring-line" : "bg-coral/[0.06] ring-coral/25"}`}>
              {c.passed ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-forest" aria-hidden />
              ) : c.id === "injection" ? (
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#c2410c]" aria-hidden />
              ) : (
                <X size={18} className="mt-0.5 shrink-0 text-[#c2410c]" aria-hidden />
              )}
              <div>
                <p className="text-[14px] font-semibold">
                  {c.label}
                  <span className="sr-only">{c.passed ? " passed" : " needs attention"}</span>
                </p>
                <p className="text-[13px] leading-snug text-muted">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </motion.div>
  );
}

function Bullets({ title, items, tone }: { title: string; items: string[]; tone: "ok" | "gap" }) {
  if (!items.length) return null;
  return (
    <div className={`rounded-2xl p-4 ring-1 ${tone === "ok" ? "bg-mint/45 ring-forest/15" : "bg-sun/15 ring-sun/40"}`}>
      <p className={`text-[12px] font-bold tracking-[0.12em] uppercase ${tone === "ok" ? "text-forest-deep" : "text-[#8a5a00]"}`}>{title}</p>
      <ul className="mt-2.5 space-y-2 text-[14px] leading-snug text-ink/90">
        {items.map((s) => (
          <li key={s} className="flex gap-2.5">
            <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${tone === "ok" ? "bg-forest" : "bg-[#d99a00]"}`} aria-hidden />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const [copied, setCopied] = useState(false);
  const tap = useIconTap();
  return (
    <li className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-sand/60 px-4 py-2">
        <span className="text-[12px] font-bold tracking-[0.12em] text-muted uppercase">{issue.section}</span>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="bg-coral/[0.06] p-4 md:border-r md:border-line">
          <p className="text-[11.5px] font-bold tracking-wide text-[#b4391f] uppercase">Before</p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed">“{issue.quote}”</p>
          <p className="mt-2.5 text-[13px] leading-snug text-muted">{issue.problem}</p>
        </div>
        <div className="flex items-start gap-3 bg-mint/40 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold tracking-wide text-forest-deep uppercase">Suggested</p>
            <p className="mt-1.5 text-[14.5px] leading-relaxed font-medium">{issue.rewrite}</p>
          </div>
          <motion.button
            {...tap}
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(issue.rewrite).then(() => {
                setCopied(true);
                toast.success("Suggestion copied");
                setTimeout(() => setCopied(false), 1600);
              });
            }}
            aria-label="Copy suggestion"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-forest ring-1 ring-line transition-colors hover:bg-mint"
          >
            {copied ? <AnimatedCheck size={15} strokeWidth={3} /> : <AnimatedCopy size={15} />}
          </motion.button>
        </div>
      </div>
    </li>
  );
}
