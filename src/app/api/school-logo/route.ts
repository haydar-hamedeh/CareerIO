import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { limits, rateLimit } from "@/lib/ai/rate-limit";

// Logo for a school, served from our own origin so the browser never talks to third parties.
// Order: Wikidata "logo image" (P154, hosted on Wikimedia Commons) -> the school website's favicon -> 404 (UI shows initials).
// Hints: qid (Wikidata id) and/or domain. With only a name, ROR resolves it, preferring the user's own country.

const UA = { "user-agent": "CareerIO/0.1 (school logo lookup)" };
const WEEK = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 300_000;
const OK_TYPES = /^image\/(png|jpe?g|webp|gif)/;

const logoFileCache = new Map<string, { at: number; file: string | null }>();
const nameCache = new Map<string, { at: number; qid: string | null; domain: string | null }>();

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const hostOf = (url?: string) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};

async function getImage(url: string) {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(5000), cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !OK_TYPES.test(type)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return { buf, type: type.split(";")[0] };
  } catch {
    return null;
  }
}

async function logoFile(qid: string) {
  const hit = logoFileCache.get(qid);
  if (hit && Date.now() - hit.at < WEEK) return hit.file;
  let file: string | null = null;
  try {
    const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${qid}&property=P154&format=json`, {
      headers: UA,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { claims?: { P154?: { mainsnak?: { datavalue?: { value?: string } } }[] } };
      const v = json.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
      file = typeof v === "string" ? v : null;
    }
  } catch {
    return hit?.file ?? null;
  }
  logoFileCache.set(qid, { at: Date.now(), file });
  return file;
}

async function resolveName(name: string, cc: string | null) {
  const key = `${cc ?? ""}|${norm(name)}`;
  const hit = nameCache.get(key);
  if (hit && Date.now() - hit.at < WEEK) return hit;
  const want = norm(name);
  const attempt = async (country: string | null) => {
    const url = new URL("https://api.ror.org/v2/organizations");
    url.searchParams.set("query", name);
    url.searchParams.set("filter", ["types:education", country ? `locations.geonames_details.country_code:${country}` : ""].filter(Boolean).join(","));
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(5000), cache: "no-store" });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        items?: {
          names: { value: string }[];
          links?: { type: string; value: string }[];
          external_ids?: { type: string; all?: string[]; preferred?: string | null }[];
        }[];
      };
      // Only accept an exact name match, so a similar-sounding school never lends its logo.
      const item = (json.items ?? []).find((i) => i.names.some((n) => norm(n.value) === want));
      if (!item) return null;
      const wd = item.external_ids?.find((e) => e.type === "wikidata");
      return { qid: wd?.preferred ?? wd?.all?.[0] ?? null, domain: hostOf(item.links?.find((l) => l.type === "website")?.value) };
    } catch {
      return null;
    }
  };
  const found = (cc ? await attempt(cc) : null) ?? (await attempt(null)) ?? { qid: null, domain: null };
  const value = { at: Date.now(), ...found };
  nameCache.set(key, value);
  return value;
}

const miss = () => new NextResponse(null, { status: 404, headers: { "cache-control": "private, max-age=3600" } });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse(null, { status: 401 });
  if (!rateLimit(`logos:${auth.user.id}`, limits.logos.limit, limits.logos.windowMs).ok) return new NextResponse(null, { status: 429 });

  const sp = request.nextUrl.searchParams;
  let qid = /^Q\d{1,12}$/.test(sp.get("qid") ?? "") ? (sp.get("qid") as string) : null;
  let domain = /^[a-z0-9]([a-z0-9.-]{1,98})[a-z0-9]$/i.test(sp.get("domain") ?? "") ? (sp.get("domain") as string).toLowerCase() : null;
  const name = (sp.get("name") ?? "").trim().slice(0, 140);
  const ccRaw = (sp.get("cc") ?? "").toUpperCase();
  const cc = /^[A-Z]{2}$/.test(ccRaw) ? ccRaw : null;

  if (!qid && !domain) {
    if (name.length < 3) return miss();
    const r = await resolveName(name, cc);
    qid = r.qid;
    domain = r.domain;
  }

  let img: { buf: ArrayBuffer; type: string } | null = null;
  if (qid) {
    const file = await logoFile(qid);
    if (file) img = await getImage(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=96`);
  }
  if (!img && domain) {
    img = await getImage(
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`https://${domain}`)}&size=64`,
    );
  }
  if (!img) return miss();

  return new NextResponse(img.buf, {
    headers: {
      "content-type": img.type,
      "cache-control": "private, max-age=604800",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
