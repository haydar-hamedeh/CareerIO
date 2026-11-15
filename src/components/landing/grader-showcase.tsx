"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { ease } from "@/lib/site";

const criteria = [
  "Clarity",
  "Impact and measurable results",
  "Skills relevance",
  "ATS readability",
  "Language and grammar",
  "Structure",
];

const versions = {
  before: {
    text: "Responsible for working on the company website and helping the team with different tasks.",
    notes: [
      "“Responsible for” describes a duty, not what you achieved.",
      "“Different tasks” is vague. A recruiter cannot tell what you did.",
      "No result. Your CV mentions a load-time number you can use here.",
    ],
    score: 58,
  },
  after: {
    text: "Rebuilt 4 pages of the company website in React with a team of 3, cutting load time from 4.1s to 1.8s.",
    notes: [
      "Starts with a strong verb and names the work.",
      "Uses the result already stated in your projects section.",
      "Adds React, a skill listed on your CV, in context.",
    ],
    score: 81,
  },
} as const;

type Key = keyof typeof versions;

export function GraderShowcase() {
  const [view, setView] = useState<Key>("before");
  const v = versions[view];

  return (
    <section id="grader" className="relative w-full py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1240px] items-start gap-14 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-32">
          <SectionLabel>CV Grader</SectionLabel>
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.06] font-extrabold tracking-[-0.03em]">
            Feedback you can act on, line by line.
          </h2>
          <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-muted">
            Simple checks run first, like missing sections or broken dates. Then the AI judges each part of the
            rubric and points to the exact sentence to improve.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {criteria.map((c, i) => (
              <motion.li
                key={c}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease, delay: 0.15 + i * 0.05 }}
                className="rounded-full bg-paper px-3.5 py-2 text-[14px] font-medium ring-1 ring-line"
              >
                {c}
              </motion.li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-[28px] bg-ink/[0.04] p-2 ring-1 ring-line">
            <div className="rounded-[22px] bg-paper p-5 shadow-lift sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div role="tablist" aria-label="Compare versions" className="relative inline-flex rounded-full bg-sand p-1">
                  {(["before", "after"] as const).map((k) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={view === k}
                      onClick={() => setView(k)}
                      className={`relative z-10 rounded-full px-5 py-2 font-display text-[14px] font-bold capitalize transition-colors duration-300 ${
                        view === k ? "text-white" : "text-muted hover:text-ink"
                      }`}
                    >
                      {view === k && (
                        <motion.span
                          layoutId="grader-pill"
                          className={`absolute inset-0 -z-10 rounded-full ${k === "before" ? "bg-coral" : "bg-forest"}`}
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      {k}
                    </button>
                  ))}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] text-muted">Impact score</span>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={v.score}
                      initial={{ y: 16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -16, opacity: 0 }}
                      transition={{ duration: 0.35, ease }}
                      className={`font-display text-3xl font-extrabold tabular-nums ${
                        view === "before" ? "text-coral" : "text-forest"
                      }`}
                    >
                      {v.score}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>

              <div className="mt-6 min-h-[132px] rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6">
                <p className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Experience · bullet 2</p>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={view}
                    initial={{ opacity: 0, filter: "blur(4px)", y: 6 }}
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    exit={{ opacity: 0, filter: "blur(4px)", y: -6 }}
                    transition={{ duration: 0.35, ease }}
                    className="font-display text-[1.15rem] leading-snug font-semibold sm:text-[1.3rem]"
                  >
                    {view === "before" ? (
                      <>
                        <mark className="rounded bg-coral/15 px-0.5 text-ink">Responsible for</mark> working on the
                        company website and helping the team with{" "}
                        <mark className="rounded bg-coral/15 px-0.5 text-ink">different tasks</mark>.
                      </>
                    ) : (
                      v.text
                    )}
                  </motion.p>
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.ul
                  key={view}
                  className="mt-5 space-y-2.5"
                  initial="hidden"
                  animate="show"
                  exit="hidden"
                  variants={{ show: { transition: { staggerChildren: 0.06 } } }}
                >
                  {v.notes.map((n) => (
                    <motion.li
                      key={n}
                      variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                      transition={{ duration: 0.3, ease }}
                      className="flex gap-3 text-[15px] leading-relaxed"
                    >
                      <span
                        aria-hidden
                        className={`mt-2 h-2 w-2 shrink-0 rounded-full ${view === "before" ? "bg-coral" : "bg-forest"}`}
                      />
                      <span className="text-ink/80">{n}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </AnimatePresence>

              <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-forest" aria-hidden />
                  Rewrites only use facts already in your CV.
                </p>
                <p>AI estimate, not a guarantee.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
