"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Rocket, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field, FormAlert } from "@/components/auth/fields";
import { ChipInput } from "@/components/onboarding/chip-input";
import { ChoiceGroup, Select, TextArea } from "@/components/onboarding/controls";
import { saveJob } from "@/app/recruiter/actions";
import { employmentTypes, jobFields, jobWorkModes, schemaFor, type JobInput } from "@/lib/recruiter/job-schema";
import { MAX_QUESTIONS, type ScreeningQuestion } from "@/lib/jobs/screening";
import { seniorities, seniorityLabel, workModeLabel } from "@/lib/onboarding/schema";
import { typeLabel } from "@/lib/jobs/format";
import { allSkills, skillFields } from "@/lib/onboarding/skill-fields";
import { rolesByField } from "@/lib/onboarding/roles-by-field";

export type JobFormInitial = {
  title: string;
  field: string;
  seniority: string;
  employmentType: string;
  workMode: string;
  location: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  description: string;
  requirements: string;
  skills: string[];
  screeningQuestions: ScreeningQuestion[];
};

export const emptyJob: JobFormInitial = {
  title: "",
  field: "",
  seniority: "",
  employmentType: "",
  workMode: "",
  location: "",
  salaryMin: "",
  salaryMax: "",
  salaryCurrency: "USD",
  description: "",
  requirements: "",
  skills: [],
  screeningQuestions: [],
};

const currencies = ["USD", "EUR", "GBP", "AED", "SAR", "LBP"];
const newId = () => Math.random().toString(36).slice(2, 10);

