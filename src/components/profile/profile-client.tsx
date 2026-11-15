"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  FileCheck2,
  GraduationCap,
  Laptop,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Repeat2,
  X,
} from "lucide-react";
import { FormAlert } from "@/components/auth/fields";
import { Flag } from "@/components/onboarding/country-combobox";
import { SectionFields, stateFromRow, toPayload, type ProfileRow, type ProfileState, type SectionKey } from "@/components/onboarding/sections";
import { updateProfileSection, type CvItem } from "@/app/profile/actions";
import {
  basicsSchema,
  educationSchema,
  experienceSchema,
  fieldErrors,
  preferencesSchema,
  seniorityLabel,
  skillsSchema,
  workModeLabel,
} from "@/lib/onboarding/schema";
import { countryByCode } from "@/lib/geo/countries";
import { ease } from "@/lib/site";
import { CvManager } from "./cv-manager";

const sections = {
  basics: { title: "About you", schema: basicsSchema },
  experience: { title: "Experience", schema: experienceSchema },
  education: { title: "Education", schema: educationSchema },
  skills: { title: "Skills & languages", schema: skillsSchema },
  preferences: { title: "What you want", schema: preferencesSchema },
} as const;

type Grade = { score: number; target: string; createdAt: string } | null;

function checklist(s: ProfileState) {
  return [
    { label: "Headline", done: Boolean(s.basics.headline), section: "basics" as SectionKey },
    { label: "Phone number", done: Boolean(s.basics.phone), section: "basics" as SectionKey },
    { label: "City and country", done: Boolean(s.basics.city && s.basics.countryCode), section: "basics" as SectionKey },
    { label: "Your level", done: Boolean(s.experience.seniority), section: "experience" as SectionKey },
    { label: "At least one position", done: s.experience.positions.length > 0, section: "experience" as SectionKey },
    { label: "Education", done: s.education.education.length > 0, section: "education" as SectionKey },
    { label: "5 or more skills", done: s.skills.skills.length >= 5, section: "skills" as SectionKey },
    { label: "A language", done: s.skills.languages.length > 0, section: "skills" as SectionKey },
    { label: "Roles you want", done: s.preferences.desiredRoles.length > 0, section: "preferences" as SectionKey },
    { label: "Work mode", done: s.preferences.workModes.length > 0, section: "preferences" as SectionKey },
  ];
}

const monthLabel = (ym: string) => {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};

