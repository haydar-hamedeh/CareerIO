"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import { ease } from "@/lib/site";
import { Logo } from "./logo";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#grader", label: "CV Grader" },
  { href: "#employers", label: "For employers" },
  { href: "#trust", label: "Your data" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <motion.header
      initial={false}
      animate={{
        backgroundColor: scrolled || open ? "rgba(251,248,242,1)" : "rgba(246,241,231,0)",
        boxShadow: scrolled || open
          ? "0 1px 0 rgba(15,26,23,0.08), 0 10px 30px -18px rgba(15,26,23,0.25)"
          : "0 1px 0 rgba(15,26,23,0), 0 0 0 rgba(15,26,23,0)",
      }}
      transition={{ duration: 0.4, ease }}
      className="fixed inset-x-0 top-0 z-50 w-full"
    >
      <nav
        aria-label="Main"
        className={`mx-auto flex max-w-[1240px] items-center justify-between px-4 transition-[height] duration-500 ease-(--ease-out-soft) sm:px-6 ${
          scrolled ? "h-16" : "h-[76px]"
        }`}
      >
        <Link href="/" aria-label="CareerIO home" className="rounded-full">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-3.5 py-2 text-[14px] font-medium text-muted transition-colors duration-200 hover:bg-ink/5 hover:text-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2 text-[14px] font-semibold text-ink transition-colors hover:bg-ink/5 sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 font-display text-[14px] font-bold text-sand transition-[transform,background-color] duration-300 ease-(--ease-out-soft) hover:bg-forest active:scale-[0.97]"
          >
            Get started
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5 lg:hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "x" : "m"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            data-lenis-prevent
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease }}
            className="max-h-[calc(100dvh-4rem)] w-full overflow-y-auto overscroll-contain border-t border-line bg-paper px-2 pt-2 pb-4 sm:px-4 lg:hidden"
          >
            <ul>
              {links.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.3, ease }}
                >
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-3.5 font-display text-lg font-bold hover:bg-sand"
                  >
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </ul>
            <div className="mt-2 border-t border-line p-2 pt-4">
              <Link href="/login" className="block rounded-2xl px-2 py-2 font-semibold text-muted">
                Log in
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
