"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Building2, Check, Loader2 } from "lucide-react";
import { Field, FormAlert } from "@/components/auth/fields";
import { saveEmployerOnboarding } from "@/app/onboarding/actions";
import { companySizes, employerOnboardingSchema, fieldErrors, type EmployerOnboarding } from "@/lib/onboarding/schema";
import { ease } from "@/lib/site";
import { ChoiceGroup, TextArea } from "./controls";

type Size = (typeof companySizes)[number];

export function EmployerForm({ initialName }: { initialName: string }) {
  const [d, setD] = useState({ fullName: initialName, companyName: "", size: "" as Size | "", website: "", location: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));

  function submit() {
    const payload = d as unknown as EmployerOnboarding;
    const parsed = employerOnboardingSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveEmployerOnboarding(payload);
      if (res?.fieldErrors) setErrors(res.fieldErrors);
      if (res?.error) setFormError(res.error);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="mx-auto max-w-[720px] px-4 py-10 sm:px-6 lg:py-14"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-forest">
        <Building2 size={22} aria-hidden />
      </span>
      <h1 className="mt-5 font-display text-[clamp(1.9rem,4vw,2.5rem)] leading-tight font-extrabold tracking-[-0.03em]">
        Set up your company
      </h1>
      <p className="mt-2 text-muted">Candidates see this on every job you post.</p>

      <div className="mt-8 rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-8">
        <FormAlert message={formError} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your full name" value={d.fullName} onChange={(e) => set({ fullName: e.target.value })} error={errors.fullName} />
          <Field label="Company name" value={d.companyName} onChange={(e) => set({ companyName: e.target.value })} error={errors.companyName} />
          <div className="sm:col-span-2">
            <ChoiceGroup
              label="Company size"
              layoutKey="company-size"
              options={companySizes.map((s) => ({ value: s, label: `${s} people` }))}
              value={d.size ? [d.size] : []}
              onToggle={(v) => set({ size: v })}
              error={errors.size}
            />
          </div>
          <Field label="Website (optional)" type="url" placeholder="https://example.com" value={d.website} onChange={(e) => set({ website: e.target.value })} error={errors.website} />
          <Field label="Location" placeholder="City, country" value={d.location} onChange={(e) => set({ location: e.target.value })} error={errors.location} />
          <div className="sm:col-span-2">
            <TextArea
              label="About the company"
              rows={5}
              value={d.description}
              onChange={(v) => set({ description: v })}
              placeholder="What you do, who you serve, and what it's like to work with you."
            />
            {errors.description && (
              <p role="alert" className="pt-2 text-[13px] font-medium text-[#c2410c]">
                {errors.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full bg-forest px-7 font-display text-[15px] font-bold text-white shadow-soft transition-[background-color,transform] duration-300 hover:bg-forest-deep active:scale-[0.98] disabled:cursor-wait disabled:opacity-85"
        >
          {pending ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Check size={17} strokeWidth={3} aria-hidden />}
          {pending ? "Saving…" : "Save and continue"}
        </button>
      </div>
    </motion.div>
  );
}
