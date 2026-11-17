"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field, FormAlert } from "@/components/auth/fields";
import { ChoiceGroup, TextArea } from "@/components/onboarding/controls";
import { CompanyAvatar } from "@/components/company/company-avatar";
import { removeCompanyLogo, saveCompany, setCompanyLogo, type CompanyInput } from "@/app/recruiter/company/actions";
import { createClient } from "@/lib/supabase/client";
import { companySizes } from "@/lib/onboarding/schema";
import { LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/company";
import { ease } from "@/lib/site";

type Size = (typeof companySizes)[number];

export function CompanyForm({ userId, companyId, initial, logoPath }: { userId: string; companyId: string; initial: Record<keyof CompanyInput, string>; logoPath: string | null }) {
  const [d, setD] = useState(initial);
  const [logo, setLogo] = useState(logoPath);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, start] = useTransition();
  const [logoBusy, setLogoBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));

  const save = () =>
    start(async () => {
      setErrors({});
      setFormError(undefined);
      const res = await saveCompany(d as unknown as CompanyInput);
      if (res.fieldErrors) setErrors(res.fieldErrors);
      if (res.error) return void setFormError(res.error);
      toast.success("Company saved");
    });

  async function upload(f: File) {
    const ext = LOGO_TYPES[f.type];
    if (!ext) return void toast.error("Use a PNG, JPG or WebP image.");
    if (f.size > LOGO_MAX_BYTES) return void toast.error("That image is over 2 MB.");
    setLogoBusy(true);
    try {
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient().storage.from("company-logos").upload(path, f, { contentType: f.type, upsert: false });
      if (error) return void toast.error("Upload failed. Check your connection and try again.");
      const res = await setCompanyLogo(path);
      if (res.error) return void toast.error(res.error);
      setLogo(res.logoPath ?? null);
      toast.success("Logo updated");
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setLogoBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  async function removeLogo() {
    setLogoBusy(true);
    const res = await removeCompanyLogo();
    setLogoBusy(false);
    if (res.error) return void toast.error(res.error);
    setLogo(null);
  }

  return (
    <motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mx-auto max-w-[720px] px-4 py-8 sm:px-6 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(1.8rem,3.6vw,2.4rem)] leading-tight font-extrabold tracking-[-0.03em]">Your company</h1>
          <p className="mt-2 text-muted">This is what candidates see on every job you post.</p>
        </div>
        <Link href={`/companies/${companyId}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-paper px-4 text-[13.5px] font-semibold ring-1 ring-line hover:ring-forest/40">
          View public page <ExternalLink size={14} aria-hidden />
        </Link>
      </div>

      <div className="mt-6 rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-8">
        <div className="flex items-center gap-5">
          <CompanyAvatar name={d.name || "C"} logoPath={logo} size="xl" />
          <div>
            <p className="text-[14px] font-semibold">Logo</p>
            <p className="text-[12.5px] text-muted">PNG, JPG or WebP, up to 2 MB. Square works best.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <button type="button" onClick={() => file.current?.click()} disabled={logoBusy} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-semibold ring-1 ring-line hover:bg-mint/50 disabled:opacity-60">
                {logoBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ImagePlus size={15} className="text-forest" aria-hidden />}
                {logo ? "Replace" : "Upload logo"}
              </button>
              {logo && (
                <button type="button" onClick={removeLogo} disabled={logoBusy} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-[#b4391f] hover:bg-coral/10 disabled:opacity-60">
                  <Trash2 size={15} aria-hidden /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-7">
          <FormAlert message={formError} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company name" value={d.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
            <Field label="Industry (optional)" placeholder="Software, Retail, Healthcare…" value={d.industry} onChange={(e) => set({ industry: e.target.value })} error={errors.industry} />
            <div className="sm:col-span-2">
              <ChoiceGroup
                label="Company size"
                layoutKey="company-size-edit"
                options={companySizes.map((s) => ({ value: s, label: `${s} people` }))}
                value={d.size ? [d.size as Size] : []}
                onToggle={(v) => set({ size: v })}
                error={errors.size}
              />
            </div>
            <Field label="Website (optional)" type="url" placeholder="https://example.com" value={d.website} onChange={(e) => set({ website: e.target.value })} error={errors.website} />
            <Field label="Location" placeholder="City, country" value={d.location} onChange={(e) => set({ location: e.target.value })} error={errors.location} />
            <div className="sm:col-span-2">
              <TextArea label="About the company" rows={6} value={d.description} onChange={(v) => set({ description: v })} placeholder="What you do, who you serve, and what it's like to work with you." />
              {errors.description && (
                <p role="alert" className="pt-2 text-[13px] font-medium text-[#c2410c]">
                  {errors.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-12 min-w-[160px] items-center justify-center gap-2 rounded-full bg-forest px-7 font-display text-[15px] font-bold text-white shadow-soft transition-[background-color,transform] hover:bg-forest-deep active:scale-[0.98] disabled:opacity-85"
        >
          {pending ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Check size={17} strokeWidth={3} aria-hidden />}
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </motion.main>
  );
}
