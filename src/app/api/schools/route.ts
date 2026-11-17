import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { limits, rateLimit } from "@/lib/ai/rate-limit";
import { countryByCode } from "@/lib/geo/countries";

// School and university search. Two open sources, merged:
//  - Hipo Universities list (per country, cached for a day, instant substring match)
//  - ROR, the Research Organization Registry (live search, prefix match, worldwide)
// Either can be down; the field also accepts free typing, so failures only mean fewer suggestions.

// domain and qid (Wikidata id) are hints for the logo endpoint; either may be missing.
type School = { name: string; place: string; domain?: string; qid?: string };

const hostOf = (url?: string) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : undefined;
  } catch {
    return undefined;
  }
};

const DAY = 24 * 60 * 60 * 1000;
const hipoCache = new Map<string, { at: number; list: School[] }>();

async function hipoCountry(countryName: string): Promise<School[]> {
  const hit = hipoCache.get(countryName);
  if (hit && Date.now() - hit.at < DAY) return hit.list;
  try {
    const res = await fetch(`http://universities.hipolabs.com/search?country=${encodeURIComponent(countryName)}`, {
      signal: AbortSignal.timeout(4000),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return hit?.list ?? [];
    const rows = (await res.json()) as { name?: string; country?: string; domains?: string[]; web_pages?: string[] }[];
    const list = rows
      .filter((r) => r.name)
      .map((r) => ({ name: String(r.name).trim(), place: r.country ?? countryName, domain: r.domains?.[0] ?? hostOf(r.web_pages?.[0]) }));
    hipoCache.set(countryName, { at: Date.now(), list });
    return list;
  } catch {
    return hit?.list ?? [];
  }
}

async function ror(q: string, cc: string | null): Promise<School[]> {
  const tokens = q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 5);
  if (tokens.length === 0) return [];
  const url = new URL("https://api.ror.org/v2/organizations");
  url.searchParams.set("query.advanced", tokens.map((t, i) => `names.value:${t}${i === tokens.length - 1 ? "*" : ""}`).join(" AND "));
  url.searchParams.set("filter", ["types:education", cc ? `locations.geonames_details.country_code:${cc}` : ""].filter(Boolean).join(","));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      items?: {
        names: { value: string; types: string[] }[];
        locations?: { geonames_details?: { name?: string; country_name?: string } }[];
        links?: { type: string; value: string }[];
        external_ids?: { type: string; all?: string[]; preferred?: string | null }[];
      }[];
    };
    return (json.items ?? []).slice(0, 8).flatMap((i) => {
      const name = i.names.find((n) => n.types.includes("ror_display"))?.value;
      if (!name) return [];
      const g = i.locations?.[0]?.geonames_details;
      const wd = i.external_ids?.find((e) => e.type === "wikidata");
      return [
        {
          name,
          place: [g?.name, g?.country_name].filter(Boolean).join(", "),
          domain: hostOf(i.links?.find((l) => l.type === "website")?.value),
          qid: wd?.preferred ?? wd?.all?.[0] ?? undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const SMALL = new Set(["of", "the", "and", "for", "de", "du", "des", "la", "le", "al", "el"]);
/** "Lebanese American University" -> "lau", so people can type the abbreviation they know. */
const acronym = (name: string) =>
  norm(name)
    .split(" ")
    .filter((w) => w && !SMALL.has(w))
    .map((w) => w[0])
    .join("");

export async function GET(request: NextRequest) {
  try {
    return await search(request);
  } catch (e) {
    console.error("[api/schools]", e);
    return NextResponse.json({ schools: [] });
  }
}

async function search(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const rl = rateLimit(`schools:${auth.user.id}`, limits.schools.limit, limits.schools.windowMs);
  if (!rl.ok) return NextResponse.json({ schools: [] }, { status: 429 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  // cc = the country the user chose to search in (a hard filter). home = their profile country, used only
  // to rank first when no country is chosen: people study abroad, so results are never limited to it.
  const pick = (key: string) => {
    const raw = (request.nextUrl.searchParams.get(key) ?? "").toUpperCase();
    return /^[A-Z]{2}$/.test(raw) ? countryByCode.get(raw) : undefined;
  };
  const filter = pick("cc");
  const home = pick("home");
  const focus = filter ?? home;
  if (!focus && q.length < 3) return NextResponse.json({ schools: [] });

  const nq = norm(q);
  const [local, remote, remoteHome] = await Promise.all([
    focus ? hipoCountry(focus.name) : Promise.resolve([] as School[]),
    q.length >= 2 ? ror(q, filter?.code ?? null) : Promise.resolve([] as School[]),
    // With no country chosen, also ask ROR inside the home country so acronyms like "LIU" find the local school first.
    q.length >= 2 && !filter && home ? ror(q, home.code) : Promise.resolve([] as School[]),
  ]);

  const compact = nq.replace(/ /g, "");
  const isAcronym = (s: School) => compact.length >= 2 && acronym(s.name) === compact;
  const localMatches = local
    .filter((s) => !nq || norm(s.name).includes(nq) || isAcronym(s))
    .sort(
      (a, b) =>
        Number(!isAcronym(a)) - Number(!isAcronym(b)) ||
        Number(!norm(a.name).startsWith(nq)) - Number(!norm(b.name).startsWith(nq)) ||
        a.name.localeCompare(b.name),
    );

  // Merge sources by name, keeping the first position but filling in missing logo hints from later duplicates.
  const merged = new Map<string, School>();
  for (const s of [...localMatches, ...remoteHome, ...remote]) {
    const k = norm(s.name);
    const have = merged.get(k);
    if (!have) merged.set(k, { ...s });
    else {
      have.domain ??= s.domain;
      have.qid ??= s.qid;
    }
  }
  const schools = [...merged.values()].slice(0, nq ? 8 : 40);
  return NextResponse.json({ schools });
}
