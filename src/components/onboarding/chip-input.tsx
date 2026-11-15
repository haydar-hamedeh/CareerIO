"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";

type Props = {
  label: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  catalog?: readonly string[];
  placeholder?: string;
  max?: number;
  error?: string;
};

export function ChipInput({ label, hint, value, onChange, suggestions = [], catalog, placeholder, max = 40, error }: Props) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const lower = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const add = (raw: string) => {
    const v = raw.trim().replace(/\s+/g, " ");
    if (!v || v.length > 60 || lower.has(v.toLowerCase()) || value.length >= max) return;
    onChange([...value, v]);
    setDraft("");
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));

  const q = draft.trim().toLowerCase();
  const pool = q ? (catalog ?? suggestions) : suggestions;
  const matches = pool
    .filter((s) => !lower.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q)))
    .sort((a, b) => (q ? Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)) : 0))
    .slice(0, q ? 10 : 12);

  return (
    <div>
      <label htmlFor={id} className="text-[14px] font-semibold text-ink">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}

      <div
        className={`mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-2xl bg-white p-2 ring-1 transition-shadow focus-within:ring-2 ${
          error ? "ring-coral focus-within:ring-coral" : "ring-line focus-within:ring-forest"
        }`}
      >
        <AnimatePresence initial={false}>
          {value.map((v) => (
            <motion.span
              key={v}
              layout
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="inline-flex items-center gap-1 rounded-full bg-mint py-1 pr-1 pl-3 text-[13.5px] font-semibold text-forest-deep"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                aria-label={`Remove ${v}`}
                className="grid h-6 w-6 place-items-center rounded-full transition-colors hover:bg-forest/15"
              >
                <X size={13} strokeWidth={2.5} aria-hidden />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? "Add more…" : placeholder}
          aria-invalid={Boolean(error)}
          className="h-8 min-w-[140px] flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-ink/35"
        />
      </div>

      {error && (
        <p role="alert" className="pt-2 text-[13px] font-medium text-[#c2410c]">
          {error}
        </p>
      )}

      {matches.length > 0 && value.length < max && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-ink/80 ring-1 ring-line transition-[box-shadow,color,transform] hover:text-ink hover:ring-forest/40 active:scale-95"
            >
              <Plus size={12} strokeWidth={2.5} aria-hidden />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
