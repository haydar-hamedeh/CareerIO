"use client";

import { motion } from "framer-motion";
import { Eye, Lock, Trash2 } from "lucide-react";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { ease } from "@/lib/site";

const ignored = ["Name", "Gender", "Age", "Photo", "Nationality", "Religion"];

export function Trust() {
  return (
    <section id="trust" className="relative w-full py-24 sm:py-32">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <SectionLabel>Your data</SectionLabel>
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.06] font-extrabold tracking-[-0.03em]">
            Your CV is personal. We treat it that way.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-4">
            <div className="flex h-full flex-col justify-between gap-10 rounded-[28px] bg-forest p-7 text-white sm:p-9">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
                <Lock size={22} aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Private by default</h3>
                <p className="mt-3 max-w-lg leading-relaxed text-white/80">
                  CVs live in private storage and open only through short-lived links. Database rules make sure you
                  see only your own data. CV text is never written to logs.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08} className="md:col-span-2">
            <div className="flex h-full flex-col justify-between gap-8 rounded-[28px] bg-paper p-7 ring-1 ring-line sm:p-8">
              <div>
                <h3 className="font-display text-xl font-extrabold tracking-tight">Delete anytime</h3>
                <p className="mt-2 leading-relaxed text-muted">
                  One button removes your account, CV files and all your data. Really removes it.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-coral/10 px-4 py-2.5 text-[13px] font-semibold text-[#c2410c]">
                <Trash2 size={15} aria-hidden /> Delete my account and all data
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.04} className="md:col-span-3">
            <div className="h-full rounded-[28px] bg-paper p-7 ring-1 ring-line sm:p-8">
              <h3 className="font-display text-xl font-extrabold tracking-tight">Never used in scoring</h3>
              <p className="mt-2 leading-relaxed text-muted">
                These are removed before your CV reaches the model wherever possible, and never count toward a score.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {ignored.map((f, i) => (
                  <li key={f} className="relative rounded-full bg-sand px-3.5 py-2 text-[14px] font-medium text-muted">
                    {f}
                    <motion.span
                      aria-hidden
                      className="absolute top-1/2 right-3 left-3 h-[2px] origin-left rounded-full bg-coral"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true, margin: "-15% 0px" }}
                      transition={{ duration: 0.5, ease, delay: 0.3 + i * 0.08 }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.12} className="md:col-span-3">
            <div className="flex h-full flex-col justify-between gap-8 rounded-[28px] bg-sun p-7 sm:p-8">
              <div>
                <h3 className="font-display text-xl font-extrabold tracking-tight">You choose who sees it</h3>
                <p className="mt-2 max-w-sm leading-relaxed text-ink/75">
                  Employers only see your CV when you apply to their job. Your profile is not shared with anyone
                  else.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink/10 px-4 py-2.5 text-[13px] font-semibold">
                <Eye size={15} aria-hidden /> Visible only to employers you apply to
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
