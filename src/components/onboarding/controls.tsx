"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[14px] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          className={`h-12 w-full appearance-none rounded-2xl bg-white pr-11 pl-4 text-[15px] ring-1 outline-none focus:ring-2 ${
            value ? "text-ink" : "text-ink/40"
          } ${error ? "ring-coral" : "ring-line hover:ring-ink/25 focus:ring-forest"}`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={18} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      {error && (
        <p role="alert" className="pt-2 text-[13px] font-medium text-[#c2410c]">
          {error}
        </p>
      )}
    </div>
  );
}

export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onToggle,
  multiple = false,
  error,
  layoutKey,
}: {
  label: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T[];
  onToggle: (v: T) => void;
  multiple?: boolean;
  error?: string;
  layoutKey: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[14px] font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value.includes(o.value);
          return (
            <label
              key={o.value}
              className={`relative cursor-pointer rounded-2xl px-4 py-2.5 text-[14px] font-semibold transition-colors duration-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest ${
                active ? "text-forest-deep" : "bg-white text-ink/80 ring-1 ring-line hover:ring-ink/25"
              }`}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={layoutKey}
                checked={active}
                onChange={() => onToggle(o.value)}
                className="sr-only"
              />
              {active && (
                <motion.span
                  layoutId={multiple ? undefined : `${layoutKey}-pill`}
                  initial={multiple ? { opacity: 0, scale: 0.9 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 rounded-2xl bg-mint ring-2 ring-forest"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{o.label}</span>
              {o.hint && <span className="relative mt-0.5 block text-[12px] font-medium text-muted">{o.hint}</span>}
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="pt-2 text-[13px] font-medium text-[#c2410c]">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[14px] font-semibold text-ink">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-2xl bg-white px-4 py-3 text-[15px] ring-1 ring-line outline-none placeholder:text-ink/35 hover:ring-ink/25 focus:ring-2 focus:ring-forest"
      />
    </div>
  );
}
