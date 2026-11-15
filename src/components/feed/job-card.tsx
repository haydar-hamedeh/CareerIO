"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Building2, Check, Clock, FileCheck2, Globe, MapPin, Users, Wallet } from "lucide-react";
import { AnimatedBookmark, AnimatedChevronDown, useIconTap } from "@/components/animated-icons";
import { setJobSaved } from "@/app/feed/actions";
import { ease } from "@/lib/site";

export type FeedJob = {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  skills: string[];
  matched: string[];
  company: string;
  companySize: string | null;
  companyLocation: string | null;
  companyWebsite: string | null;
  companyDescription: string | null;
  location: string;
  mode: string;
  level: string;
  type: string;
  salary: string | null;
  posted: string;
  isSample: boolean;
  pct: number | null;
  reason: string;
  saved: boolean;
  field: string;
  rawMode: string;
  rawLevel: string;
  publishedAt: number;
  searchText: string;
  ai?: { score: number; reason: string } | null;
  foundBy?: "ai" | null;
  aiWhy?: string | null;
};

type ParsedSection = {
  heading: string | null;
  bullets: string[];
  paragraphs: string[];
};

const palette = ["bg-mint text-forest-deep", "bg-sun/40 text-ink", "bg-coral/15 text-[#b4391f]", "bg-forest text-white", "bg-ink text-sand"];

function tone(pct: number) {
  if (pct >= 70) return { ring: "var(--forest)", text: "text-forest", label: "Strong fit" };
  if (pct >= 40) return { ring: "#d99a1e", text: "text-[#a16207]", label: "Partial fit" };
  return { ring: "var(--coral)", text: "text-[#c2410c]", label: "Stretch" };
}

function parseDescription(description: string, fallbackRequirements: string[]) {
  const blocks = description
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const [intro = "", ...restBlocks] = blocks;
  const sections: ParsedSection[] = [];
  let hasRequirementsSection = false;

  for (const block of restBlocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    let heading: string | null = null;
    let body = lines;

    if (lines[0].endsWith(":") && lines[0].length <= 60) {
      heading = lines[0].slice(0, -1);
      body = lines.slice(1);
      if (heading.toLowerCase().includes("requirement") || heading.toLowerCase().includes("looking for")) {
        hasRequirementsSection = true;
      }
    }

    const bullets: string[] = [];
    const paragraphs: string[] = [];
    for (const line of body) {
      if (line.startsWith("- ")) bullets.push(line.slice(2).trim());
      else paragraphs.push(line);
    }

    sections.push({ heading, bullets, paragraphs });
  }

  if (!hasRequirementsSection && fallbackRequirements.length > 0) {
    sections.push({
      heading: "Requirements",
      bullets: fallbackRequirements,
      paragraphs: [],
    });
  }

  return { intro, sections };
}

