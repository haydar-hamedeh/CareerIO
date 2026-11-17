"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Field } from "@/components/auth/fields";
import {
  seniorities,
  seniorityLabel,
  workModeLabel,
  workModes,
  type CandidateOnboarding,
} from "@/lib/onboarding/schema";
import { languageSuggestions, locationSuggestions, roleSuggestions } from "@/lib/onboarding/suggestions";
import { allSkills, commonSkills, inferFields, skillFields } from "@/lib/onboarding/skill-fields";
import { rolesByField } from "@/lib/onboarding/roles-by-field";
import { useOccupations } from "@/lib/onboarding/use-occupations";
import { degrees, majors } from "@/lib/onboarding/education";
import { roleCatalog } from "@/lib/onboarding/skills-catalog";
import { countryByCode, countryByName } from "@/lib/geo/countries";
import { splitPhone } from "@/lib/geo/phone";
import { ease } from "@/lib/site";
import { ChipInput } from "./chip-input";
import { ChoiceGroup, TextArea } from "./controls";
import { CountryCombobox, PhoneField } from "./country-combobox";
import { SchoolField } from "./school-field";
import { SearchSelect } from "./search-select";

export type Position = { title: string; company: string; start: string; end: string; current: boolean; summary: string };
export type Edu = { school: string; degree: string; field: string; startYear: string; endYear: string };
type Seniority = (typeof seniorities)[number];
type WorkMode = (typeof workModes)[number];

export type ProfileState = {
  basics: {
    fullName: string;
    headline: string;
    countryCode: string | null;
    dialCode: string | null;
    dialTouched: boolean;
    phone: string;
    city: string;
  };
  experience: { seniority: Seniority | ""; yearsExperience: string; positions: Position[] };
  education: { education: Edu[] };
  skills: { skills: string[]; languages: string[] };
  preferences: {
    desiredRoles: string[];
    workModes: WorkMode[];
    preferredLocations: string[];
    salaryMin: string;
    salaryMax: string;
    salaryCurrency: string;
  };
};

export type SectionKey = keyof ProfileState;

export type SectionProps<K extends SectionKey> = {
  value: ProfileState[K];
  set: (patch: Partial<ProfileState[K]>) => void;
  err: (path: string) => string | undefined;
  /** The whole profile being edited, for steps that adapt to other answers (e.g. skills by field of study). */
  profile?: ProfileState;
};

export const emptyPosition: Position = { title: "", company: "", start: "", end: "", current: false, summary: "" };
export const emptyEdu: Edu = { school: "", degree: "", field: "", startYear: "", endYear: "" };

export const freshState = (name: string, region: string | null): ProfileState => ({
  basics: { fullName: name, headline: "", countryCode: region, dialCode: region, dialTouched: false, phone: "", city: "" },
  experience: { seniority: "", yearsExperience: "0", positions: [] },
  education: { education: [] },
  skills: { skills: [], languages: [] },
  preferences: { desiredRoles: [], workModes: [], preferredLocations: [], salaryMin: "", salaryMax: "", salaryCurrency: "USD" },
});

export const toPayload = (s: ProfileState) =>
  ({
    ...s,
    basics: {
      fullName: s.basics.fullName,
      headline: s.basics.headline,
      city: s.basics.city,
      country: s.basics.countryCode ? (countryByCode.get(s.basics.countryCode)?.name ?? "") : "",
      phone: s.basics.phone.trim()
        ? `+${countryByCode.get(s.basics.dialCode ?? "")?.dial ?? ""} ${s.basics.phone.trim().replace(/^0+/, "")}`
        : "",
    },
    preferences: {
      ...s.preferences,
      salaryMin: s.preferences.salaryMin === "" ? undefined : s.preferences.salaryMin,
      salaryMax: s.preferences.salaryMax === "" ? undefined : s.preferences.salaryMax,
    },
  }) as unknown as CandidateOnboarding;

