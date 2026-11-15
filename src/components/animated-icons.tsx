"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ease } from "@/lib/site";

const SVG = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const PLAY_MS = 650;

export function useIconTap() {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    initial: "rest",
    animate: playing ? "play" : "rest",
    whileHover: "play",
    whileFocus: "play",
    onTapStart: () => {
      clearTimeout(timer.current);
      setPlaying(true);
      timer.current = setTimeout(() => setPlaying(false), PLAY_MS);
    },
  } as const;
}

function useVariants(v: Variants) {
  return useReducedMotion() ? undefined : v;
}

const bookmarkPath: Variants = {
  rest: { scaleY: 1, y: 0 },
  play: {
    scaleY: [1, 1.15, 0.94, 1],
    y: [0, -1.5, 0.5, 0],
    transition: { duration: 0.45, ease },
  },
};

export function AnimatedBookmark({
  size = 16,
  filled = false,
  className,
  strokeWidth = 2,
}: {
  size?: number;
  filled?: boolean;
  className?: string;
  strokeWidth?: number;
}) {
  const variants = useVariants(bookmarkPath);
  return (
    <svg width={size} height={size} {...SVG} strokeWidth={strokeWidth} className={className} aria-hidden>
      <motion.path
        d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"
        fill={filled ? "currentColor" : "none"}
        variants={variants}
        style={{ transformOrigin: "12px 12px" }}
      />
    </svg>
  );
}

const chevronPath: Variants = {
  rest: { y: 0 },
  play: {
    y: [0, 2, 0],
    transition: { duration: 0.4, ease },
  },
};

export function AnimatedChevronDown({
  size = 16,
  open = false,
  className,
  strokeWidth = 2,
}: {
  size?: number;
  open?: boolean;
  className?: string;
  strokeWidth?: number;
}) {
  const variants = useVariants(chevronPath);
  const reduce = useReducedMotion();
  return (
    <motion.svg
      width={size}
      height={size}
      {...SVG}
      strokeWidth={strokeWidth}
      className={className}
      animate={reduce ? undefined : { rotate: open ? 180 : 0 }}
      transition={{ duration: 0.28, ease }}
      aria-hidden
    >
      <motion.path d="m6 9 6 6 6-6" variants={variants} />
    </motion.svg>
  );
}

const cloudPulse: Variants = {
  rest: { scale: 1 },
  play: { scale: [1, 1.04, 1], transition: { duration: 0.48, ease } },
};

const cloudArrow: Variants = {
  rest: { y: 0 },
  play: { y: [0, -3, 0], transition: { duration: 0.45, ease } },
};

export function AnimatedUploadCloud({
  size = 17,
  className,
  strokeWidth = 2,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const cloudV = useVariants(cloudPulse);
  const arrowV = useVariants(cloudArrow);
  return (
    <svg width={size} height={size} {...SVG} strokeWidth={strokeWidth} className={className} aria-hidden>
      <motion.path
        d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"
        variants={cloudV}
        style={{ transformOrigin: "12px 11px" }}
      />
      <motion.path d="M12 13v8" variants={arrowV} />
      <motion.path d="m8 17 4-4 4 4" variants={arrowV} />
    </svg>
  );
}

const filePage: Variants = {
  rest: { y: 0, rotate: 0 },
  play: { y: [0, -1.5, 0], rotate: [0, -2, 0], transition: { duration: 0.45, ease } },
};

const fileLine: Variants = {
  rest: { scaleX: 1, opacity: 1 },
  play: (i: number) => ({
    scaleX: [1, 0.72, 1],
    opacity: [1, 0.65, 1],
    transition: { duration: 0.38, ease, delay: i * 0.05 },
  }),
};

export function AnimatedFileText({
  size = 24,
  className,
  strokeWidth = 2,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const pageV = useVariants(filePage);
  const lineV = useVariants(fileLine);
  return (
    <svg width={size} height={size} {...SVG} strokeWidth={strokeWidth} className={className} aria-hidden>
      <motion.g variants={pageV} style={{ transformOrigin: "12px 12px" }}>
        <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
        <path d="M14 2v5a1 1 0 0 0 1 1h5" />
        <motion.path d="M10 9H8" custom={0} variants={lineV} style={{ transformOrigin: "8px 9px" }} />
        <motion.path d="M16 13H8" custom={1} variants={lineV} style={{ transformOrigin: "8px 13px" }} />
        <motion.path d="M16 17H8" custom={2} variants={lineV} style={{ transformOrigin: "8px 17px" }} />
      </motion.g>
    </svg>
  );
}

const arrowRight: Variants = {
  rest: { x: 0 },
  play: { x: [0, 3, 0], transition: { duration: 0.38, ease } },
};

export function AnimatedArrowRight({
  size = 14,
  className,
  strokeWidth = 2,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const variants = useVariants(arrowRight);
  return (
    <svg width={size} height={size} {...SVG} strokeWidth={strokeWidth} className={className} aria-hidden>
      <motion.path d="M5 12h14" variants={variants} />
      <motion.path d="m12 5 7 7-7 7" variants={variants} />
    </svg>
  );
}

const checkPop: Variants = {
  rest: { scale: 1 },
  play: { scale: [1, 1.18, 1], transition: { duration: 0.35, ease } },
};

export function AnimatedCheck({
  size = 17,
  className,
  strokeWidth = 3,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const variants = useVariants(checkPop);
  return (
    <svg width={size} height={size} {...SVG} strokeWidth={strokeWidth} className={className} aria-hidden>
      <motion.path d="M20 6 9 17l-5-5" variants={variants} style={{ transformOrigin: "12px 12px" }} />
    </svg>
  );
}

const trashLid: Variants = {
  rest: { y: 0, rotate: 0 },
  play: { y: [0, -2, 0], rotate: [0, -7, 0], transition: { duration: 0.4, ease } },
};

export function AnimatedTrash({
  size = 15,
  className,
  strokeWidth = 2,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const lidV = useVariants(trashLid);
  return (
    <svg width={size} height={size} {...SVG} strokeWidth={strokeWidth} className={className} aria-hidden>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <motion.g variants={lidV} style={{ transformOrigin: "12px 6px" }}>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </motion.g>
    </svg>
  );
}

const copyFront: Variants = {
  rest: { x: 0, y: 0 },
  play: { x: [0, -1.5, 0], y: [0, -1.5, 0], transition: { duration: 0.38, ease } },
};

export function AnimatedCopy({
  size = 15,
  className,
  strokeWidth = 2,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const frontV = useVariants(copyFront);
  return (
    <svg width={size} height={size} {...SVG} strokeWidth={strokeWidth} className={className} aria-hidden>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      <motion.rect width="14" height="14" x="8" y="8" rx="2" ry="2" variants={frontV} />
    </svg>
  );
}
