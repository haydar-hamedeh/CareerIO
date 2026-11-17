"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Bookmark, CheckCircle2, FileCheck2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { setJobSaved } from "@/app/feed/actions";
import { withdrawApplication } from "@/app/jobs/actions";
import type { ScreeningQuestion } from "@/lib/jobs/screening";
import { ApplyDialog } from "./apply-dialog";

type Cv = { id: string; fileName: string; isPrimary: boolean };

export type ApplicationInfo = { status: "applied" | "in_review" | "interview" | "rejected" | "hired"; createdAt: string };

const statusUi: Record<ApplicationInfo["status"], { label: string; note: string; tone: string }> = {
  applied: { label: "Application sent", note: "The employer will review it soon.", tone: "bg-mint text-forest-deep" },
  in_review: { label: "In review", note: "The employer is looking at your application.", tone: "bg-sun/35 text-[#6b4700]" },
  interview: { label: "Interview", note: "They want to talk to you. Watch for their message.", tone: "bg-forest text-white" },
  rejected: { label: "Not selected", note: "This one didn't work out. Keep going.", tone: "bg-ink/[0.07] text-muted" },
  hired: { label: "Hired", note: "Congratulations!", tone: "bg-forest text-white" },
};

export function ApplyCard({
  jobId,
  title,
  company,
  cvs,
  profile,
  application,
  questions,
  saved: initialSaved,
  children,
}: {
  jobId: string;
  title: string;
  company: string;
  cvs: Cv[];
  profile: { phone: string | null; country: string | null };
  application: ApplicationInfo | null;
  questions?: ScreeningQuestion[];
  saved: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggleSave = () => {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const res = await setJobSaved(jobId, next);
      if (!res.ok) {
        setSaved(!next);
        toast.error("Couldn't update saved jobs.");
      }
    });
  };

  const withdraw = () =>
    startTransition(async () => {
      const res = await withdrawApplication(jobId);
      setConfirming(false);
      if (res.error) return void toast.error(res.error);
      toast.success("Application withdrawn");
      router.refresh();
    });

  const s = application ? statusUi[application.status] : null;

  return (
    <div className="space-y-3">
      {application && s ? (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold ${s.tone}`}>
            <CheckCircle2 size={14} aria-hidden />
            {s.label}
          </span>
          <p className="mt-2.5 text-[13.5px] leading-snug text-muted">{s.note}</p>
          <p className="mt-1 text-[12px] text-muted">
            Applied {new Date(application.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          {application.status === "applied" &&
            (confirming ? (
              <div className="mt-3 flex items-center gap-2 text-[13px]">
                <span className="text-muted">Withdraw?</span>
                <button type="button" onClick={() => setConfirming(false)} className="rounded-full px-3 py-1 font-semibold hover:bg-ink/5">
                  Keep
                </button>
                <button type="button" onClick={withdraw} disabled={pending} className="inline-flex items-center gap-1.5 rounded-full bg-[#c2410c] px-3 py-1 font-semibold text-white">
                  {pending && <Loader2 size={12} className="animate-spin" aria-hidden />}
                  Withdraw
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="mt-3 text-[13px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
                Withdraw application
              </button>
            ))}
        </div>
      ) : (
        <ApplyDialog jobId={jobId} jobTitle={title} company={company} cvs={cvs} profile={profile} questions={questions}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0e7a5f,#0a5c48)] font-display text-[15px] font-bold text-white shadow-lift transition-[filter] hover:brightness-110"
          >
            <Send size={16} aria-hidden />
            Apply now
            <ArrowRight size={16} aria-hidden />
          </motion.button>
        </ApplyDialog>
      )}

      {children}

      <div className="grid grid-cols-2 gap-2">
        <motion.button
          type="button"
          onClick={toggleSave}
          aria-pressed={saved}
          whileTap={{ scale: 0.97 }}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors ${
            saved ? "bg-forest text-white" : "bg-white text-ink ring-1 ring-line hover:ring-ink/25"
          }`}
        >
          <Bookmark size={15} className={saved ? "fill-current" : ""} aria-hidden />
          {saved ? "Saved" : "Save"}
        </motion.button>
        <Link
          href={`/grader?job=${jobId}`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-ink ring-1 ring-line transition-colors hover:bg-mint/50 hover:ring-forest/30"
        >
          <FileCheck2 size={15} className="text-forest" aria-hidden />
          Grade CV
        </Link>
      </div>
    </div>
  );
}