export function JobCard({ job, index, canGrade = false }: { job: FeedJob; index: number; canGrade?: boolean }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(job.saved);
  const [, startTransition] = useTransition();
  const expandTap = useIconTap();
  const saveTap = useIconTap();
  const matched = new Set(job.matched.map((s) => s.toLowerCase()));
  const avatar = palette[job.company.length % palette.length];
  const { intro, sections } = parseDescription(job.description, job.requirements);

  const toggleSave = () => {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const res = await setJobSaved(job.id, next);
      if (!res.ok) setSaved(!next);
    });
  };

  const websiteHost = job.companyWebsite ? job.companyWebsite.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;
  const isLiveWebsite = Boolean(job.companyWebsite && !job.companyWebsite.includes(".example."));

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: Math.min(index, 6) * 0.05 }}
      className="rounded-[24px] bg-paper p-5 shadow-soft ring-1 ring-line transition-shadow duration-300 hover:shadow-lift sm:p-6"
    >
      <header className="flex items-start gap-3.5">
        <span aria-hidden className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-extrabold ${avatar}`}>
          {job.company[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-[13.5px] text-muted">
            <span className="font-semibold text-ink">{job.company}</span>
            {job.companySize && <span>· {job.companySize} people</span>}
            <span className="inline-flex items-center gap-1">
              · <Clock size={12} aria-hidden /> {job.posted}
            </span>
          </p>
          <h2 className="mt-0.5 font-display text-[1.2rem] leading-snug font-bold tracking-tight">{job.title}</h2>
        </div>
        {job.pct !== null && <MatchRing pct={job.ai?.score ?? job.pct} ai={Boolean(job.ai)} />}
      </header>

      <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
        <Meta icon={<MapPin size={13} aria-hidden />}>{job.location}</Meta>
        <Meta icon={<Building2 size={13} aria-hidden />}>{job.mode}</Meta>
        <Meta icon={<Briefcase size={13} aria-hidden />}>
          {job.level} · {job.type}
        </Meta>
        {job.salary && <Meta icon={<Wallet size={13} aria-hidden />}>{job.salary}</Meta>}
        {job.foundBy === "ai" && (
          <span className="rounded-full bg-forest/10 px-2.5 py-1 font-semibold text-forest-deep" title="Found by meaning, not exact words.">
            AI found this{job.aiWhy ? ` · ${job.aiWhy}` : ""}
          </span>
        )}
        {job.isSample && (
          <span className="rounded-full bg-ink/[0.05] px-2.5 py-1 font-medium text-muted" title="This listing is sample content.">
            Sample listing
          </span>
        )}
      </div>

      {(job.ai || job.reason) && (
        <div className="mt-4 rounded-2xl bg-sand px-4 py-3 text-[14px] leading-snug">
          <p>
            <span className={`font-bold ${tone(job.ai?.score ?? job.pct ?? 0).text}`}>{tone(job.ai?.score ?? job.pct ?? 0).label}: </span>
            {job.ai ? job.ai.reason : job.reason}
          </p>
          {job.ai && job.reason && <p className="mt-1.5 text-[13px] text-muted">{job.reason}</p>}
        </div>
      )}

      <p className="mt-4 text-[15px] leading-relaxed text-ink/85">{intro}</p>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-5 border-t border-line pt-5">
              {sections.map((sec, idx) => (
                <section key={`${sec.heading ?? "block"}-${idx}`} className="space-y-2">
                  {sec.heading && <h3 className="font-display text-[14.5px] font-bold tracking-tight text-ink">{sec.heading}</h3>}
                  {sec.paragraphs.map((p, pi) => (
                    <p key={pi} className="text-[14.5px] leading-relaxed text-ink/85">
                      {p}
                    </p>
                  ))}
                  {sec.bullets.length > 0 && (
                    <ul className="space-y-1.5 text-[14.5px] leading-relaxed text-ink/85">
                      {sec.bullets.map((b, bi) => (
                        <li key={bi} className="flex items-start gap-2.5">
                          <span className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-mint text-forest-deep" aria-hidden>
                            <Check size={10} strokeWidth={3} />
                          </span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}

              {(job.companyDescription || job.companyLocation || websiteHost) && (
                <section className="rounded-2xl bg-sand/85 p-4 ring-1 ring-line">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-[14.5px] font-bold text-ink">About {job.company}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-muted">
                      {job.companyLocation && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} aria-hidden />
                          {job.companyLocation}
                        </span>
                      )}
                      {job.companySize && (
                        <span className="inline-flex items-center gap-1">
                          <Users size={12} aria-hidden />
                          {job.companySize} people
                        </span>
                      )}
                      {websiteHost &&
                        (isLiveWebsite && job.companyWebsite ? (
                          <a
                            href={job.companyWebsite}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 font-medium text-forest hover:underline"
                          >
                            <Globe size={12} aria-hidden />
                            {websiteHost}
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Globe size={12} aria-hidden />
                            {websiteHost}
                          </span>
                        ))}
                    </div>
                  </div>
                  {job.companyDescription && <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{job.companyDescription}</p>}
                </section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
        {job.skills.map((s) => {
          const has = matched.has(s.toLowerCase());
          return (
            <li
              key={s}
              className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${
                has ? "bg-forest text-white" : "bg-white text-ink/70 ring-1 ring-line"
              }`}
            >
              {s}
              {has && <span className="sr-only"> (you have this)</span>}
            </li>
          );
        })}
      </ul>

      <footer className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <motion.button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          whileTap={{ scale: 0.97 }}
          {...expandTap}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-semibold text-forest transition-colors hover:bg-mint/60"
        >
          {open ? "Show less" : "See full job"}
          <AnimatedChevronDown size={16} open={open} />
        </motion.button>
        <div className="flex items-center gap-2">
        {canGrade && (
          <Link
            href={`/grader?job=${job.id}`}
            className="group hidden items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold text-ink ring-1 ring-line transition-colors hover:bg-mint/50 hover:ring-forest/30 sm:inline-flex"
          >
            <FileCheck2 size={15} className="text-forest transition-transform group-hover:-rotate-6" aria-hidden />
            Grade my CV for this
          </Link>
        )}
        <motion.button
          type="button"
          onClick={toggleSave}
          aria-pressed={saved}
          whileTap={{ scale: 0.95 }}
          {...saveTap}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors duration-200 ${
            saved ? "bg-forest text-white" : "bg-white text-ink ring-1 ring-line hover:ring-ink/25"
          }`}
        >
          <AnimatedBookmark size={15} filled={saved} />
          {saved ? "Saved" : "Save"}
        </motion.button>
        </div>
      </footer>
    </motion.article>
  );
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-ink/80 ring-1 ring-line">
      {icon}
      {children}
    </span>
  );
}

function MatchRing({ pct, ai = false }: { pct: number; ai?: boolean }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const t = tone(pct);
  return (
    <div className="relative grid h-14 w-14 shrink-0 place-items-center" title={ai ? `AI match: ${pct}%` : `Quick match: ${pct}%`}>
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <motion.circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={t.ring}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 1.1, ease, delay: 0.2 }}
        />
      </svg>
      <span className="absolute font-display text-[13px] font-extrabold tabular-nums">
        {pct}%<span className="sr-only">{ai ? " AI match" : " match"}</span>
      </span>
      {ai && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 20 }}
          className="absolute -right-1 -bottom-1 rounded-full bg-forest px-1.5 py-px font-display text-[9.5px] font-extrabold tracking-wide text-white ring-2 ring-paper"
          aria-hidden
        >
          AI
        </motion.span>
      )}
    </div>
  );
}
