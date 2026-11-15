"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { ease } from "@/lib/site";

type RevealProps = HTMLMotionProps<"div"> & { delay?: number; y?: number };

export function Reveal({ delay = 0, y = 24, children, ...rest }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, ease, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-forest">
      <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden />
      {children}
    </p>
  );
}