export type ProfileRow = {
  headline: string | null;
  phone: string | null;
  country: string | null;
  location: string | null;
  seniority: string | null;
  years_experience: number | null;
  experience: unknown;
  education: unknown;
  skills: string[] | null;
  languages: string[] | null;
  desired_roles: string[] | null;
  work_modes: string[] | null;
  preferred_locations: string[] | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
};

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function stateFromRow(fullName: string, row: ProfileRow | null): ProfileState {
  const countryCode = row?.country ? (countryByName.get(row.country)?.code ?? null) : null;
  const { dialCode, national } = splitPhone(row?.phone ?? null, countryCode);
  return {
    basics: {
      fullName,
      headline: row?.headline ?? "",
      countryCode,
      dialCode,
      dialTouched: true,
      phone: national,
      city: row?.location ?? "",
    },
    experience: {
      seniority: (seniorities as readonly string[]).includes(row?.seniority ?? "") ? (row?.seniority as Seniority) : "",
      yearsExperience: String(Math.round(Number(row?.years_experience ?? 0))),
      positions: asArray<Position>(row?.experience).map((p) => ({ ...emptyPosition, ...p, summary: p.summary ?? "" })),
    },
    education: {
      education: asArray<Edu>(row?.education).map((e) => ({
        ...emptyEdu,
        ...e,
        startYear: String(e.startYear ?? ""),
        endYear: String(e.endYear ?? ""),
      })),
    },
    skills: { skills: row?.skills ?? [], languages: row?.languages ?? [] },
    preferences: {
      desiredRoles: row?.desired_roles ?? [],
      workModes: (row?.work_modes ?? []).filter((m): m is WorkMode => (workModes as readonly string[]).includes(m)),
      preferredLocations: row?.preferred_locations ?? [],
      salaryMin: row?.salary_min ? String(row.salary_min) : "",
      salaryMax: row?.salary_max ? String(row.salary_max) : "",
      salaryCurrency: row?.salary_currency ?? "USD",
    },
  };
}

export function BasicsFields({ value, set, err }: SectionProps<"basics">) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        className="sm:col-span-2"
        label="Full name"
        value={value.fullName}
        onChange={(e) => set({ fullName: e.target.value })}
        autoComplete="name"
        error={err("fullName")}
      />
      <Field
        className="sm:col-span-2"
        label="Headline"
        placeholder="e.g. Junior Frontend Developer · React & TypeScript"
        value={value.headline}
        onChange={(e) => set({ headline: e.target.value })}
        error={err("headline")}
      />
      <CountryCombobox
        variant="field"
        label="Country"
        value={value.countryCode}
        onChange={(c) => set(value.dialTouched ? { countryCode: c.code } : { countryCode: c.code, dialCode: c.code })}
        error={err("country")}
      />
      <PhoneField
        label="Phone number"
        dialCode={value.dialCode}
        onDialChange={(c) => set({ dialCode: c.code, dialTouched: true })}
        value={value.phone}
        onChange={(v) => set({ phone: v })}
        error={err("phone")}
      />
      <Field
        className="sm:col-span-2"
        label="City"
        autoComplete="address-level2"
        placeholder="Your city"
        value={value.city}
        onChange={(e) => set({ city: e.target.value })}
        error={err("city")}
      />
      <p className="text-[12.5px] leading-relaxed text-muted sm:col-span-2">
        Your phone number is only shared with employers you apply to. It is never used to score or rank you.
      </p>
    </div>
  );
}