export function ProfileClient({
  userId,
  email,
  fullName,
  row,
  cvs,
  demand,
  grade,
}: {
  userId: string;
  email: string;
  fullName: string;
  row: ProfileRow | null;
  cvs: CvItem[];
  demand: Record<string, number>;
  grade: Grade;
}) {
  const [state, setState] = useState(() => stateFromRow(fullName, row));
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const [savedFlash, setSavedFlash] = useState<SectionKey | null>(null);

  const items = checklist(state);
  const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  const next = items.find((i) => !i.done);
  const country = state.basics.countryCode ? countryByCode.get(state.basics.countryCode) : undefined;
  const dial = state.basics.dialCode ? countryByCode.get(state.basics.dialCode)?.dial : undefined;
  const initials = state.basics.fullName.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  const skillsByDemand = [...state.skills.skills].sort((a, b) => (demand[b] ?? 0) - (demand[a] ?? 0));

  const onSaved = (key: SectionKey, next: ProfileState) => {
    setState(next);
    setEditing(null);
    setSavedFlash(key);
    setTimeout(() => setSavedFlash((k) => (k === key ? null : k)), 2200);
  };

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:py-10">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="grain relative overflow-hidden rounded-[32px] bg-ink p-6 text-sand sm:p-9"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="animate-drift absolute -top-24 -right-16 h-80 w-80 rounded-full bg-forest/50 blur-3xl" />
          <div className="animate-drift-slow absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-sun/15 blur-3xl" />
        </div>

        <div className="relative grid items-center gap-7 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="relative w-fit">
            <motion.div
              initial={{ rotate: -14, scale: 0.8, opacity: 0 }}
              animate={{ rotate: -5, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 14, delay: 0.15 }}
              whileHover={{ rotate: 0, scale: 1.03 }}
              className="grid h-28 w-28 place-items-center rounded-[30px] bg-mint font-display text-[2.6rem] font-extrabold tracking-tight text-forest-deep shadow-lift sm:h-32 sm:w-32"
            >
              {initials}
            </motion.div>
            <span className="absolute -right-3 -bottom-2 rounded-full bg-sun px-2.5 py-1 font-display text-[11.5px] font-extrabold text-ink ring-4 ring-ink">
              Open to work
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold tracking-[0.14em] text-mint/80 uppercase">Career profile</p>
            <h1 className="mt-1.5 font-display text-[clamp(2.1rem,5vw,3.4rem)] leading-[1.02] font-extrabold tracking-[-0.035em]">
              {state.basics.fullName}
            </h1>
            <p className="mt-2 max-w-xl text-[17px] text-sand/75">{state.basics.headline || "Add a headline that says what you do"}</p>
            <ul className="mt-5 flex flex-wrap gap-2 text-[13.5px]">
              {country && (
                <HeroPill>
                  <Flag code={country.code} />
                  {[state.basics.city, country.name].filter(Boolean).join(", ")}
                </HeroPill>
              )}
              {state.experience.seniority && (
                <HeroPill>
                  {seniorityLabel[state.experience.seniority]} · {state.experience.yearsExperience || 0} yrs
                </HeroPill>
              )}
              {state.preferences.workModes.map((m) => (
                <HeroPill key={m}>{workModeLabel[m]}</HeroPill>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-4 rounded-[26px] bg-white/[0.06] p-4 ring-1 ring-white/10 md:flex-col md:p-5 md:text-center">
            <StrengthRing pct={pct} />
            <div className="md:w-40">
              <p className="font-display text-[15px] font-bold">Profile strength</p>
              {next ? (
                <button
                  type="button"
                  onClick={() => setEditing(next.section)}
                  className="group mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-mint hover:underline"
                >
                  Next: {next.label.toLowerCase()}
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              ) : (
                <p className="mt-1 text-[13px] text-mint">Complete. Nice work.</p>
              )}
            </div>
          </div>
        </div>

        {state.preferences.desiredRoles.length > 0 && (
          <div className="relative mt-7 flex flex-wrap items-center gap-2 border-t border-white/10 pt-5">
            <span className="mr-1 text-[12.5px] font-semibold tracking-[0.14em] text-sand/50 uppercase">Looking for</span>
            {state.preferences.desiredRoles.map((r, i) => (
              <motion.span
                key={r}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.05, duration: 0.4, ease }}
                className="rounded-full bg-sand px-3.5 py-1.5 font-display text-[13.5px] font-bold text-ink"
              >
                {r}
              </motion.span>
            ))}
          </div>
        )}
      </motion.section>

      {/* Bento */}
      <div className="mt-4 grid gap-4 lg:grid-flow-dense lg:grid-cols-12">
        <Tile label="Journey" tone="forest" onEdit={() => setEditing("experience")} flash={savedFlash === "experience"} className="lg:col-span-7 lg:row-span-2" delay={0.05}>
          <Journey state={state} onAdd={() => setEditing("experience")} />
        </Tile>

        <Tile label="Toolkit" tone="sun" onEdit={() => setEditing("skills")} flash={savedFlash === "skills"} className="lg:col-span-5" delay={0.1}>
          {skillsByDemand.length ? (
            <>
              <ul className="flex flex-wrap gap-2">
                {skillsByDemand.map((s, i) => (
                  <motion.li
                    key={s}
                    initial={{ opacity: 0, scale: 0.85 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.03 * i, type: "spring", stiffness: 420, damping: 26 }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white py-1.5 pr-1.5 pl-3.5 text-[13.5px] font-semibold ring-1 ring-line"
                  >
                    {s}
                    <span
                      className={`rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums ${
                        (demand[s] ?? 0) > 0 ? "bg-forest text-white" : "bg-ink/[0.06] text-muted"
                      }`}
                      title={`${demand[s] ?? 0} open jobs ask for ${s}`}
                    >
                      {demand[s] ?? 0}
                    </span>
                  </motion.li>
                ))}
              </ul>
              <p className="mt-3 text-[12.5px] text-muted">Numbers show how many open jobs on CareerIO ask for each skill.</p>
            </>
          ) : (
            <EmptyHint onClick={() => setEditing("skills")}>Add your skills so we can match you.</EmptyHint>
          )}
          {state.skills.languages.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-[12.5px] font-semibold text-muted">Speaks</p>
              <p className="mt-1 font-display text-[16px] font-bold">{state.skills.languages.join(" · ")}</p>
            </div>
          )}
        </Tile>

        <Tile label="What you want" tone="coral" onEdit={() => setEditing("preferences")} flash={savedFlash === "preferences"} className="lg:col-span-5" delay={0.15}>
          <div className="grid grid-cols-3 gap-2">
            {(["onsite", "hybrid", "remote"] as const).map((m) => {
              const on = state.preferences.workModes.includes(m);
              const Icon = m === "onsite" ? Building2 : m === "hybrid" ? Repeat2 : Laptop;
              return (
                <div
                  key={m}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-[12.5px] font-semibold transition-colors ${
                    on ? "bg-forest text-white" : "bg-white text-muted ring-1 ring-line"
                  }`}
                >
                  <Icon size={18} aria-hidden />
                  {workModeLabel[m]}
                  <span className="sr-only">{on ? "(yes)" : "(no)"}</span>
                </div>
              );
            })}
          </div>
          <dl className="mt-4 space-y-2.5 text-[14px]">
            <Row label="Places">{state.preferences.preferredLocations.join(", ") || "Anywhere"}</Row>
            <Row label="Salary">
              {state.preferences.salaryMin || state.preferences.salaryMax
                ? `$${state.preferences.salaryMin || "?"}–$${state.preferences.salaryMax || "?"} / year`
                : "Not shared"}
            </Row>
          </dl>
        </Tile>

        <Tile label="Education" tone="forest" onEdit={() => setEditing("education")} flash={savedFlash === "education"} className="lg:col-span-7" delay={0.2}>
          {state.education.education.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {state.education.education.map((e, i) => (
                <li key={i} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint text-forest">
                    <GraduationCap size={18} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[15px] leading-snug font-bold">{[e.degree, e.field].filter(Boolean).join(" in ")}</p>
                    <p className="mt-0.5 truncate text-[13.5px] text-muted">{e.school}</p>
                    {(e.startYear || e.endYear) && <p className="mt-1 text-[12.5px] font-semibold text-forest">{[e.startYear, e.endYear].filter(Boolean).join(" – ")}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint onClick={() => setEditing("education")}>Add a degree, diploma or course.</EmptyHint>
          )}
        </Tile>

        <div className="space-y-4 lg:col-span-5 lg:row-span-2">
          {grade && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease }}
              className="flex items-center gap-4 rounded-[28px] bg-forest p-5 text-white"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 font-display text-xl font-extrabold tabular-nums">{grade.score}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold tracking-[0.14em] text-white/60 uppercase">Last CV grade</p>
                <p className="truncate font-display font-bold">{grade.target}</p>
              </div>
              <Link href="/grader" className="grid h-10 w-10 place-items-center rounded-full bg-white/15 transition-colors hover:bg-white/25" aria-label="Open CV Grader">
                <ArrowUpRight size={18} aria-hidden />
              </Link>
            </motion.div>
          )}
          <CvManager userId={userId} initial={cvs} />
          {!grade && cvs.length > 0 && (
            <Link
              href="/grader"
              className="group flex items-center gap-3 rounded-[24px] bg-paper p-4 ring-1 ring-line transition-shadow hover:shadow-soft"
            >
              <FileCheck2 size={20} className="text-forest" aria-hidden />
              <span className="flex-1 font-semibold">Grade your CV for the role you want</span>
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          )}
        </div>

        <Tile label="Contact · private" tone="ink" onEdit={() => setEditing("basics")} flash={savedFlash === "basics"} className="lg:col-span-7" delay={0.25}>
          <dl className="grid gap-3 sm:grid-cols-3">
            <ContactItem icon={<Phone size={16} aria-hidden />} label="Phone">
              {state.basics.phone ? `+${dial ?? ""} ${state.basics.phone}` : "—"}
            </ContactItem>
            <ContactItem icon={<Mail size={16} aria-hidden />} label="Email">
              {email}
            </ContactItem>
            <ContactItem icon={<MapPin size={16} aria-hidden />} label="City">
              {state.basics.city || "—"}
            </ContactItem>
          </dl>
          <p className="mt-4 flex items-center gap-2 text-[12.5px] text-muted">
            <Lock size={13} aria-hidden /> Only shared with employers you apply to. Never used to rank you.
          </p>
        </Tile>

        <Tile label="Checklist" tone="sun" className="lg:col-span-7" delay={0.3}>
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {items.map((it) => (
              <li key={it.label}>
                <button
                  type="button"
                  onClick={() => !it.done && setEditing(it.section)}
                  disabled={it.done}
                  className="group flex w-full items-center gap-2.5 rounded-xl py-1.5 text-left text-[14px] disabled:cursor-default"
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors ${
                      it.done ? "bg-forest text-white" : "ring-1 ring-ink/25 ring-inset group-hover:bg-mint"
                    }`}
                  >
                    {it.done && <Check size={12} strokeWidth={3.5} aria-hidden />}
                  </span>
                  <span className={it.done ? "text-muted line-through decoration-ink/20" : "font-semibold text-ink group-hover:text-forest"}>{it.label}</span>
                  {!it.done && <span className="ml-auto text-[12.5px] font-semibold text-forest opacity-0 transition-opacity group-hover:opacity-100">Add</span>}
                </button>
              </li>
            ))}
          </ul>
        </Tile>
      </div>

      <EditDrawer
        sectionKey={editing}
        state={state}
        onClose={() => setEditing(null)}
        onSaved={onSaved}
      />
    </div>
  );
}

