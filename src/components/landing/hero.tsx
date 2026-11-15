"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ui/score-ring";
import { ease } from "@/lib/site";

const line1 = ["Know", "where", "your", "CV", "stands."];
const line2 = ["Land", "jobs", "that", "fit."];

export function Hero() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const mockY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -80]);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 20 });
  const sy = useSpring(py, { stiffness: 120, damping: 20 });
  const rotY = useTransform(sx, [-0.5, 0.5], [-5, 5]);
  const rotX = useTransform(sy, [-0.5, 0.5], [4, -4]);
  const cardAX = useTransform(sx, [-0.5, 0.5], [-14, 14]);
  const cardBX = useTransform(sx, [-0.5, 0.5], [10, -10]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  let wordIndex = 0;
  const word = (w: string, accent = false) => {
    const i = wordIndex++;
    return (
      <span key={`${w}-${i}`} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
        <motion.span
          className={`inline-block ${accent ? "text-forest" : ""}`}
          initial={reduce ? false : { y: "110%" }}
          animate={{ y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.1 + i * 0.06 }}
        >
          {w}
        </motion.span>
        {" "}
      </span>
    );
  };

  return (
    <section ref={sectionRef} className="grain relative w-full overflow-hidden pt-28 pb-32 sm:pt-36 lg:pb-32">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-drift absolute -top-40 -right-32 h-[560px] w-[560px] rounded-full bg-mint opacity-70 blur-3xl" />
        <div className="animate-drift-slow absolute top-1/3 -left-40 h-[420px] w-[420px] rounded-full bg-sun/30 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-paper px-3.5 py-1.5 text-[13px] font-semibold text-forest ring-1 ring-line"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden />
            CV feedback and job matching in one place
          </motion.p>

          <h1 className="font-display text-[clamp(2.5rem,6.4vw,4.15rem)] leading-[1.02] font-extrabold tracking-[-0.035em] text-ink">
            <span className="block">{line1.map((w) => word(w))}</span>
            <span className="block">{line2.map((w, i) => word(w, i >= 2))}</span>
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.6 }}
            className="mt-6 max-w-[34rem] text-[1.125rem] leading-relaxed text-muted"
          >
            Upload your CV and get an honest score with clear, line-by-line fixes. Then see jobs ranked by how
            well they match you, with the reason spelled out.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.72 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Button href="/signup" arrow>
              Get started
            </Button>
            <Button href="#employers" variant="secondary">
              For employers
            </Button>
          </motion.div>
        </div>

        <motion.div
          style={{ y: mockY }}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          className="relative mx-auto mt-10 w-full max-w-[540px] [perspective:1400px] lg:mt-0"
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.1, ease, delay: 0.25 }}
          >
            <motion.div
              style={{ rotateX: rotX, rotateY: rotY }}
              className="relative rounded-[28px] bg-paper p-5 shadow-lift ring-1 ring-line sm:p-7"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-[15px] font-bold">Your CV review</p>
                  <p className="text-[13px] text-muted">my_cv_2026.pdf</p>
                </div>
                <span className="rounded-full bg-mint px-3 py-1 text-[12px] font-semibold text-forest-deep">
                  Graded
                </span>
              </div>

              <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                <ScoreRing score={82} size={140} delay={0.7} />
                <ul className="w-full flex-1 space-y-3">
                  {[
                    ["Clarity", 88],
                    ["Impact & results", 64],
                    ["Skills relevance", 91],
                    ["ATS readability", 85],
                  ].map(([label, v], i) => (
                    <li key={label}>
                      <div className="mb-1.5 flex justify-between text-[13px]">
                        <span className="font-medium text-ink">{label}</span>
                        <span className="tabular-nums text-muted">{v}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-sand">
                        <motion.div
                          className={`h-full origin-left rounded-full ${Number(v) < 70 ? "bg-sun" : "bg-forest"}`}
                          style={{ width: `${v}%` }}
                          initial={reduce ? false : { scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 1.1, ease, delay: 0.9 + i * 0.1 }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 rounded-2xl bg-sand p-4 text-[13px] leading-relaxed">
                <p className="font-semibold text-ink">Top fix</p>
                <p className="mt-1 text-muted">
                  Add a measurable result to “Worked on the checkout page”. Use the numbers you already have.
                </p>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            style={{ x: cardAX }}
            className="absolute -bottom-24 -left-2 w-[250px] sm:-bottom-20 sm:-left-16 sm:w-[270px]"
          >
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 30, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: -3 }}
              transition={{ type: "spring", stiffness: 90, damping: 14, delay: 1.1 }}
            >
              <motion.div
                animate={reduce ? undefined : { y: [0, -8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <JobCard
                  title="Frontend Developer"
                  company="Cedar Labs"
                  place="Hybrid · Beirut"
                  match={92}
                  reason="Matches 7 of 9 skills. Missing: Docker"
                />
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div
            style={{ x: cardBX }}
            className="absolute -top-24 -right-2 hidden w-[240px] sm:block lg:-right-12"
          >
            <motion.div
              initial={reduce ? false : { opacity: 0, y: -24, rotate: 6 }}
              animate={{ opacity: 1, y: 0, rotate: 3 }}
              transition={{ type: "spring", stiffness: 90, damping: 14, delay: 1.3 }}
            >
              <motion.div
                animate={reduce ? undefined : { y: [0, 7, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <JobCard
                  title="UI Designer"
                  company="Olive & Co"
                  place="Remote"
                  match={78}
                  reason="Strong portfolio fit. Missing: Figma prototyping"
                  tone="sun"
                />
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function JobCard({
  title,
  company,
  place,
  match,
  reason,
  tone = "forest",
}: {
  title: string;
  company: string;
  place: string;
  match: number;
  reason: string;
  tone?: "forest" | "sun";
}) {
  return (
    <div className="rounded-[22px] bg-white p-4 shadow-lift ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold ${
              tone === "forest" ? "bg-mint text-forest-deep" : "bg-sun/40 text-ink"
            }`}
          >
            {company[0]}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[14px] font-bold">{title}</p>
            <p className="truncate text-[12px] text-muted">{company}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums ${
            tone === "forest" ? "bg-forest text-white" : "bg-sun text-ink"
          }`}
        >
          {match}%
        </span>
      </div>
      <p className="mt-3 flex items-center gap-1 text-[12px] text-muted">
        <MapPin size={12} aria-hidden /> {place}
      </p>
      <p className="mt-2 rounded-xl bg-sand px-3 py-2 text-[12px] leading-snug text-ink">{reason}</p>
    </div>
  );
}
