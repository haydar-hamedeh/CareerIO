"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ease } from "@/lib/site";

type Props = {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  delay?: number;
};

export function ScoreRing({ score, size = 148, stroke = 12, label = "CV score", delay = 0.3 }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? score : 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, score, {
      duration: 1.6,
      delay,
      ease,
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduce, score, delay]);

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mint)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--forest)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - score / 100) : c }}
          animate={inView ? { strokeDashoffset: c * (1 - score / 100) } : undefined}
          transition={{ duration: 1.6, delay, ease }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display leading-none font-extrabold tabular-nums" style={{ fontSize: size * 0.26 }}>
            {value}
          </p>
          <p className="mt-1 text-xs font-medium text-muted">{label}</p>
        </div>
      </div>
      <span className="sr-only">
        {label}: {score} out of 100
      </span>
    </div>
  );
}
