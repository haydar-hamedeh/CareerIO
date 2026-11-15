"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

const stages = ["Applied", "In review", "Interview", "Hired"] as const;

const applicants = [
  { id: "C", score: 74, why: "Strong React. Less testing experience." },
  { id: "A", score: 91, why: "8 of 9 skills, 3 years in a similar role." },
  { id: "D", score: 62, why: "Good fundamentals. Junior for this level." },
  { id: "B", score: 85, why: "All core skills. Prefers remote, job is hybrid." },
];

const steps = [
  ["Post a job", "Write it yourself or let the AI draft it. It pulls out the required skills; you approve every line."],
  ["Get ranked applicants", "Applicants are sorted by match, each with a short explanation and their CV one click away."],
  ["You decide", "Move people through your pipeline, add notes, and make the call. The ranking only assists."],
];

export function Employers() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-25% 0px" });
  const reduce = useReducedMotion();
  const [sorted, setSorted] = useState(false);
  const [status, setStatus] = useState<Record<string, number>>({ A: 2, B: 1, C: 0, D: 0 });

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setSorted(true), reduce ? 0 : 900);
    return () => clearTimeout(t);
  }, [inView, reduce]);

  const list = sorted ? [...applicants].sort((a, b) => b.score - a.score) : applicants;

  return (
    <section id="employers" className="grain relative w-full overflow-hidden bg-ink py-24 text-sand sm:py-32">
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20">
        <div>
          <Reveal>
            <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-sun">
              <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden />
              For employers
            </p>
            <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.06] font-extrabold tracking-[-0.03em]">
              Spend your time on the right people.
            </h2>
          </Reveal>
          <ol className="mt-10 space-y-7">
            {steps.map(([t, b], i) => (
              <Reveal key={t} delay={0.08 * i}>
                <li className="flex gap-5">
                  <span className="font-display text-sm font-bold text-sun tabular-nums">0{i + 1}</span>
                  <div>
                    <h3 className="font-display text-xl font-bold">{t}</h3>
                    <p className="mt-1.5 max-w-md leading-relaxed text-sand/65">{b}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={0.3} className="mt-10">
            <Button href="/signup?role=employer" variant="light" arrow>
              Post a job
            </Button>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div ref={ref} className="rounded-[28px] bg-white/[0.06] p-2 ring-1 ring-white/10">
            <div className="rounded-[22px] bg-paper p-5 text-ink sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-[16px] font-bold">Frontend Developer</p>
                  <p className="text-[13px] text-muted">4 applicants · ranked by match</p>
                </div>
                <span className="rounded-full bg-mint px-3 py-1 text-[12px] font-semibold text-forest-deep">Open</span>
              </div>

              <ul className="mt-5 space-y-2.5">
                {list.map((a, i) => (
                  <motion.li
                    key={a.id}
                    layout
                    transition={{ type: "spring", stiffness: 220, damping: 26 }}
                    className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-line sm:gap-4 sm:p-3.5"
                  >
                    <span className="w-5 text-center font-display text-[13px] font-bold text-muted tabular-nums">
                      {sorted ? i + 1 : "–"}
                    </span>
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand font-display text-[14px] font-extrabold"
                    >
                      {a.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold">Applicant {a.id}</p>
                      <p className="truncate text-[12px] text-muted">{a.why}</p>
                    </div>
                    <span
                      className={`hidden rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums sm:inline ${
                        a.score >= 80 ? "bg-forest text-white" : "bg-sand text-ink"
                      }`}
                    >
                      {a.score}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setStatus((s) => ({ ...s, [a.id]: (s[a.id] + 1) % stages.length }))}
                      className="w-[84px] shrink-0 rounded-full bg-ink/5 px-2 py-1.5 text-[12px] font-semibold transition-colors hover:bg-ink/10"
                      aria-label={`Applicant ${a.id} status: ${stages[status[a.id]]}. Click to move to next stage.`}
                    >
                      <motion.span key={status[a.id]} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="block">
                        {stages[status[a.id]]}
                      </motion.span>
                    </button>
                  </motion.li>
                ))}
              </ul>

              <p className="mt-5 flex items-center gap-2.5 rounded-2xl bg-sun/25 px-4 py-3 text-[13px] font-medium">
                <UserCheck size={16} className="shrink-0" aria-hidden />
                AI ranks to assist. A human makes every decision.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
