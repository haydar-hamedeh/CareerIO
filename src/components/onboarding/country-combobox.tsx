"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { countries, countryByCode, detectRegion, flagSrc, type Country } from "@/lib/geo/countries";
import { ease } from "@/lib/site";


export function Flag({ code, className = "" }: { code: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagSrc(code)}
      alt=""
      width={22}
      height={15}
      loading="lazy"
      decoding="async"
      className={`h-[15px] w-[22px] shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(15,26,23,0.08)] ${className}`}
    />
  );
}

type Props = {
  value: string | null;
  onChange: (country: Country) => void;
  variant: "field" | "dial";
  label?: string;
  error?: string;
  placeholder?: string;
};

export function CountryCombobox({ value, onChange, variant, label, error, placeholder = "Choose a country" }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = value ? countryByCode.get(value) : undefined;
  const [suggested] = useState(() => [...new Set([detectRegion(), value].filter(Boolean) as string[])]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) {
      const top = suggested.map((c) => countryByCode.get(c)).filter(Boolean) as Country[];
      return [...top, ...countries.filter((c) => !suggested.includes(c.code))];
    }
    return countries
      .filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || c.dial.startsWith(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)));
  }, [query, suggested]);

  const suggestedCount = query.trim() ? 0 : suggested.length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const openList = () => {
    const i = selected ? options.findIndex((o) => o.code === selected.code) : 0;
    setQuery("");
    setActive(Math.max(0, i));
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  };

  const choose = (c: Country) => {
    onChange(c);
    setOpen(false);
    trigger.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") trigger.current?.focus();
    }
  };

  const isDial = variant === "dial";

  return (
    <div ref={root} className={isDial ? "relative" : "relative"}>
      {label && (
        <span id={`${id}-label`} className="mb-2 block text-[14px] font-semibold text-ink">
          {label}
        </span>
      )}
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${id}-label ${id}-value` : undefined}
        aria-label={isDial ? `Country code: ${selected ? `${selected.name} +${selected.dial}` : "not set"}` : undefined}
        className={
          isDial
            ? "group flex h-full items-center gap-2 rounded-l-2xl pr-2.5 pl-3.5 transition-colors hover:bg-sand/70 focus-visible:outline-offset-[-2px]"
            : `group flex h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-[15px] ring-1 transition-shadow outline-none focus-visible:ring-2 ${
                error ? "ring-coral" : open ? "ring-2 ring-forest" : "ring-line hover:ring-ink/25 focus-visible:ring-forest"
              }`
        }
      >
        {selected ? <Flag code={selected.code} /> : !isDial && <span className="h-[15px] w-[22px] rounded-[3px] bg-ink/[0.07]" aria-hidden />}
        <span id={`${id}-value`} className={`${isDial ? "font-semibold tabular-nums" : "flex-1 truncate"} ${selected ? "text-ink" : "text-ink/40"}`}>
          {isDial ? (selected ? `+${selected.dial}` : "+") : selected?.name ?? placeholder}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25, ease }} className="text-muted">
          <ChevronDown size={isDial ? 15 : 18} aria-hidden />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.6 }}
            style={{ transformOrigin: "top left" }}
            className={`absolute z-50 mt-2 overflow-hidden rounded-[22px] bg-paper shadow-lift ring-1 ring-line ${
              isDial ? "left-0 w-[min(340px,calc(100vw-2.5rem))]" : "inset-x-0"
            }`}
          >
            <div className="border-b border-line p-2.5">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  ref={input}
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={options[active] ? `${id}-opt-${options[active].code}` : undefined}
                  aria-autocomplete="list"
                  aria-label={isDial ? "Search country or code" : "Search countries"}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKey}
                  placeholder={isDial ? "Search country or +code" : "Search countries"}
                  className="h-10 w-full rounded-xl bg-white pr-3 pl-10 text-[14.5px] ring-1 ring-line outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-forest"
                />
              </div>
            </div>

            <ul
              ref={list}
              id={listId}
              role="listbox"
              data-lenis-prevent
              className="max-h-72 overflow-y-auto overscroll-contain p-1.5"
            >
              {options.length === 0 && <li className="px-3 py-6 text-center text-[14px] text-muted">No country matches “{query}”.</li>}
              {options.map((c, i) => {
                const isSel = c.code === selected?.code;
                const isActive = i === active;
                return (
                  <li key={c.code} role="presentation">
                    {i === 0 && suggestedCount > 0 && <GroupLabel>Suggested</GroupLabel>}
                    {i === suggestedCount && suggestedCount > 0 && <GroupLabel>All countries</GroupLabel>}
                    <div
                      id={`${id}-opt-${c.code}`}
                      role="option"
                      aria-selected={isSel}
                      data-index={i}
                      onPointerMove={() => setActive(i)}
                      onClick={() => choose(c)}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors duration-100 ${
                        isActive ? "bg-sand" : ""
                      }`}
                    >
                      <Flag code={c.code} />
                      <span className={`flex-1 truncate ${isSel ? "font-semibold text-forest-deep" : "text-ink"}`}>{c.name}</span>
                      <span className="text-[13px] text-muted tabular-nums">+{c.dial}</span>
                      <span className="w-4">{isSel && <Check size={16} strokeWidth={2.75} className="text-forest" aria-hidden />}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {!isDial && error && (
        <p role="alert" className="pt-2 text-[13px] font-medium text-[#c2410c]">
          {error}
        </p>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pt-2.5 pb-1 text-[11.5px] font-semibold tracking-wide text-muted uppercase">{children}</p>;
}

export function PhoneField({
  label,
  dialCode,
  onDialChange,
  value,
  onChange,
  error,
}: {
  label: string;
  dialCode: string | null;
  onDialChange: (c: Country) => void;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[14px] font-semibold text-ink">
        {label}
      </label>
      <div
        className={`relative flex h-12 items-stretch rounded-2xl bg-white ring-1 transition-shadow focus-within:ring-2 ${
          error ? "ring-coral focus-within:ring-coral" : "ring-line hover:ring-ink/25 focus-within:ring-forest"
        }`}
      >
        <CountryCombobox variant="dial" value={dialCode} onChange={onDialChange} />
        <span className="my-3 w-px bg-line" aria-hidden />
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d\s()-]/g, ""))}
          placeholder="Phone number"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          className="min-w-0 flex-1 rounded-r-2xl bg-transparent px-3.5 text-[15px] tabular-nums outline-none placeholder:text-ink/35"
        />
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="pt-2 text-[13px] font-medium text-[#c2410c]">
          {error}
        </p>
      )}
    </div>
  );
}
