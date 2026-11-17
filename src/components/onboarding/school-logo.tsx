"use client";

import { useState } from "react";

const tiles = ["bg-mint text-forest-deep", "bg-sun/40 text-ink", "bg-coral/15 text-[#b4391f]", "bg-forest text-white", "bg-ink text-sand"];
const SMALL = new Set(["of", "the", "and", "for", "de", "du", "des", "la", "le", "al", "el", "university", "college", "school"]);

function initialsOf(name: string) {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const sig = words.filter((w) => !SMALL.has(w.toLowerCase()));
  const pool = sig.length ? sig : words;
  return pool
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * A school's logo from /api/school-logo (Wikimedia logo, else the school's favicon).
 * Falls back to a colored initials tile when no logo exists. Pass qid/domain when known; otherwise the name is resolved.
 */
export function SchoolLogo({
  name,
  qid,
  domain,
  countryCode,
  size = 28,
  className = "",
}: {
  name: string;
  qid?: string;
  domain?: string;
  countryCode?: string | null;
  size?: number;
  className?: string;
}) {
  const params = new URLSearchParams();
  if (qid) params.set("qid", qid);
  if (domain) params.set("domain", domain);
  if (!qid && !domain) {
    params.set("name", name);
    if (countryCode) params.set("cc", countryCode);
  }
  const src = `/api/school-logo?${params}`;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const dim = { width: size, height: size };

  if (!name.trim() || failedSrc === src) {
    const tile = tiles[(name.length + (name.charCodeAt(0) || 0)) % tiles.length];
    return (
      <span
        aria-hidden
        style={{ ...dim, fontSize: Math.max(10, Math.round(size * 0.38)) }}
        className={`grid shrink-0 place-items-center rounded-lg font-display font-extrabold ${tile} ${className}`}
      >
        {initialsOf(name) || "·"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      style={dim}
      onError={() => setFailedSrc(src)}
      className={`shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-line ${className}`}
    />
  );
}