export function ExperienceFields({ value, set, err }: SectionProps<"experience">) {
  return (
    <div className="space-y-6">
      <ChoiceGroup
        label="Your level"
        layoutKey="seniority"
        options={seniorities.map((s) => ({ value: s, label: seniorityLabel[s] }))}
        value={value.seniority ? [value.seniority] : []}
        onToggle={(v) => set({ seniority: v })}
        error={err("seniority")}
      />
      <Field
        className="max-w-[220px]"
        label="Years of experience"
        type="number"
        min={0}
        max={60}
        step={1}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value.yearsExperience}
        onKeyDown={(e) => {
          if ([".", ",", "e", "E", "+", "-"].includes(e.key)) e.preventDefault();
        }}
        onChange={(e) => set({ yearsExperience: e.target.value.replace(/\D/g, "").slice(0, 2) })}
        error={err("yearsExperience")}
      />
      <ListEditor
        title="Positions"
        addLabel="Add a position"
        items={value.positions}
        onChange={(positions) => set({ positions })}
        empty={emptyPosition}
        emptyText="No positions yet. Add internships, freelance or part-time work too."
        render={(p, i, setItem) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title" value={p.title} onChange={(e) => setItem({ title: e.target.value })} error={err(`positions.${i}.title`)} />
            <Field label="Company" value={p.company} onChange={(e) => setItem({ company: e.target.value })} error={err(`positions.${i}.company`)} />
            <Field label="Start" type="month" value={p.start} onChange={(e) => setItem({ start: e.target.value })} error={err(`positions.${i}.start`)} />
            <Field
              label="End"
              type="month"
              disabled={p.current}
              value={p.current ? "" : p.end}
              onChange={(e) => setItem({ end: e.target.value })}
              error={err(`positions.${i}.end`)}
            />
            <label className="flex items-center gap-2.5 text-[14px] font-medium sm:col-span-2">
              <input
                type="checkbox"
                checked={p.current}
                onChange={(e) => setItem({ current: e.target.checked, end: "" })}
                className="h-[18px] w-[18px] rounded accent-[var(--forest)]"
              />
              I work here now
            </label>
            <div className="sm:col-span-2">
              <TextArea
                label="What you did (optional)"
                value={p.summary}
                onChange={(v) => setItem({ summary: v })}
                placeholder="One or two lines about your work and results."
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}

export function EducationFields({ value, set, err, profile }: SectionProps<"education">) {
  return (
    <ListEditor
      title="Education"
      addLabel="Add education"
      items={value.education}
      onChange={(education) => set({ education })}
      empty={emptyEdu}
      emptyText="Nothing added. You can continue without education."
      render={(e, i, setItem) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <SchoolField
            className="sm:col-span-2"
            label="School or university"
            value={e.school}
            onChange={(school) => setItem({ school })}
            countryCode={profile?.basics.countryCode ?? null}
            error={err(`education.${i}.school`)}
          />
          <SearchSelect
            label="Degree"
            placeholder="Choose a degree"
            searchPlaceholder="Search or type your degree"
            options={degrees}
            value={e.degree}
            onChange={(v) => setItem({ degree: v })}
            error={err(`education.${i}.degree`)}
          />
          <SearchSelect
            label="Major / field"
            placeholder="Choose a major"
            searchPlaceholder="Search or type your major"
            options={majors}
            value={e.field}
            onChange={(v) => setItem({ field: v })}
            error={err(`education.${i}.field`)}
          />
          <Field label="Start year" type="number" inputMode="numeric" placeholder="2020" value={e.startYear} onChange={(ev) => setItem({ startYear: ev.target.value })} error={err(`education.${i}.startYear`)} />
          <Field label="End year (or expected)" type="number" inputMode="numeric" placeholder="2024" value={e.endYear} onChange={(ev) => setItem({ endYear: ev.target.value })} error={err(`education.${i}.endYear`)} />
        </div>
      )}
    />
  );
}

