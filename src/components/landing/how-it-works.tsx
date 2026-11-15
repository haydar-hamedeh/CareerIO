"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { Check, FileText, UploadCloud } from "lucide-react";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { ease } from "@/lib/site";

const steps = [
  {
    n: "01",
    title: "Upload your CV",
    body: "Drop a PDF or Word file. The AI reads it and fills in your profile. You review and edit every field before anything is saved.",
    Visual: UploadVisual,
  },
  {
    n: "02",
    title: "Get an honest grade",
    body: "A score out of 100 on a visible rubric: clarity, impact, skills, ATS readability, language and structure. Every weak spot comes with a fix.",
    Visual: GradeVisual,
  },
  {
    n: "03",
    title: "See jobs that fit",
    body: "Jobs are ranked by how well they match your skills, experience and preferences, with a one-line reason so you know why.",
    Visual: MatchVisual,
  },
];

export function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 70%", "end 60%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <section id="how" className="relative w-full bg-paper py-24 sm:py-32">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.06] font-extrabold tracking-[-0.03em]">
            Three steps from “I hope this is okay” to knowing exactly what to fix.
          </h2>
        </Reveal>

        <div className="relative mt-16 sm:mt-20">
          <div aria-hidden className="absolute top-2 bottom-2 left-[19px] w-[2px] rounded-full bg-line md:left-1/2 md:-translate-x-1/2">
            <motion.div style={{ scaleY: progress }} className="h-full w-full origin-top rounded-full bg-forest" />
          </div>

          <ol ref={listRef} className="relative space-y-16 sm:space-y-24">
          {steps.map(({ n, title, body, Visual }, i) => (
            <li key={n} className="relative grid items-center gap-8 pl-14 md:grid-cols-2 md:gap-20 md:pl-0">
              <span className="absolute top-0 left-0 grid h-10 w-10 place-items-center rounded-full bg-ink font-display text-[13px] font-bold text-sand ring-8 ring-paper md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
                {n}
              </span>
              <Reveal className={i % 2 === 1 ? "md:order-2" : ""}>
                <h3 className="font-display text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">{title}</h3>
                <p className="mt-3 max-w-md text-[1.05rem] leading-relaxed text-muted">{body}</p>
              </Reveal>
              <Reveal delay={0.1} className={i % 2 === 1 ? "md:order-1" : ""}>
                <Visual />
              </Reveal>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function useLoop(length: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = setInterval(() => setTick((t) => (t + 1) % length), ms);
    return () => clearInterval(id);
  }, [inView, reduce, length, ms]);
  return { ref, tick: reduce ? length - 1 : tick };
}

function Panel({ children, innerRef }: { children: React.ReactNode; innerRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={innerRef} className="rounded-[28px] bg-sand p-2 ring-1 ring-line">
      <div className="relative h-[260px] overflow-hidden rounded-[22px] bg-white p-6 shadow-soft">{children}</div>
    </div>
  );
}

function UploadVisual() {
  const { ref, tick } = useLoop(4, 1300);
  const done = tick >= 2;
  return (
    <Panel innerRef={ref}>
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-forest/25 bg-mint/30">
        <motion.div animate={{ y: tick === 0 ? -6 : 0 }} transition={{ type: "spring", stiffness: 200, damping: 12 }}>
          <UploadCloud size={30} className="text-forest" aria-hidden />
        </motion.div>
        <motion.div
          key={tick === 0 ? "a" : "b"}
          initial={{ opacity: 0, y: -40, rotate: -6 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 14 }}
          className="mt-4 flex w-[78%] max-w-[280px] items-center gap-3 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-line"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-coral/15 text-coral">
            <FileText size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">cv_2026.pdf</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand">
              <motion.div
                className="h-full origin-left rounded-full bg-forest"
                animate={{ scaleX: tick === 0 ? 0.05 : tick === 1 ? 0.6 : 1 }}
                transition={{ duration: 1, ease }}
              />
            </div>
          </div>
          <AnimatePresence>
            {done && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="grid h-6 w-6 place-items-center rounded-full bg-forest text-white"
              >
                <Check size={14} strokeWidth={3} aria-hidden />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
        <p className="mt-4 text-[12px] font-medium text-muted">PDF or DOCX · up to 5 MB</p>
      </div>
    </Panel>
  );
}

const rubric = ["Contact info present", "Dates are consistent", "Results are measurable", "Skills match your goals"];

function GradeVisual() {
  const { ref, tick } = useLoop(rubric.length + 2, 900);
  return (
    <Panel innerRef={ref}>
      <p className="font-display text-[15px] font-bold">Rubric check</p>
      <ul className="mt-4 space-y-2.5">
        {rubric.map((r, i) => {
          const shown = tick > i;
          const weak = i === 2;
          return (
            <motion.li
              key={r}
              animate={{ opacity: shown ? 1 : 0.35, x: shown ? 0 : -6 }}
              transition={{ duration: 0.4, ease }}
              className="flex items-center justify-between rounded-xl bg-sand px-3.5 py-2.5 text-[14px]"
            >
              <span>{r}</span>
              <motion.span
                animate={{ scale: shown ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  weak ? "bg-sun text-ink" : "bg-mint text-forest-deep"
                }`}
              >
                {weak ? "Fix" : "Good"}
              </motion.span>
            </motion.li>
          );
        })}
      </ul>
    </Panel>
  );
}

const jobsA = [
  { t: "Data Analyst", m: 64 },
  { t: "Junior Developer", m: 88 },
  { t: "QA Engineer", m: 71 },
];

function MatchVisual() {
  const { ref, tick } = useLoop(2, 2200);
  const list = tick === 0 ? jobsA : [...jobsA].sort((a, b) => b.m - a.m);
  return (
    <Panel innerRef={ref}>
      <div className="flex items-center justify-between">
        <p className="font-display text-[15px] font-bold">Your feed</p>
        <motion.span
          key={tick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[12px] font-medium text-muted"
        >
          {tick === 0 ? "Ranking…" : "Best match first"}
        </motion.span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {list.map((j) => (
          <motion.li
            layout
            key={j.t}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="flex items-center justify-between rounded-xl bg-sand px-3.5 py-3 text-[14px]"
          >
            <span className="font-medium">{j.t}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold tabular-nums ${
                j.m >= 80 ? "bg-forest text-white" : "bg-white text-ink ring-1 ring-line"
              }`}
            >
              {j.m}%
            </span>
          </motion.li>
        ))}
      </ul>
    </Panel>
  );
}
