"use client";

import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Briefcase, Check, MapPin, Plus } from "lucide-react";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { ease } from "@/lib/site";

const required = [
  "React",
  "TypeScript",
  "Next.js",
  "Tailwind CSS",
  "Git",
  "REST APIs",
  "Testing",
  "Docker",
  "Accessibility",
];

const initial = new Set(["React", "TypeScript", "Next.js", "Tailwind CSS", "Git", "REST APIs", "Testing"]);

export function MatchingShowcase() {
  const [skills, setSkills] = useState<Set<string>>(initial);
  const matched = required.filter((s) => skills.has(s));
  const missing = required.filter((s) => !skills.has(s));
  const pct = Math.round((matched.length / required.length) * 100);
  const shown = useCount(pct);

  const toggle = (s: string) =>
    setSkills((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const reason =
    missing.length === 0
      ? `Matches all ${required.length} required skills.`
      : `Matches ${matched.length} of ${required.length} required skills. Missing: ${missing.slice(0, 3).join(", ")}${
          missing.length > 3 ? ` +${missing.length - 3}` : ""
        }`;

  return (
    <section className="relative w-full bg-mint py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1240px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <Reveal className="order-2 lg:order-1">
          <div className="rounded-[28px] bg-white/50 p-2 ring-1 ring-forest/10">
            <div className="rounded-[22px] bg-white p-5 shadow-lift sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <span aria-hidden className="grid h-12 w-12 place-items-center rounded-2xl bg-mint font-display text-lg font-extrabold text-forest-deep">
                    C
                  </span>
                  <div>
                    <p className="font-display text-[17px] font-bold">Frontend Developer</p>
                    <p className="text-[13px] text-muted">Cedar Labs · Software</p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-display text-4xl font-extrabold tabular-nums transition-colors duration-500 ${
                      pct >= 75 ? "text-forest" : pct >= 50 ? "text-[#b7791f]" : "text-coral"
                    }`}
                  >
                    <motion.span>{shown}</motion.span>%
                  </p>
                  <p className="text-[12px] font-medium text-muted">skill match</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden /> Hybrid · Beirut
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase size={14} aria-hidden /> Mid-level · Full-time
                </span>
              </div>

              <motion.p
                key={reason}
                initial={{ opacity: 0.4, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease }}
                className="mt-5 rounded-2xl bg-sand px-4 py-3 text-[14px] leading-snug font-medium"
              >
                <span className="font-bold text-forest">Why it matches: </span>
                {reason}
              </motion.p>

              <div className="mt-6">
                <p className="text-[13px] font-semibold">Required skills · tap to try your own</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {required.map((s) => {
                    const on = skills.has(s);
                    return (
                      <li key={s}>
                        <motion.button
                          type="button"
                          layout
                          whileTap={{ scale: 0.94 }}
                          onClick={() => toggle(s)}
                          aria-pressed={on}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-300 ${
                            on
                              ? "border border-forest bg-forest text-white"
                              : "border border-dashed border-coral/60 bg-white text-ink hover:border-coral"
                          }`}
                        >
                          {on ? <Check size={14} strokeWidth={3} aria-hidden /> : <Plus size={14} strokeWidth={3} aria-hidden />}
                          {s}
                        </motion.button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-4 px-2 text-[13px] leading-relaxed text-forest-deep/80">
            Shown here: skill overlap only. Your full match score also weighs your experience, your preferences and
            how closely your CV fits the job description.
          </p>
        </Reveal>

        <Reveal className="order-1 lg:order-2">
          <SectionLabel>Job matching</SectionLabel>
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.06] font-extrabold tracking-[-0.03em]">
            Every match comes with a reason.
          </h2>
          <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-muted">
            No black box. Each job in your feed shows a match score and a plain sentence saying what fits and what
            is missing, so you know where to apply and what to learn next.
          </p>
          <ul className="mt-8 space-y-3 text-[15px]">
            {["Filters for location, remote, level and date", "Save jobs and apply in one click", "Optional cover letter draft you can edit"].map(
              (t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-forest text-white">
                    <Check size={13} strokeWidth={3} aria-hidden />
                  </span>
                  {t}
                </li>
              ),
            )}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function useCount(target: number) {
  const mv = useMotionValue(target);
  const rounded = useTransform(mv, (x) => Math.round(x));
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      mv.set(target);
      return;
    }
    const c = animate(mv, target, { duration: 0.6, ease });
    return () => c.stop();
  }, [mv, target, reduce]);
  return rounded;
}
