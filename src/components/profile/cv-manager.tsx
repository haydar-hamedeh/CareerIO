"use client";

import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, FileText, Loader2, ShieldCheck, Star, Trash2, UploadCloud } from "lucide-react";
import { FormAlert } from "@/components/auth/fields";
import { deleteCv, getCvLink, setPrimaryCv, type CvItem } from "@/app/profile/actions";
import { CV_ACCEPT, fileSize, uploadCvFile } from "./cv-upload";
import { ease } from "@/lib/site";

const kb = fileSize;

export function CvManager({ userId, initial }: { userId: string; initial: CvItem[] }) {
  const [cvs, setCvs] = useState(initial);
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [error, setError] = useState<string>();
  const [over, setOver] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(undefined);
    setStage("uploading");
    const res = await uploadCvFile(userId, file);
    setStage("idle");
    if (input.current) input.current.value = "";
    if (res.error || !res.cv) return setError(res.error);
    const cv = res.cv;
    setCvs((list) => [cv, ...list.map((c) => ({ ...c, isPrimary: false }))]);
  }

  const open = (id: string) => {
    setBusyId(id);
    const tab = window.open("", "_blank");
    startTransition(async () => {
      const res = await getCvLink(id);
      setBusyId(null);
      if (res.url && tab) tab.location.href = res.url;
      else {
        tab?.close();
        setError(res.error ?? "Couldn't open the file.");
      }
    });
  };

  const makePrimary = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      const res = await setPrimaryCv(id);
      setBusyId(null);
      if (res.error) return setError(res.error);
      setCvs((list) => list.map((c) => ({ ...c, isPrimary: c.id === id })));
    });
  };

  const remove = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteCv(id);
      setBusyId(null);
      setConfirmId(null);
      if (res.error) return setError(res.error);
      setCvs((list) => {
        const wasPrimary = list.find((c) => c.id === id)?.isPrimary;
        const rest = list.filter((c) => c.id !== id);
        return wasPrimary && rest.length ? rest.map((c, i) => ({ ...c, isPrimary: i === 0 })) : rest;
      });
    });
  };

  const busy = stage !== "idle";

  return (
    <section className="rounded-[24px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-7" aria-labelledby="sec-cv">
      <h2 id="sec-cv" className="flex items-center gap-3 font-display text-[1.15rem] font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-forest">
          <FileText size={17} aria-hidden />
        </span>
        Your CV
      </h2>

      <div className="mt-5">
        <FormAlert message={error} />
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) void upload(f);
        }}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-[22px] border-2 border-dashed px-6 py-9 text-center transition-colors duration-200 ${
          over ? "border-forest bg-mint/50" : "border-forest/25 bg-mint/20 hover:bg-mint/35"
        } ${busy ? "pointer-events-none" : ""}`}
      >
        <input
          ref={input}
          type="file"
          accept={CV_ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <motion.span
          animate={busy ? { y: [0, -5, 0] } : over ? { scale: 1.12 } : { scale: 1, y: 0 }}
          transition={busy ? { duration: 1, repeat: Infinity } : { type: "spring", stiffness: 300, damping: 15 }}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-forest shadow-soft"
        >
          {busy ? <Loader2 size={22} className="animate-spin" aria-hidden /> : <UploadCloud size={22} aria-hidden />}
        </motion.span>
        <p className="mt-3 font-display text-[16px] font-bold" aria-live="polite">
          {stage === "uploading" ? "Uploading securely…" : stage === "saving" ? "Saving…" : over ? "Drop it here" : "Upload your CV"}
        </p>
        <p className="mt-1 text-[13.5px] text-muted">Drag a file here or click to choose · PDF or DOCX · up to 5 MB</p>
      </label>

      <p className="mt-3 flex gap-2 text-[12.5px] leading-relaxed text-muted">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-forest" aria-hidden />
        Your CV is stored privately. Only you, and employers you apply to, can open it. You can delete it anytime.
      </p>

      <ul className="mt-5 space-y-2.5">
        <AnimatePresence initial={false}>
          {cvs.map((cv) => (
            <motion.li
              key={cv.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease }}
              className="overflow-hidden rounded-2xl bg-white ring-1 ring-line"
            >
              <div className="flex flex-wrap items-center gap-3 p-3.5 sm:flex-nowrap">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold uppercase ${
                    cv.mimeType === "application/pdf" ? "bg-coral/12 text-[#c2410c]" : "bg-[#dbeafe] text-[#1e40af]"
                  }`}
                  aria-hidden
                >
                  {cv.mimeType === "application/pdf" ? "PDF" : "DOC"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{cv.fileName}</p>
                  <p className="text-[13px] text-muted">
                    {kb(cv.size)} · {new Date(cv.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {cv.isPrimary ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[12px] font-bold text-forest-deep">
                    <Check size={12} strokeWidth={3} aria-hidden /> Main CV
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makePrimary(cv.id)}
                    disabled={busyId === cv.id}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-muted ring-1 ring-line hover:text-ink"
                  >
                    <Star size={12} aria-hidden /> Make main
                  </button>
                )}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => open(cv.id)}
                    disabled={busyId === cv.id}
                    aria-label={`Open ${cv.fileName}`}
                    className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-sand hover:text-ink"
                  >
                    {busyId === cv.id ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ExternalLink size={16} aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(confirmId === cv.id ? null : cv.id)}
                    aria-label={`Delete ${cv.fileName}`}
                    aria-expanded={confirmId === cv.id}
                    className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-coral/10 hover:text-[#c2410c]"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {confirmId === cv.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-coral/[0.06] px-4 py-3 text-[14px]">
                      <span>Delete this CV for good? This can&apos;t be undone.</span>
                      <span className="flex gap-2">
                        <button type="button" onClick={() => setConfirmId(null)} className="rounded-full px-3 py-1.5 font-semibold hover:bg-ink/5">
                          Keep it
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(cv.id)}
                          disabled={busyId === cv.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#c2410c] px-3.5 py-1.5 font-semibold text-white"
                        >
                          {busyId === cv.id && <Loader2 size={14} className="animate-spin" aria-hidden />} Delete
                        </button>
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {cvs.length === 0 && <p className="mt-4 text-center text-[14px] text-muted">No CV uploaded yet.</p>}
    </section>
  );
}
