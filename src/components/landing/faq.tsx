"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { ease } from "@/lib/site";

const faqs = [
  {
    q: "Do I need a polished CV to start?",
    a: "No. Upload the CV you have today. The grader shows what is missing and how to fix it, one line at a time.",
  },
  {
    q: "Will the AI make things up on my CV?",
    a: "No. Rewrite suggestions may only rephrase facts already in your CV. It never adds experience, skills or numbers you did not write.",
  },
  {
    q: "Who can see my CV?",
    a: "Only you, and the employers you choose to apply to. Files are stored privately and opened through short-lived links.",
  },
  {
    q: "Does the AI decide who gets hired?",
    a: "No. It ranks applicants and explains why, to save time. An employer reviews and makes every decision.",
  },
  {
    q: "How accurate is the CV score?",
    a: "It is an estimate, not a guarantee. The same CV graded twice lands within a few points, and every score shows the rubric behind it.",
  },
  {
    q: "I'm hiring. How do I post a job?",
    a: "Create an employer account, add your company and post the role. Applicants appear ranked by match as they apply, and you decide who moves forward.",
  },
  {
    q: "Can I delete my data?",
    a: "Yes. Settings has a button that deletes your account, your CV files and everything linked to you.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative w-full bg-paper py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <Reveal>
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.06] font-extrabold tracking-[-0.03em]">
            Questions, answered plainly.
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <ul className="divide-y divide-line border-y border-line">
            {faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <li key={f.q}>
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-${i}`}
                      className="group flex w-full items-center justify-between gap-6 py-6 text-left"
                    >
                      <span className="font-display text-[1.1rem] font-bold sm:text-[1.2rem]">{f.q}</span>
                      <motion.span
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                          isOpen ? "bg-forest text-white" : "bg-sand text-ink group-hover:bg-mint"
                        }`}
                      >
                        <Plus size={18} aria-hidden />
                      </motion.span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-xl pb-6 leading-relaxed text-muted">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
