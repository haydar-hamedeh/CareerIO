"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Briefcase, Check, CloudCheck, GraduationCap, ListChecks, Loader2, Target, User } from "lucide-react";
import { FormAlert } from "@/components/auth/fields";
import { saveCandidateOnboarding } from "@/app/onboarding/actions";
import {
  basicsSchema,
  educationSchema,
  experienceSchema,
  fieldErrors,
  preferencesSchema,
  skillsSchema,
} from "@/lib/onboarding/schema";
import { countryByCode, detectRegion } from "@/lib/geo/countries";
import { ease } from "@/lib/site";
import { SectionFields, freshState, toPayload, type ProfileState, type SectionKey } from "./sections";

const steps = [
  { key: "basics", title: "About you", subtitle: "How employers will see and reach you.", Icon: User, schema: basicsSchema },
  { key: "education", title: "Education", subtitle: "Your studies. Your major helps us suggest the right skills later. You can skip this.", Icon: GraduationCap, schema: educationSchema },
  { key: "experience", title: "Experience", subtitle: "Your level and the roles you've had. Just starting out? That's fine.", Icon: Briefcase, schema: experienceSchema },
  { key: "skills", title: "Skills", subtitle: "Suggested from your education and roles. We match jobs on these, so be specific.", Icon: ListChecks, schema: skillsSchema },
  { key: "preferences", title: "What you want", subtitle: "The kind of job you're looking for.", Icon: Target, schema: preferencesSchema },
] as const;

// Bumped when the step order changed, so an old saved draft can't land on the wrong step.
const DRAFT_VERSION = 2;
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
type Draft = { v: number; step: number; state: ProfileState; savedAt: number };

const draftKey = (userId: string) => `careerio:onboarding:${userId}`;

function readDraft(userId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (d.v !== DRAFT_VERSION || Date.now() - d.savedAt > DRAFT_TTL_MS) return null;
    if (!d.state?.basics || d.step < 0 || d.step >= steps.length) return null;
    return d;
  } catch {
    return null;
  }
}

function writeDraft(userId: string, step: number, state: ProfileState) {
  try {
    const draft: Draft = { v: DRAFT_VERSION, step, state, savedAt: Date.now() };
    window.localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  } catch {}
}

function clearDraft(userId: string) {
  try {
    window.localStorage.removeItem(draftKey(userId));
  } catch {}
}

export function CandidateWizard({
  initialName,
  userId,
  geoCountry,
}: {
  initialName: string;
  userId: string;
  geoCountry: string | null;
}) {
  const [draft] = useState(() => readDraft(userId));
  const [state, setState] = useState<ProfileState>(
    () => draft?.state ?? freshState(initialName, geoCountry && countryByCode.has(geoCountry) ? geoCountry : detectRegion()),
  );
  const [step, setStep] = useState(draft?.step ?? 0);
  const [restored] = useState(Boolean(draft));
  const [dir, setDir] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    writeDraft(userId, step, state);
  }, [userId, step, state]);

  const current = steps[step];
  const err = (path: string) => errors[`${current.key}.${path}`];

  function update<K extends SectionKey>(key: K, patch: Partial<ProfileState[K]>) {
    setState((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  }

  function validate(index: number) {
    const s = steps[index];
    const parsed = s.schema.safeParse(toPayload(state)[s.key]);
    if (parsed.success) {
      setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`${s.key}.`))));
      return true;
    }
    const fe = fieldErrors(parsed.error);
    setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [`${s.key}.${k}`, v])));
    return false;
  }

  function go(to: number) {
    setDir(to > step ? 1 : -1);
    setStep(to);
    setFormError(undefined);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function next() {
    if (!validate(step)) return;
    if (step < steps.length - 1) return go(step + 1);
    startTransition(async () => {
      clearDraft(userId);
      const res = await saveCandidateOnboarding(toPayload(state));
      if (res?.error || res?.fieldErrors) writeDraft(userId, step, state);
      if (res?.fieldErrors) {
        setErrors(res.fieldErrors);
        const first = steps.findIndex((s) => Object.keys(res.fieldErrors ?? {}).some((k) => k.startsWith(`${s.key}.`)));
        if (first >= 0 && first !== step) go(first);
      }
      if (res?.error) setFormError(res.error);
    });
  }

  const Fields = SectionFields[current.key] as (p: {
    value: ProfileState[SectionKey];
    set: (patch: Partial<ProfileState[SectionKey]>) => void;
    err: (path: string) => string | undefined;
    profile?: ProfileState;
  }) => React.ReactNode;

  return (
    <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[260px_1fr] lg:gap-14 lg:py-14">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-[13px] font-semibold text-forest">
          Step {step + 1} of {steps.length}
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-muted">
          <CloudCheck size={14} aria-hidden />
          {restored ? "Picked up where you left off" : "Progress saved on this device"}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[0.07] lg:hidden">
          <motion.div
            className="h-full origin-left rounded-full bg-forest"
            animate={{ scaleX: (step + 1) / steps.length }}
            transition={{ type: "spring", stiffness: 160, damping: 26 }}
          />
        </div>
        <ol className="mt-6 hidden space-y-1 lg:block">
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => go(i)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors disabled:cursor-default ${
                    active ? "bg-paper shadow-soft ring-1 ring-line" : done ? "hover:bg-ink/5" : ""
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                      done ? "bg-forest text-white" : active ? "bg-ink text-sand" : "bg-ink/[0.06] text-muted"
                    }`}
                  >
                    {done ? <Check size={15} strokeWidth={3} aria-hidden /> : <s.Icon size={15} aria-hidden />}
                  </span>
                  <span className={`text-[14.5px] font-semibold ${active || done ? "text-ink" : "text-muted"}`}>{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className="min-w-0">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={current.key}
            custom={dir}
            initial={{ opacity: 0, x: dir * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -28 }}
            transition={{ duration: 0.35, ease }}
          >
            <h1 className="font-display text-[clamp(1.9rem,4vw,2.5rem)] leading-tight font-extrabold tracking-[-0.03em]">
              {current.title}
            </h1>
            <p className="mt-2 text-muted">{current.subtitle}</p>

            <div className="mt-8 rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-8">
              <FormAlert message={formError} />
              <Fields value={state[current.key]} set={(patch) => update(current.key, patch)} err={err} profile={state} />
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={step === 0 || pending}
            className="inline-flex h-12 items-center gap-2 rounded-full px-5 font-display text-[15px] font-bold text-ink transition-colors hover:bg-ink/5 disabled:invisible"
          >
            <ArrowLeft size={17} aria-hidden /> Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={pending}
            className="group inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full bg-forest px-7 font-display text-[15px] font-bold text-white shadow-soft transition-[background-color,transform] duration-300 ease-(--ease-out-soft) hover:bg-forest-deep active:scale-[0.98] disabled:cursor-wait disabled:opacity-85"
          >
            {pending ? (
              <>
                <Loader2 size={17} className="animate-spin" aria-hidden /> Saving…
              </>
            ) : step === steps.length - 1 ? (
              <>
                Finish and see jobs <Check size={17} strokeWidth={3} aria-hidden />
              </>
            ) : (
              <>
                Continue <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