function HeroPill({ children }: { children: React.ReactNode }) {
  return <li className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 font-medium text-sand/90 ring-1 ring-white/10">{children}</li>;
}

function StrengthRing({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <motion.circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="var(--mint)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 1.2, ease, delay: 0.3 }}
        />
      </svg>
      <span className="absolute font-display text-lg font-extrabold tabular-nums">{pct}%</span>
    </div>
  );
}

const toneDot = { forest: "bg-forest", sun: "bg-sun", coral: "bg-coral", ink: "bg-ink" } as const;

function Tile({
  label,
  tone,
  onEdit,
  flash,
  className = "",
  delay = 0,
  children,
}: {
  label: string;
  tone: keyof typeof toneDot;
  onEdit?: () => void;
  flash?: boolean;
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.55, ease, delay }}
      className={`relative rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-6 ${className}`}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-[12.5px] font-bold tracking-[0.14em] text-muted uppercase">
          <span className={`h-2 w-2 rounded-full ${toneDot[tone]}`} aria-hidden />
          {label}
        </h2>
        <AnimatePresence mode="wait" initial={false}>
          {flash ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              role="status"
              className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[12.5px] font-bold text-forest-deep"
            >
              <Check size={13} strokeWidth={3} aria-hidden /> Saved
            </motion.span>
          ) : (
            onEdit && (
              <motion.button
                key="edit"
                type="button"
                onClick={onEdit}
                whileTap={{ scale: 0.9 }}
                aria-label={`Edit ${label.replace(" · private", "").toLowerCase()}`}
                className="group grid h-9 w-9 place-items-center rounded-full text-muted ring-1 ring-line transition-colors hover:bg-mint/60 hover:text-forest"
              >
                <Pencil size={15} className="transition-transform duration-300 group-hover:-rotate-12" aria-hidden />
              </motion.button>
            )
          )}
        </AnimatePresence>
      </header>
      {children}
    </motion.section>
  );
}

