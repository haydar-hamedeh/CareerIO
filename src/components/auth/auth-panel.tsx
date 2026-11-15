"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, MapPin } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import { ease } from "@/lib/site";

const promises = ["Your CV stays private", "Delete everything anytime", "A human makes every hiring call"];

export function AuthPanel() {
  const reduce = useReducedMotion();
  const float = (d: number, delay = 0) =>
    reduce ? undefined : { animate: { y: [0, -d, 0] }, transition: { duration: 7, repeat: Infinity, ease: "easeInOut" as const, delay } };

  return (
    <div className="grain relative flex h-full flex-col justify-between overflow-hidden bg-forest px-12 py-12 text-white xl:px-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-drift absolute -top-24 -right-24 h-[440px] w-[440px] rounded-full bg-mint/25 blur-3xl" />
        <div className="animate-drift-slow absolute -bottom-32 -left-20 h-[380px] w-[380px] rounded-full bg-sun/20 blur-3xl" />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease, delay: 0.1 }}
        className="relative max-w-md"
      >
        <h2 className="font-display text-[2.5rem] leading-[1.05] font-extrabold tracking-[-0.03em] xl:text-[2.85rem]">
          Your next role is closer than it feels.
        </h2>
        <p className="mt-4 text-[1.05rem] leading-relaxed text-white/75">
          Know what to fix on your CV, then apply where you actually fit.
        </p>
      </motion.div>

      <div className="relative my-10 h-[300px]">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 30, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.3 }}
          className="absolute top-0 left-0 w-[290px]"
        >
          <motion.div {...float(8)} className="flex items-center gap-5 rounded-[24px] bg-paper p-5 text-ink shadow-lift">
            <ScoreRing score={86} size={96} stroke={9} label="score" delay={0.8} />
            <div className="min-w-0">
              <p className="font-display text-[15px] font-bold">CV review</p>
              <p className="mt-1 text-[12.5px] leading-snug text-muted">3 quick fixes found. Clarity is strong.</p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 30, rotate: 3 }}
          animate={{ opacity: 1, y: 0, rotate: 2 }}
          transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.5 }}
          className="absolute top-[150px] right-0 w-[280px] xl:right-6"
        >
          <motion.div {...float(10, 1.2)} className="rounded-[24px] bg-white p-4 text-ink shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-sun/40 font-display font-extrabold">
                  N
                </span>
                <div>
                  <p className="font-display text-[14px] font-bold">Marketing Associate</p>
                  <p className="text-[12px] text-muted">Northwind Studio</p>
                </div>
              </div>
              <span className="rounded-full bg-forest px-2.5 py-1 text-[12px] font-bold text-white">88%</span>
            </div>
            <p className="mt-3 flex items-center gap-1 text-[12px] text-muted">
              <MapPin size={12} aria-hidden /> Remote
            </p>
          </motion.div>
        </motion.div>
      </div>

      <ul className="relative space-y-3">
        {promises.map((p, i) => (
          <motion.li
            key={p}
            initial={reduce ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.7 + i * 0.08 }}
            className="flex items-center gap-3 text-[15px] text-white/85"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15">
              <Check size={13} strokeWidth={3} aria-hidden />
            </span>
            {p}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
