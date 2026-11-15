"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, CornerDownLeft, Search } from "lucide-react";
import type { Option } from "@/lib/onboarding/education";
import { ease } from "@/lib/site";

type Item = { kind: "custom"; value: string } | { kind: "option"; value: string; group: string };

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
  error?: string;
};

export function SearchSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Search",
  allowCustom = true,
  error,
}: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = options
      .filter((o) => !q || o.value.toLowerCase().includes(q) || o.group.toLowerCase().includes(q))
      .sort((a, b) => (q ? Number(!a.value.toLowerCase().startsWith(q)) - Number(!b.value.toLowerCase().startsWith(q)) : 0))
      .map<Item>((o) => ({ kind: "option", ...o }));
    const exact = options.some((o) => o.value.toLowerCase() === q);
    const custom = allowCustom && query.trim().length >= 2 && !exact;
    if (!custom) return matches;
    const own: Item = { kind: "custom", value: query.trim().replace(/\s+/g, " ") };
    return matches.length ? [...matches, own] : [own];
  }, [options, query, allowCustom]);

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
    setQuery("");
    const i = options.findIndex((o) => o.value === value);
    setActive(Math.max(0, i));
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  };

  const choose = (v: string) => {
    onChange(v.slice(0, 120));
    setOpen(false);
    trigger.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const last = items.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(last, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) choose(items[active].value);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") trigger.current?.focus();
    }
  };

  return (
    <div ref={root} className={`relative ${open ? "z-30" : ""}`}>
      <span id={`${id}-label`} className="mb-2 block text-[14px] font-semibold text-ink">
        {label}
      </span>
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
        aria-labelledby={`${id}-label ${id}-value`}
        aria-describedby={error ? `${id}-err` : undefined}
        className={`group flex h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-[15px] ring-1 transition-shadow outline-none focus-visible:ring-2 ${
          error ? "ring-coral" : open ? "ring-2 ring-forest" : "ring-line hover:ring-ink/25 focus-visible:ring-forest"
        }`}
      >
        <span id={`${id}-value`} className={`flex-1 truncate ${value ? "text-ink" : "text-ink/40"}`}>
          {value || placeholder}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25, ease }} className="text-muted">
          <ChevronDown size={18} aria-hidden />
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
            className="absolute left-0 z-50 mt-2 w-full min-w-[min(320px,calc(100vw-2.5rem))] overflow-hidden rounded-[22px] bg-paper shadow-lift ring-1 ring-line"
          >
            <div className="border-b border-line p-2.5">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  ref={input}
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={items[active] ? `${id}-opt-${active}` : undefined}
                  aria-autocomplete="list"
                  aria-label={`Search ${label.toLowerCase()}`}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKey}
                  placeholder={searchPlaceholder}
                  className="h-10 w-full rounded-xl bg-white pr-3 pl-10 text-[14.5px] ring-1 ring-line outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-forest"
                />
              </div>
            </div>

            <ul ref={list} id={listId} role="listbox" data-lenis-prevent className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
              {items.length === 0 && (
                <li className="px-3 py-6 text-center text-[14px] text-muted">
                  {allowCustom ? "Type at least 2 letters to add your own." : "No matches."}
                </li>
              )}
              {items.map((item, i) => {
                const prev = items[i - 1];
                const header =
                  item.kind === "option" && !query.trim() && (!prev || prev.kind !== "option" || prev.group !== item.group)
                    ? item.group
                    : null;
                const isSel = item.kind === "option" && item.value === value;
                return (
                  <li key={`${item.kind}-${item.value}`} role="presentation">
                    {header && <p className="px-3 pt-2.5 pb-1 text-[11.5px] font-semibold tracking-wide text-muted uppercase">{header}</p>}
                    <div
                      id={`${id}-opt-${i}`}
                      role="option"
                      aria-selected={isSel}
                      data-index={i}
                      onPointerMove={() => setActive(i)}
                      onClick={() => choose(item.value)}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors duration-100 ${
                        i === active ? "bg-sand" : ""
                      }`}
                    >
                      {item.kind === "custom" ? (
                        <>
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-mint text-forest">
                            <CornerDownLeft size={13} strokeWidth={2.5} aria-hidden />
                          </span>
                          <span className="flex-1 truncate">
                            Use <span className="font-semibold text-forest-deep">“{item.value}”</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={`min-w-0 flex-1 leading-snug ${isSel ? "font-semibold text-forest-deep" : "text-ink"}`}>
                            {item.value}
                            {query.trim() && <span className="block text-[12px] font-normal text-muted">{item.group}</span>}
                          </span>
                          <span className="w-4">{isSel && <Check size={16} strokeWidth={2.75} className="text-forest" aria-hidden />}</span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p id={`${id}-err`} role="alert" className="pt-2 text-[13px] font-medium text-[#c2410c]">
          {error}
        </p>
      )}
    </div>
  );
}