function Journey({ state, onAdd }: { state: ProfileState; onAdd: () => void }) {
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const positions = state.experience.positions;

  if (!positions.length) {
    return (
      <div>
        <p className="font-display text-2xl font-extrabold tracking-tight">Your story starts here.</p>
        <p className="mt-2 max-w-md text-muted">Add roles, internships, freelance or volunteer work. Employers read this first.</p>
        <button type="button" onClick={onAdd} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 font-semibold text-white">
          Add a position <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <ol ref={ref} className="relative">
      <motion.span
        aria-hidden
        className="absolute top-2 bottom-2 left-[5px] w-[2px] origin-top rounded-full bg-mint"
        initial={reduce ? false : { scaleY: 0 }}
        animate={inView ? { scaleY: 1 } : undefined}
        transition={{ duration: 1, ease }}
      />
      {positions.map((p, i) => {
        const startY = p.start.slice(0, 4);
        const endY = p.current ? "Now" : p.end.slice(0, 4);
        return (
          <motion.li
            key={i}
            initial={reduce ? false : { opacity: 0, x: -10 }}
            animate={inView ? { opacity: 1, x: 0 } : undefined}
            transition={{ duration: 0.5, ease, delay: 0.15 + i * 0.1 }}
            className="relative grid gap-1 pb-7 pl-8 last:pb-0 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-5"
          >
            <span className={`absolute top-1.5 left-0 h-3 w-3 rounded-full ring-4 ring-paper ${p.current ? "bg-coral" : "bg-forest"}`} aria-hidden />
            <p className="font-display text-[15px] font-extrabold text-forest tabular-nums">
              {startY}
              {endY && endY !== startY ? ` – ${endY}` : p.current ? " – Now" : ""}
            </p>
            <div>
              <p className="font-display text-[17px] leading-snug font-bold">{p.title}</p>
              <p className="text-[14px] text-muted">
                {p.company} · {monthLabel(p.start)} – {p.current ? "Present" : monthLabel(p.end)}
              </p>
              {p.summary && <p className="mt-2 text-[14.5px] leading-relaxed text-ink/80">{p.summary}</p>}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

function ContactItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-line">
      <span className="mt-0.5 text-forest">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[12px] font-semibold text-muted">{label}</dt>
        <dd className="truncate text-[14px] font-semibold tabular-nums">{children}</dd>
      </div>
    </div>
  );
}

function EmptyHint({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-dashed border-ink/15 px-4 py-6 text-[14px] text-muted transition-colors hover:border-forest/40 hover:text-forest"
    >
      {children}
    </button>
  );
}

function EditDrawer({
  sectionKey,
  state,
  onClose,
  onSaved,
}: {
  sectionKey: SectionKey | null;
  state: ProfileState;
  onClose: () => void;
  onSaved: (key: SectionKey, next: ProfileState) => void;
}) {
  const open = sectionKey !== null;

  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {sectionKey && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="drawer-title" data-lenis-prevent>
          <motion.div
            className="absolute inset-0 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <DrawerBody key={sectionKey} sectionKey={sectionKey} state={state} onClose={onClose} onSaved={onSaved} />
        </div>
      )}
    </AnimatePresence>
  );
}

function DrawerBody({
  sectionKey,
  state,
  onClose,
  onSaved,
}: {
  sectionKey: SectionKey;
  state: ProfileState;
  onClose: () => void;
  onSaved: (key: SectionKey, next: ProfileState) => void;
}) {
  const [draft, setDraft] = useState(state);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { title, schema } = sections[sectionKey];

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const Fields = SectionFields[sectionKey] as (p: {
    value: ProfileState[SectionKey];
    set: (patch: Partial<ProfileState[SectionKey]>) => void;
    err: (path: string) => string | undefined;
  }) => React.ReactNode;

  const save = () => {
    const payload = toPayload(draft)[sectionKey];
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await updateProfileSection(sectionKey, payload as never);
      if (res.fieldErrors) setErrors(res.fieldErrors);
      if (res.error) return setFormError(res.error);
      onSaved(sectionKey, { ...state, [sectionKey]: draft[sectionKey] });
    });
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 36 }}
      className="absolute inset-y-0 right-0 flex w-full max-w-[600px] flex-col bg-sand shadow-lift sm:rounded-l-[32px]"
    >
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
        <div>
          <p className="text-[12px] font-bold tracking-[0.14em] text-muted uppercase">Edit</p>
          <h2 id="drawer-title" className="font-display text-xl font-extrabold tracking-tight">
            {title}
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line transition-colors hover:bg-ink/5"
        >
          <X size={18} aria-hidden />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7" data-lenis-prevent>
        <FormAlert message={formError} />
        <Fields
          value={draft[sectionKey]}
          set={(patch) => setDraft((d) => ({ ...d, [sectionKey]: { ...d[sectionKey], ...patch } }))}
          err={(p) => errors[p]}
        />
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-line bg-paper px-5 py-4 sm:rounded-bl-[32px] sm:px-7">
        <button type="button" onClick={onClose} disabled={pending} className="inline-flex h-11 items-center rounded-full px-5 font-semibold hover:bg-ink/5">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-full bg-forest px-6 font-display font-bold text-white shadow-soft transition-colors hover:bg-forest-deep disabled:opacity-80"
        >
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} strokeWidth={3} aria-hidden />}
          {pending ? "Saving…" : "Save changes"}
        </button>
      </footer>
    </motion.div>
  );
}