/** Field buttons shared by the skills and roles steps. Fields guessed from the person's answers come first. */
function FieldPills({ inferred, activeId, onPick, hint }: { inferred: string[]; activeId: string | null; onPick: (id: string) => void; hint: string }) {
  const order = [...inferred, ...skillFields.map((f) => f.id).filter((id) => !inferred.includes(id))];
  return (
    <div>
      <p className="text-[14px] font-semibold text-ink">Your field</p>
      <p className="mt-0.5 text-[13px] text-muted">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Field">
        {order.map((id) => {
          const f = skillFields.find((x) => x.id === id)!;
          const on = id === activeId;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(on ? "" : id)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                on ? "bg-forest text-white" : inferred.includes(id) ? "bg-mint text-forest-deep hover:bg-mint/70" : "bg-white text-ink/75 ring-1 ring-line hover:ring-ink/25"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SkillsFields({ value, set, err, profile }: SectionProps<"skills">) {
  const inferred = useMemo(
    () =>
      profile
        ? inferFields({
            education: profile.education.education,
            desiredRoles: profile.preferences.desiredRoles,
            headline: profile.basics.headline,
            positions: profile.experience.positions,
          })
        : [],
    [profile],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const activeId = picked ?? inferred[0] ?? null;
  const active = skillFields.find((f) => f.id === activeId) ?? null;

  return (
    <div className="space-y-7">
      <FieldPills
        inferred={inferred}
        activeId={activeId}
        onPick={setPicked}
        hint={inferred.length > 0 ? "Based on your education and experience. Pick another field to see its skills." : "Pick a field to see the skills employers look for."}
      />
      <div>
        <ChipInput
          key={activeId ?? "common"}
          label="Skills"
          hint="Type a skill and press Enter, or tap a suggestion. Add at least 3."
          placeholder="e.g. React, Excel, Patient care"
          value={value.skills}
          onChange={(skills) => set({ skills })}
          suggestions={active ? active.skills : commonSkills}
          catalog={allSkills}
          suggestionLimit={14}
          error={err("skills")}
        />
        <p className="mt-2.5 text-[11.5px] text-muted">Skill suggestions use the ESCO classification of the European Commission.</p>
      </div>
      <ChipInput
        label="Languages"
        placeholder="e.g. Arabic, English"
        value={value.languages}
        onChange={(languages) => set({ languages })}
        suggestions={languageSuggestions}
        max={10}
        error={err("languages")}
      />
    </div>
  );
}

export function PreferencesFields({ value, set, err, profile }: SectionProps<"preferences">) {
  // Roles follow the person's field, guessed from education, experience and the skills they picked (not from roles themselves).
  const inferred = useMemo(
    () =>
      profile
        ? inferFields({
            education: profile.education.education,
            desiredRoles: [],
            headline: profile.basics.headline,
            positions: profile.experience.positions,
            skills: profile.skills.skills,
          })
        : [],
    [profile],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const activeId = picked ?? inferred[0] ?? null;
  const occupations = useOccupations();
  const roleSearch = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of [...rolesByField[activeId ?? ""] ?? [], ...roleCatalog, ...occupations]) if (!seen.has(r.toLowerCase())) seen.set(r.toLowerCase(), r);
    return [...seen.values()];
  }, [occupations, activeId]);

  return (
    <div className="space-y-7">
      <FieldPills
        inferred={inferred}
        activeId={activeId}
        onPick={setPicked}
        hint={inferred.length > 0 ? "Based on your studies and skills. Pick another field to see its roles." : "Pick a field to see common roles."}
      />
      <ChipInput
        key={activeId ?? "common"}
        label="Roles you want"
        placeholder="e.g. Psychologist, Frontend Developer"
        value={value.desiredRoles}
        onChange={(desiredRoles) => set({ desiredRoles })}
        suggestions={activeId && rolesByField[activeId] ? rolesByField[activeId] : roleSuggestions}
        catalog={roleSearch}
        suggestionLimit={12}
        max={10}
        error={err("desiredRoles")}
      />
      <ChoiceGroup
        label="Work mode"
        layoutKey="workModes"
        multiple
        options={workModes.map((m) => ({ value: m, label: workModeLabel[m] }))}
        value={value.workModes}
        onToggle={(v) =>
          set({ workModes: value.workModes.includes(v) ? value.workModes.filter((x) => x !== v) : [...value.workModes, v] })
        }
        error={err("workModes")}
      />
      <ChipInput
        label="Preferred locations (optional)"
        placeholder="e.g. London, Remote"
        value={value.preferredLocations}
        onChange={(preferredLocations) => set({ preferredLocations })}
        suggestions={locationSuggestions}
        max={10}
      />
      <div>
        <p className="text-[14px] font-semibold text-ink">Expected monthly salary in USD (optional)</p>
        <p className="mt-0.5 text-[13px] text-muted">Only used to filter jobs. Never shown to employers.</p>
        <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
          <Field label="From" type="number" inputMode="numeric" min={0} placeholder="900" value={value.salaryMin} onChange={(e) => set({ salaryMin: e.target.value })} error={err("salaryMin")} />
          <Field label="To" type="number" inputMode="numeric" min={0} placeholder="2000" value={value.salaryMax} onChange={(e) => set({ salaryMax: e.target.value })} error={err("salaryMax")} />
        </div>
      </div>
    </div>
  );
}

export const SectionFields = {
  basics: BasicsFields,
  experience: ExperienceFields,
  education: EducationFields,
  skills: SkillsFields,
  preferences: PreferencesFields,
} as const;

export function ListEditor<T extends object>({
  title,
  addLabel,
  items,
  onChange,
  empty,
  emptyText,
  render,
}: {
  title: string;
  addLabel: string;
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  emptyText: string;
  render: (item: T, index: number, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-[14px] font-semibold text-ink">{title}</p>
      {items.length === 0 && (
        <p className="mb-4 rounded-2xl border border-dashed border-ink/15 px-4 py-5 text-center text-[14px] text-muted">{emptyText}</p>
      )}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3, ease }}
              className="relative rounded-[22px] bg-white p-4 ring-1 ring-line sm:p-5"
            >
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label={`Remove item ${i + 1}`}
                className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-coral/10 hover:text-[#c2410c]"
              >
                <Trash2 size={16} aria-hidden />
              </button>
              <div className="pr-10">{render(item, i, (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))))}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, { ...empty }])}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-forest ring-1 ring-line transition-[box-shadow,transform] hover:ring-forest/40 active:scale-[0.97]"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden /> {addLabel}
      </button>
    </div>
  );
}
