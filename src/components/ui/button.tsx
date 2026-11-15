"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { ArrowRight } from "lucide-react";

type Variant = "primary" | "secondary" | "light";

const styles: Record<Variant, string> = {
  primary: "bg-forest text-white shadow-soft hover:bg-forest-deep",
  secondary: "bg-paper text-ink ring-1 ring-line hover:ring-ink/25",
  light: "bg-sand text-ink hover:bg-white",
};

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  arrow?: boolean;
  className?: string;
};

export function Button({ href, children, variant = "primary", arrow = false, className = "" }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 18, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 18, mass: 0.4 });

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.18);
    y.set((e.clientY - r.top - r.height / 2) * 0.3);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div style={{ x, y }} className="inline-flex">
      <Link
        ref={ref}
        href={href}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className={`group inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 font-display text-[15px] font-bold transition-[background-color,box-shadow,transform] duration-300 ease-(--ease-out-soft) active:scale-[0.97] ${styles[variant]} ${className}`}
      >
        {children}
        {arrow && (
          <span className="relative -mr-1 inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white/15">
            <ArrowRight
              size={15}
              strokeWidth={2.5}
              className="transition-transform duration-300 ease-(--ease-out-soft) group-hover:translate-x-[150%]"
            />
            <ArrowRight
              size={15}
              strokeWidth={2.5}
              className="absolute -translate-x-[150%] transition-transform duration-300 ease-(--ease-out-soft) group-hover:translate-x-0"
            />
          </span>
        )}
      </Link>
    </motion.div>
  );
}
