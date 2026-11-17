"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronUp, Lightbulb, Loader2, Minus, Plus, Sparkles } from "lucide-react";
import { ease } from "@/lib/site";

type Chance = {
  score: number;
  verdict: string;
  reasons: { kind: "plus" | "minus"; text: string }[];
  tip: string;
  flagged: boolean;
  cached: boolean;
  usedCv: boolean;
  match?: number;
  level?: "above" | "below" | null;
};

const tone = (s: number) =>
  s >= 7
    ? { ring: "var(--forest)", text: "text-forest-deep", chip: "bg-mint text-forest-deep", label: "Strong chance" }
    : s >= 4
      ? { ring: "#d99a1e", text: "text-[#8a5a00]", chip: "bg-sun/35 text-[#6b4700]", label: "Fair chance" }
      : { ring: "var(--coral)", text: "text-[#b4391f]", chip: "bg-coral/15 text-[#b4391f]", label: "Long shot" };

export function ChanceCard({ jobId }: { jobId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [data, setData] = useState<Chance | null>(null);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(true);

  async function check() {
    setError(undefined);
    setState("loading");
    try {
      const res = await fetch("/api/chance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId }), signal: AbortSignal.timeout(60_000) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't estimate that right now.");
      setData(body);
      setOpen(true);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't estimate that right now.");
      setState("idle");
    }
  }

  const t = data ? tone(data.score) : null;
  const r = 26;
  const c = 2 * Math.PI * r;

  return (
    <div className="rounded-2xl border border-dashed border-forest/30 bg-mint/25 p-4" aria-live="polite">
      {state !== "done" || !data || !t ? (
        <>
          <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.1em] text-forest-deep uppercase">
            <Sparkles size={13} aria-hidden /> Optional · AI estimate
          </p>
          <p className="mt-1.5 text-[13.5px] leading-snug text-ink/80">See your chance of landing this job, out of 10, and why. Only you can see it.</p>
          <button
            type="button"
            onClick={check}
            disabled={state === "loading"}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-bold text-forest-deep ring-1 ring-forest/30 transition-colors hover:bg-mint disabled:opacity-70"
          >
            {state === "loading" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
            {state === "loading" ? "Reading the job and your profile…" : "Check my chances"}
          </button>
          {error && <p className="mt-2 text-[13px] text-[#9a3412]">{error}</p>}
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
          <div className="flex items-center gap-3.5">
            <div className="relative grid h-16 w-16 shrink-0 place-items-center">
              <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90" aria-hidden>
                <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
                <motion.circle
                  cx="32"
                  cy="32"
                  r={r}
                  fill="none"
                  stroke={t.ring}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  initial={{ strokeDashoffset: c }}
                  animate={{ strokeDashoffset: c * (1 - data.score / 10) }}
                  transition={{ duration: 1, ease, delay: 0.1 }}
                />
              </svg>
              <span className="absolute font-display text-[1.15rem] font-extrabold tabular-nums">
                {data.score}
                <span className="text-[11px] font-bold text-muted">/10</span>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${t.chip}`}>{t.label}</span>
              <p className="mt-1 text-[13.5px] leading-snug font-medium">{data.verdict}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-ink"
          >
            {open ? "Hide details" : "Show why"}
            <ChevronUp size={14} className={`transition-transform ${open ? "" : "rotate-180"}`} aria-hidden />
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
                <ul className="mt-2 space-y-2">
                  {data.reasons.map((x, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${x.kind === "plus" ? "bg-forest text-white" : "bg-coral/20 text-[#b4391f]"}`}
                        aria-hidden
                      >
                        {x.kind === "plus" ? <Plus size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
                      </span>
                      <span>
                        <span className="sr-only">{x.kind === "plus" ? "Helps: " : "Hurts: "}</span>
                        {x.text}
                      </span>
                    </li>
                  ))}
                </ul>
                {data.tip && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-[13px] leading-snug ring-1 ring-line">
                    <Lightbulb size={15} className="mt-0.5 shrink-0 text-[#d99a1e]" aria-hidden />
                    <span>{data.tip}</span>
                  </p>
                )}
                {data.flagged && (
                  <p className="mt-2 flex items-start gap-2 text-[12.5px] text-[#9a3412]">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                    Some text looked like an attempt to influence the score. It was ignored.
                  </p>
                )}
                {typeof data.match === "number" && (Math.abs(data.match - data.score * 10) >= 25 || data.level) && (
                  <p className="mt-3 rounded-xl bg-white/70 px-3 py-2.5 text-[12.5px] leading-snug text-ink/80 ring-1 ring-line">
                    <span className="font-bold">Why not the same as your {data.match}% match?</span> The match is about how well your skills and profile fit. This estimate is about getting hired, so it also weighs{" "}
                    {data.level === "below"
                      ? "that this role is more junior than your level (employers often hesitate), "
                      : data.level === "above"
                        ? "that this role is more senior than your level, "
                        : ""}
                    core skills you&apos;re missing, and competition.
                  </p>
                )}
                <p className="mt-3 text-[11.5px] leading-snug text-muted">
                  AI estimate, not a guarantee. {data.usedCv ? "Based on your profile and main CV." : "Based on your profile. Grade your CV for a sharper estimate."} Only you see this.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
