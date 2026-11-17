import "server-only";

// Simple fixed-window limiter, kept in memory per server instance.
// Good enough for a single-region demo; swap for a shared store (e.g. Upstash) when scaling out.
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  b.count++;
  return { ok: true, retryAfter: 0 };
}

export const limits = {
  search: { limit: 40, windowMs: 60_000 },
  match: { limit: 12, windowMs: 60 * 60_000 },
  grade: { limit: 8, windowMs: 60 * 60_000 },
  chance: { limit: 15, windowMs: 60 * 60_000 },
  // Recruiters re-running an application review by hand (the first review runs automatically when someone applies).
  review: { limit: 30, windowMs: 60 * 60_000 },
  // Chat messages per person: enough for a real conversation, too few for spam.
  message: { limit: 40, windowMs: 60_000 },
  // School search: typeahead fires on each keystroke (debounced), so this is generous.
  schools: { limit: 90, windowMs: 60_000 },
  // School logos: up to ~40 images per dropdown, cached by the browser for a week.
  logos: { limit: 400, windowMs: 60_000 },
} as const;
