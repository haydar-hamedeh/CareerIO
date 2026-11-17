"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { CountryCombobox, PhoneField } from "@/components/onboarding/country-combobox";
import { FormAlert } from "@/components/auth/fields";
import { applyToJob } from "@/app/jobs/actions";
import { countryByCode, countryByName } from "@/lib/geo/countries";
import { joinPhone, splitPhone } from "@/lib/geo/phone";
import type { ScreeningQuestion } from "@/lib/jobs/screening";
import { ease } from "@/lib/site";

type Cv = { id: string; fileName: string; isPrimary: boolean };
type Profile = { phone: string | null; country: string | null };

const fileExt = (name: string) => (name.split(".").pop() ?? "cv").slice(0, 4).toUpperCase();

function initialState(profile: Profile) {
  const countryCode = profile.country ? (countryByName.get(profile.country)?.code ?? null) : null;
  const { dialCode, national } = splitPhone(profile.phone, countryCode);
  return { countryCode, dialCode, phone: national };
}

export function ApplyDialog({
  jobId,
  jobTitle,
  company,
  cvs,
  profile,
  questions = [],
  children,
}: {
  jobId: string;
  jobTitle: string;
  company: string;
  cvs: Cv[];
  profile: Profile;
  questions?: ScreeningQuestion[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const filled = Boolean(profile.phone || profile.country);
  const [form, setForm] = useState(() => initialState(profile));
  const [cvId, setCvId] = useState(cvs.find((c) => c.isPrimary)?.id ?? cvs[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const patch = (p: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...p }));
    setEdited(true);
  };

  function reset() {
    setForm(initialState(profile));
    setEdited(false);
    setFieldErrors({});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setFieldErrors({});
    startTransition(async () => {
      const res = await applyToJob({
        jobId,
        cvId,
        phone: joinPhone(form.dialCode, form.phone),
        country: form.countryCode ? (countryByCode.get(form.countryCode)?.name ?? "") : "",
        coverLetter: note,
        answers,
      });
      if (res.ok) {
        toast.success("Application sent", { description: `${jobTitle} at ${company}` });
        setOpen(false);
        router.refresh();
        return;
      }
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
        <Dialog.Content
          data-lenis-prevent
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[540px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-[28px] bg-paper p-5 shadow-lift ring-1 ring-line outline-none sm:p-7"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.025em]">Apply to {company}</Dialog.Title>
              <Dialog.Description className="mt-1 truncate text-[14px] text-muted">{jobTitle}</Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              disabled={pending}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted ring-1 ring-line transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X size={16} aria-hidden />
            </Dialog.Close>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
            {filled && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-mint/60 px-4 py-2.5 text-[13px] text-forest-deep">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Sparkles size={14} aria-hidden />
                  {edited ? "Edited for this application only." : "Filled from your profile. Edit anything."}
                </span>
                {edited && (
                  <button type="button" onClick={reset} className="font-bold underline-offset-2 hover:underline">
                    Reset
                  </button>
                )}
              </div>
            )}

            <FormAlert message={error} />

            <fieldset className="space-y-4">
              <legend className="sr-only">Contact details</legend>
              <CountryCombobox
                variant="field"
                label="Country"
                value={form.countryCode}
                onChange={(c) => patch({ countryCode: c.code, dialCode: form.phone ? form.dialCode : c.code })}
                error={fieldErrors.country}
              />
              <PhoneField
                label="Phone number"
                dialCode={form.dialCode}
                onDialChange={(c) => patch({ dialCode: c.code })}
                value={form.phone}
                onChange={(v) => patch({ phone: v })}
                error={fieldErrors.phone}
              />
              <p className="-mt-2 text-[12.5px] text-muted">Only the employer you apply to sees this. It isn&apos;t used to score you.</p>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-[14px] font-semibold">Your CV</legend>
              {cvs.length === 0 ? (
                <p className="rounded-2xl bg-coral/[0.07] px-4 py-3 text-[13.5px] text-[#9a3412]">
                  You need a CV to apply.{" "}
                  <Link href="/profile" className="font-bold underline">
                    Upload one in your profile
                  </Link>
                  .
                </p>
              ) : (
                <ul className="space-y-2">
                  {cvs.map((c) => (
                    <li key={c.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] ring-1 transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest ${
                          cvId === c.id ? "bg-mint/55 ring-2 ring-forest" : "bg-white ring-line hover:ring-ink/25"
                        }`}
                      >
                        <input type="radio" name="cv" className="sr-only" checked={cvId === c.id} onChange={() => setCvId(c.id)} />
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-extrabold ${cvId === c.id ? "bg-forest text-white" : "bg-mint text-forest-deep"}`}
                        >
                          {fileExt(c.fileName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{c.fileName}</span>
                          {c.isPrimary && <span className="text-[11px] font-bold tracking-wide text-forest uppercase">Main CV</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <AnimatePresence>
                {fieldErrors.cvId && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }} className="mt-1.5 text-[13px] text-[#9a3412]">
                    {fieldErrors.cvId}
                  </motion.p>
                )}
              </AnimatePresence>
            </fieldset>

            {questions.length > 0 && (
              <fieldset className="space-y-4">
                <legend className="mb-2 text-[14px] font-semibold">Questions from {company}</legend>
                {questions.map((q) => {
                  const err = fieldErrors[`q:${q.id}`];
                  const value = answers[q.id] ?? "";
                  const label = (
                    <span className="mb-1.5 block text-[14px] leading-snug">
                      {q.text} {!q.required && <span className="text-muted">(optional)</span>}
                    </span>
                  );
                  return (
                    <div key={q.id}>
                      {q.type === "yesno" ? (
                        <div role="group" aria-label={q.text}>
                          {label}
                          <div className="flex gap-2">
                            {["Yes", "No"].map((o) => (
                              <button
                                key={o}
                                type="button"
                                aria-pressed={value === o}
                                onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                                className={`h-10 min-w-20 rounded-full px-5 text-[14px] font-semibold ring-1 transition-colors ${
                                  value === o ? "bg-forest text-white ring-forest" : "bg-white ring-line hover:ring-ink/25"
                                }`}
                              >
                                {o}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <label>
                          {label}
                          <textarea
                            value={value}
                            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value.slice(0, 1000) }))}
                            rows={3}
                            className="w-full resize-none rounded-2xl bg-white px-4 py-3 text-[14px] leading-relaxed ring-1 ring-line outline-none focus:ring-2 focus:ring-forest"
                          />
                        </label>
                      )}
                      {err && <p className="mt-1.5 text-[13px] text-[#9a3412]">{err}</p>}
                    </div>
                  );
                })}
              </fieldset>
            )}

            <div>
              <label htmlFor="apply-note" className="mb-2 flex items-baseline justify-between text-[14px] font-semibold">
                <span>
                  Note to the employer <span className="font-normal text-muted">(optional)</span>
                </span>
                <span className="text-[12px] font-normal text-muted tabular-nums">{note.length}/2000</span>
              </label>
              <textarea
                id="apply-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 2000))}
                rows={4}
                placeholder="A line or two on why you're a good fit."
                className="w-full resize-none rounded-2xl bg-white px-4 py-3 text-[14px] leading-relaxed ring-1 ring-line outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-forest"
              />
              <AnimatePresence>
                {fieldErrors.coverLetter && <p className="mt-1.5 text-[13px] text-[#9a3412]">{fieldErrors.coverLetter}</p>}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              disabled={pending || cvs.length === 0}
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0e7a5f,#0a5c48)] font-display text-[15px] font-bold text-white shadow-lift transition-[filter,opacity] hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
            >
              {pending ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
              {pending ? "Sending…" : "Send application"}
              {!pending && <ArrowRight size={16} aria-hidden />}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
