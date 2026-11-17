"use client";

import { useEffect, useState } from "react";

// ~3,000 ESCO occupation titles (about 75 KB), fetched once, only when a role field is shown.
let cache: string[] | null = null;
let pending: Promise<string[]> | null = null;

function load() {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch("/data/occupations.json")
    .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
    .then((list) => (cache = Array.isArray(list) ? list : []))
    .catch(() => [])
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function useOccupations(): string[] {
  const [list, setList] = useState<string[]>(cache ?? []);
  useEffect(() => {
    let live = true;
    void load().then((l) => live && setList(l));
    return () => {
      live = false;
    };
  }, []);
  return list;
}
