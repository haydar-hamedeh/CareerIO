"use client";

import { motion } from "framer-motion";
import { Briefcase, Search } from "lucide-react";
import type { Role } from "@/lib/auth/schemas";

const options: { value: Role; title: string; body: string; Icon: typeof Search }[] = [
  { value: "candidate", title: "I'm looking for a job", body: "Grade my CV, find matches", Icon: Search },
  { value: "employer", title: "I'm hiring", body: "Post jobs, review applicants", Icon: Briefcase },
];

export function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[14px] font-semibold text-ink">How will you use CareerIO?</legend>
      <div role="radiogroup" className="grid grid-cols-2 gap-2.5">
        {options.map(({ value: v, title, body, Icon }) => {
          const active = value === v;
          return (
            <label
              key={v}
              className={`group relative cursor-pointer rounded-[20px] p-3.5 transition-colors duration-300 sm:p-4 ${
                active ? "text-ink" : "bg-white text-ink ring-1 ring-line hover:ring-ink/25"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={v}
                checked={active}
                onChange={() => onChange(v)}
                className="peer sr-only"
              />
              {active && (
                <motion.span
                  layoutId="role-pill"
                  className="absolute inset-0 rounded-[20px] bg-mint ring-2 ring-forest"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="pointer-events-none absolute inset-0 rounded-[20px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest" />
              <span className="relative block">
                <motion.span
                  animate={active ? { rotate: [0, -12, 8, 0], scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className={`mb-3 grid h-9 w-9 place-items-center rounded-xl transition-colors duration-300 ${
                    active ? "bg-forest text-white" : "bg-sand text-ink"
                  }`}
                >
                  <Icon size={17} aria-hidden />
                </motion.span>
                <span className="block font-display text-[14.5px] leading-tight font-bold">{title}</span>
                <span className="mt-1 block text-[12.5px] leading-snug text-muted">{body}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