export function JobForm({ jobId, initial, defaultLocation }: { jobId?: string; initial: JobFormInitial; defaultLocation?: string }) {
  const router = useRouter();
  const [d, setD] = useState<JobFormInitial>({ ...initial, location: initial.location || defaultLocation || "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState<"draft" | "open">();
  const set = (patch: Partial<JobFormInitial>) => setD((x) => ({ ...x, ...patch }));

  const fieldId = jobFields.find((f) => f.name === d.field)?.id;
  const skillSuggestions = useMemo(() => skillFields.find((f) => f.id === fieldId)?.skills ?? [], [fieldId]);
  const roleSuggestions = fieldId ? (rolesByField[fieldId] ?? []).slice(0, 8) : [];

  function submit(status: "draft" | "open") {
    const payload: JobInput = {
      title: d.title,
      field: d.field,
      seniority: d.seniority as JobInput["seniority"],
      employmentType: d.employmentType as JobInput["employmentType"],
      workMode: d.workMode as JobInput["workMode"],
      location: d.location,
      salaryMin: d.salaryMin === "" ? undefined : Number(d.salaryMin),
      salaryMax: d.salaryMax === "" ? undefined : Number(d.salaryMax),
      salaryCurrency: d.salaryCurrency,
      description: d.description,
      requirements: d.requirements.split("\n").map((s) => s.trim()).filter(Boolean),
      skills: d.skills,
      screeningQuestions: d.screeningQuestions.filter((q) => q.text.trim()),
      status,
    };
    // A draft can be missing its description and skills; publishing needs the whole form.
    const parsed = schemaFor(status).safeParse(payload);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) out[issue.path.join(".")] ??= issue.message;
      setErrors(out);
      setFormError(status === "open" ? "Some details need fixing before you can publish." : "A draft still needs the field, title, level, contract and work mode.");
      return;
    }
    setErrors({});
    setFormError(undefined);
    setSubmitting(status);
    startTransition(async () => {
      const res = await saveJob(payload, jobId);
      setSubmitting(undefined);
      if (res.ok && res.id) {
        toast.success(status === "open" ? "Job published" : "Draft saved");
        router.push(status === "open" ? `/recruiter/jobs/${res.id}` : "/recruiter");
        router.refresh();
        return;
      }
      setErrors(res.fieldErrors ?? {});
      setFormError(res.error);
    });
  }

  const updateQuestion = (id: string, patch: Partial<ScreeningQuestion>) =>
    set({ screeningQuestions: d.screeningQuestions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });

  return (
    <div className="space-y-4">
      <FormAlert message={formError} />

      <section className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-8">
        <h2 className="font-display text-[1.15rem] font-extrabold tracking-[-0.02em]">The role</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Select
              label="Field"
              value={d.field}
              onChange={(v) => set({ field: v })}
              options={jobFields.map((f) => ({ value: f.name, label: f.name }))}
              placeholder="Choose a field"
              error={errors.field}
            />
          </div>
          <div className="sm:col-span-2">
            <Field label="Job title" placeholder="e.g. Frontend Developer" value={d.title} onChange={(e) => set({ title: e.target.value })} error={errors.title} />
            {roleSuggestions.length > 0 && !d.title && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {roleSuggestions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set({ title: r })}
                    className="rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-ink/80 ring-1 ring-line transition-colors hover:text-ink hover:ring-forest/40"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <ChoiceGroup
              label="Level"
              layoutKey="job-level"
              options={seniorities.map((s) => ({ value: s, label: seniorityLabel[s] }))}
              value={d.seniority ? [d.seniority as (typeof seniorities)[number]] : []}
              onToggle={(v) => set({ seniority: v })}
              error={errors.seniority}
            />
          </div>
          <div className="sm:col-span-2">
            <ChoiceGroup
              label="Contract"
              layoutKey="job-type"
              options={employmentTypes.map((t) => ({ value: t, label: typeLabel[t] }))}
              value={d.employmentType ? [d.employmentType as (typeof employmentTypes)[number]] : []}
              onToggle={(v) => set({ employmentType: v })}
              error={errors.employmentType}
            />
          </div>
          <div className="sm:col-span-2">
            <ChoiceGroup
              label="Where the work happens"
              layoutKey="job-mode"
              options={jobWorkModes.map((m) => ({ value: m, label: workModeLabel[m] }))}
              value={d.workMode ? [d.workMode as (typeof jobWorkModes)[number]] : []}
              onToggle={(v) => set({ workMode: v })}
              error={errors.workMode}
            />
          </div>
          <Field label="Location (optional)" placeholder="City, country" value={d.location} onChange={(e) => set({ location: e.target.value })} error={errors.location} />
          <div>
            <p className="mb-2 text-[14px] font-semibold text-ink">Monthly salary (optional)</p>
            <div className="grid grid-cols-[1fr_1fr_88px] gap-2">
              <input
                inputMode="numeric"
                aria-label="Minimum salary"
                placeholder="Min"
                value={d.salaryMin}
                onChange={(e) => set({ salaryMin: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                className="h-12 min-w-0 rounded-2xl bg-white px-4 text-[15px] ring-1 ring-line outline-none placeholder:text-ink/35 hover:ring-ink/25 focus:ring-2 focus:ring-forest"
              />
              <input
                inputMode="numeric"
                aria-label="Maximum salary"
                placeholder="Max"
                value={d.salaryMax}
                onChange={(e) => set({ salaryMax: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                className="h-12 min-w-0 rounded-2xl bg-white px-4 text-[15px] ring-1 ring-line outline-none placeholder:text-ink/35 hover:ring-ink/25 focus:ring-2 focus:ring-forest"
              />
              <select
                aria-label="Currency"
                value={d.salaryCurrency}
                onChange={(e) => set({ salaryCurrency: e.target.value })}
                className="h-12 rounded-2xl bg-white px-3 text-[15px] ring-1 ring-line outline-none focus:ring-2 focus:ring-forest"
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            {errors.salaryMax && <p className="pt-2 text-[13px] font-medium text-[#c2410c]">{errors.salaryMax}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-8">
        <h2 className="font-display text-[1.15rem] font-extrabold tracking-[-0.02em]">What you&apos;re looking for</h2>
        <div className="mt-5 space-y-5">
          <ChipInput
            label="Skills"
            hint="Candidates are matched on these. List the ones that really matter, 3 to 15."
            value={d.skills}
            onChange={(skills) => set({ skills })}
            suggestions={skillSuggestions}
            catalog={allSkills}
            placeholder="Type a skill and press Enter"
            max={15}
            error={errors.skills}
          />
          <div>
            <TextArea
              label="About the role"
              rows={8}
              value={d.description}
              onChange={(v) => set({ description: v })}
              placeholder={"What the person will do, the team, and what success looks like.\n\nYou can add a section like:\nWhat you'll do:\n- Build and ship features\n- Work with design"}
            />
            {errors.description && <p className="pt-2 text-[13px] font-medium text-[#c2410c]">{errors.description}</p>}
          </div>
          <TextArea
            label="Requirements (one per line)"
            rows={4}
            value={d.requirements}
            onChange={(v) => set({ requirements: v })}
            placeholder={"2+ years of experience\nEnglish and Arabic"}
          />
          {errors.requirements && <p className="-mt-3 text-[13px] font-medium text-[#c2410c]">{errors.requirements}</p>}
        </div>
      </section>

      <section className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[1.15rem] font-extrabold tracking-[-0.02em]">Screening questions</h2>
            <p className="mt-1 text-[13.5px] text-muted">Optional. Candidates answer these when they apply. Up to {MAX_QUESTIONS}.</p>
          </div>
          <button
            type="button"
            disabled={d.screeningQuestions.length >= MAX_QUESTIONS}
            onClick={() => set({ screeningQuestions: [...d.screeningQuestions, { id: newId(), text: "", type: "text", required: true }] })}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-semibold ring-1 ring-line transition-colors hover:bg-mint/50 hover:ring-forest/30 disabled:opacity-50"
          >
            <Plus size={15} aria-hidden /> Add
          </button>
        </div>
        {d.screeningQuestions.length > 0 && (
          <ul className="mt-5 space-y-3">
            {d.screeningQuestions.map((q, i) => (
              <li key={q.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-line">
                <div className="flex items-start gap-2">
                  <input
                    aria-label={`Question ${i + 1}`}
                    value={q.text}
                    onChange={(e) => updateQuestion(q.id, { text: e.target.value.slice(0, 200) })}
                    placeholder="e.g. Are you allowed to work in Lebanon?"
                    className="h-11 min-w-0 flex-1 rounded-xl bg-paper px-3.5 text-[14.5px] ring-1 ring-line outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-forest"
                  />
                  <button
                    type="button"
                    aria-label={`Remove question ${i + 1}`}
                    onClick={() => set({ screeningQuestions: d.screeningQuestions.filter((x) => x.id !== q.id) })}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-coral/10 hover:text-[#b4391f]"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                  <div className="inline-flex rounded-full bg-ink/[0.05] p-0.5" role="group" aria-label="Answer type">
                    {(["text", "yesno"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={q.type === t}
                        onClick={() => updateQuestion(q.id, { type: t })}
                        className={`rounded-full px-3 py-1 font-semibold transition-colors ${q.type === t ? "bg-paper shadow-soft" : "text-muted"}`}
                      >
                        {t === "text" ? "Written answer" : "Yes / No"}
                      </button>
                    ))}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
                    <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} className="h-4 w-4 accent-[#0e7a5f]" />
                    Required
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
        {errors.screeningQuestions && <p className="pt-2 text-[13px] font-medium text-[#c2410c]">{errors.screeningQuestions}</p>}
        <p className="mt-4 text-[12.5px] leading-snug text-muted">
          Answers help you decide. Don&apos;t ask about age, religion, family or other personal matters; the AI review ignores them and they can be unlawful to use.
        </p>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => submit("draft")}
          disabled={pending}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-display text-[15px] font-bold ring-1 ring-line transition-colors hover:bg-ink/[0.04] disabled:opacity-60"
        >
          {pending && submitting === "draft" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
          Save as draft
        </button>
        <button
          type="button"
          onClick={() => submit("open")}
          disabled={pending}
          className="inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full bg-forest px-7 font-display text-[15px] font-bold text-white shadow-soft transition-[background-color,transform] hover:bg-forest-deep active:scale-[0.98] disabled:cursor-wait disabled:opacity-85"
        >
          {pending && submitting === "open" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Rocket size={16} aria-hidden />}
          {jobId ? "Save and publish" : "Publish job"}
        </button>
      </div>
    </div>
  );
}
