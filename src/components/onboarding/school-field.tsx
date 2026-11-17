"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ChevronDown, GraduationCap, Loader2 } from "lucide-react";
import { countries, countryByCode } from "@/lib/geo/countries";
import { ease } from "@/lib/site";
import { SchoolLogo } from "./school-logo";

type School = { name: string; place: string; domain?: string; qid?: string };

/** Free-text school field with suggestions from /api/schools (Hipo + ROR). Typing your own school always works. */
export function SchoolField({
  label,
  value,
  onChange,
  countryCode,
  error,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  countryCode: string | null;
  error?: string;
  className?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  // "" = the profile country first, then worldwide. Otherwise a country code the user chose to search in.
  const [scope, setScope] = useState("");
  const home = countryCode ? countryByCode.get(countryCode) : undefined;
  const wrap = useRef<HTMLDivElement>(null);
  const picked = useRef<string | null>(null);
  // The school picked from the list (has exact logo hints), and whether the text was edited by hand since.
  const [chosen, setChosen] = useState<School | null>(null);
  const [typed, setTyped] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (picked.current === value) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: value.trim() });
        if (scope) params.set("cc", scope);
        if (countryCode) params.set("home", countryCode);
        const res = await fetch(`/api/schools?${params}`, { signal: ctl.signal });
        const body = res.ok ? ((await res.json()) as { schools: School[] }) : { schools: [] };
        setItems(body.schools);
        setActive(-1);
      } catch {
        if (!ctl.signal.aborted) setItems([]);
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, value.trim() ? 250 : 0);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [value, open, countryCode, scope]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (s: School) => {
    picked.current = s.name;
    setChosen(s);
    setTyped(false);
    onChange(s.name);
    setOpen(false);
  };

  const showList = open;

  return (
    <div className={className} ref={wrap}>
      <label htmlFor={id} className="mb-2 block text-[14px] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={Boolean(error)}
          placeholder="Search or type your school"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            picked.current = null;
            setChosen(null);
            setTyped(true);
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Enter" && showList && active >= 0 && items[active]) {
              e.preventDefault();
              pick(items[active]);
            } else if (e.key === "Escape" && open) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
          className={`h-12 w-full rounded-2xl bg-white pr-11 text-[15px] text-ink ring-1 transition-[box-shadow] duration-200 outline-none placeholder:text-ink/35 focus:ring-2 ${
            value.trim() ? "pl-[3.1rem]" : "pl-4"
          } ${error ? "ring-coral focus:ring-coral" : "ring-line hover:ring-ink/25 focus:ring-forest"}`}
        />
        {value.trim() && (
          <span className="pointer-events-none absolute inset-y-0 left-2.5 grid place-items-center">
            {typed && !chosen ? (
              // While typing by hand, don't look up a logo on every keystroke.
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint/60 text-forest-deep" aria-hidden>
                <GraduationCap size={15} />
              </span>
            ) : (
              <SchoolLogo name={chosen?.name ?? value} qid={chosen?.qid} domain={chosen?.domain} countryCode={countryCode} size={32} />
            )}
          </span>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Hide school suggestions" : "Show school suggestions"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) setOpen(false);
            else {
              setOpen(true);
              document.getElementById(id)?.focus();
            }
          }}
          className="absolute inset-y-0 right-1.5 grid w-9 place-items-center rounded-xl text-muted transition-colors hover:text-ink"
        >
          {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ChevronDown size={17} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />}
        </button>

        <AnimatePresence>
          {showList && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease }}
              className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl bg-paper shadow-lift ring-1 ring-line"
            >
              <div className="flex items-center gap-2 border-b border-line bg-sand/60 px-3 py-2 text-[12.5px] text-muted">
                <label htmlFor={`${id}-scope`} className="shrink-0 font-semibold">
                  Search in
                </label>
                <select
                  id={`${id}-scope`}
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value);
                    document.getElementById(id)?.focus();
                  }}
                  className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1 text-[13px] font-medium text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-forest"
                >
                  <option value="">All countries</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <ul id={listId} role="listbox" className="max-h-[230px] overflow-y-auto overscroll-contain p-1.5" data-lenis-prevent>
                {!scope && !value.trim() && home && items.length > 0 && (
                  <li role="presentation" className="px-2.5 pt-1 pb-1.5 text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">
                    Universities in {home.name}. Type to search all countries.
                  </li>
                )}
              {items.map((s, i) => (
                <li
                  key={s.name}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-[14px] ${i === active ? "bg-mint/70" : ""}`}
                >
                  <SchoolLogo name={s.name} qid={s.qid} domain={s.domain} size={30} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                  {s.place && <span className="max-w-[40%] shrink-0 truncate text-[12px] text-muted">{s.place}</span>}
                </li>
              ))}
              {items.length === 0 && loading && <li className="px-3 py-2 text-[13px] text-muted">Searching…</li>}
              {items.length === 0 && !loading && (
                <li className="px-3 py-2 text-[13px] leading-snug text-muted">
                  {value.trim() ? "No matches. Keep typing: your own school name works too." : "Type the name of your school to search."}
                </li>
              )}
              {items.length > 0 && <li className="px-3 pt-1.5 pb-1 text-[11.5px] text-muted">Not listed? Keep typing the name of your school.</li>}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease }}
            className="flex items-center gap-1.5 overflow-hidden pt-2 text-[13px] font-medium text-[#c2410c]"
          >
            <AlertCircle size={14} aria-hidden className="shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
