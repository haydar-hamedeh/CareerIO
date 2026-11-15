"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Crosshair, FileText, ListChecks, Loader2, PenLine, ShieldCheck, Sparkles, Target } from "lucide-react";
import { AnimatedArrowRight, AnimatedCheck, AnimatedTrash, AnimatedUploadCloud, useIconTap } from "@/components/animated-icons";
import { toast } from "sonner";
import { FormAlert } from "@/components/auth/fields";
import { CV_ACCEPT, uploadCvFile } from "@/components/profile/cv-upload";
import { deleteCv } from "@/app/profile/actions";
import { ease } from "@/lib/site";
import { EmptyCvDropzone } from "./grader-empty";
import { Results } from "./grader-results";
import { ScoreHistory } from "./score-history";
import { RUBRIC_AXES, type Cv, type GradePoint, type Job, type Result, type TargetKind } from "./types";

const STAGES = ["Reading your CV", "Running quick checks", "Scoring against the rubric", "Writing your feedback"];
const STAGE_AT = [0, 5000, 9000, 15000];
const WEIGHT_OPACITY = [1, 0.82, 0.66, 0.52, 0.4, 0.28];

const hasFiles = (dt: DataTransfer | null | undefined) => !!dt && Array.from(dt.types ?? []).includes("Files");
const fileExt = (name: string) => (name.split(".").pop() ?? "cv").slice(0, 4).toUpperCase();

function IconTapButton({ children, ...props }: React.ComponentProps<typeof motion.button>) {
  const tap = useIconTap();
  return (
    <motion.button {...tap} whileTap={{ scale: 0.94 }} {...props}>
      {children}
    </motion.button>
  );
}

function StepLabel({ n, title, aside }: { n: number; title: string; aside?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-forest text-[12px] font-extrabold text-white">{n}</span>
        <span className="font-display text-[14.5px] font-bold tracking-[-0.01em]">{title}</span>
      </span>
      {aside && <span className="text-[11.5px] text-muted">{aside}</span>}
    </div>
  );
}

const targetKey = (kind: TargetKind, role: string, job: Job) =>
  kind === "job" && job ? `job:${job.id}` : kind === "role" ? `role:${role.trim().toLowerCase()}` : "general";

export function GraderClient({
  userId,
  cvs: initialCvs,
  roles,
  job,
  history: initialHistory,
}: {
  userId: string;
  cvs: Cv[];
  roles: string[];
  job: Job;
  history: GradePoint[];
}) {
  const [cvs, setCvs] = useState(initialCvs);
  const [history, setHistory] = useState(initialHistory);
  const [cvId, setCvId] = useState(initialCvs.find((c) => c.isPrimary)?.id ?? initialCvs[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const [pageDragOver, setPageDragOver] = useState(false);
  const [sideDropOver, setSideDropOver] = useState(false);
  const [emptyResultDropOver, setEmptyResultDropOver] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const dragDepth = useRef(0);
  const [kind, setKind] = useState<TargetKind>(job ? "job" : roles.length ? "role" : "general");
  const [role, setRole] = useState(roles[0] ?? "");
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<Result | null>(null);
  const [gradedKey, setGradedKey] = useState("");
  const [error, setError] = useState<string>();

  const reduce = useReducedMotion();
  const gradeTap = useIconTap();
  const studioGradeTap = useIconTap();
  const sideUploadTap = useIconTap();
  const busy = stage >= 0;

  const resetDrag = useCallback(() => {
    dragDepth.current = 0;
    setPageDragOver(false);
    setSideDropOver(false);
    setEmptyResultDropOver(false);
  }, []);

  const addCv = useCallback(
    async (file: File) => {
      setError(undefined);
      setUploading(true);
      const res = await uploadCvFile(userId, file);
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
      if (res.error || !res.cv) {
        if (res.error) toast.error(res.error);
        return setError(res.error);
      }
      const cv = res.cv;
      toast.success("CV uploaded", { description: `${cv.fileName} is now your main CV.` });
      setCvs((list) => [{ id: cv.id, fileName: cv.fileName, isPrimary: true }, ...list.map((c) => ({ ...c, isPrimary: false }))]);
      setCvId(cv.id);
      setResult(null);
    },
    [userId],
  );

  const stateRef = useRef({ uploading, busy, addCv });
  useEffect(() => {
    stateRef.current = { uploading, busy, addCv };
  }, [uploading, busy, addCv]);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setPageDragOver(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = stateRef.current.uploading || stateRef.current.busy ? "none" : "copy";
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) resetDrag();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      resetDrag();
      const file = e.dataTransfer?.files?.[0];
      if (file && !stateRef.current.uploading && !stateRef.current.busy) {
        void stateRef.current.addCv(file);
      }
    };
    const onDragEnd = () => resetDrag();

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, [resetDrag]);

  async function removeCv(id: string) {
    setDeletingId(id);
    const res = await deleteCv(id);
    setDeletingId(null);
    setConfirmId(null);
    if (res.error) {
      toast.error(res.error);
      return setError(res.error);
    }
    toast.success("CV deleted");
    const rest = cvs.filter((c) => c.id !== id);
    const wasPrimary = cvs.find((c) => c.id === id)?.isPrimary;
    const next = wasPrimary && rest.length ? rest.map((c, i) => ({ ...c, isPrimary: i === 0 })) : rest;
    setCvs(next);
    if (cvId === id) {
      setCvId(next[0]?.id ?? "");
      setResult(null);
    }
  }

  const uploadInput = (
    <input
      ref={fileInput}
      type="file"
      accept={CV_ACCEPT}
      className="sr-only"
      disabled={uploading}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void addCv(f);
      }}
    />
  );

  useEffect(() => {
    if (stage < 0 || stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage((s) => (s >= 0 && s < STAGES.length - 1 ? s + 1 : s)), STAGE_AT[stage + 1] - STAGE_AT[stage]);
    return () => clearTimeout(t);
  }, [stage]);

  async function grade() {
    setError(undefined);
    setResult(null);
    setStage(0);
    const top = stageRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 72 || window.matchMedia("(max-width: 1023px)").matches) {
      stageRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
    const key = `${cvId}|${targetKey(kind, role, job)}`;
    const target = kind === "job" && job ? { kind, jobId: job.id } : kind === "role" && role.trim() ? { kind, role: role.trim() } : { kind: "general" };
    try {
      const res = await fetch("/api/grade", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cvId, target }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Grading failed.");
      setResult(body);
      setGradedKey(key);
      if (!body.cached) {
        setHistory((h) => [...h, { id: `local-${Date.now()}`, cvId, score: body.score, target: targetKey(kind, role, job), createdAt: body.createdAt }]);
      }
      toast.success(`Graded: ${body.score}/100`, { description: body.targetLabel });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Grading failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setStage(-1);
    }
  }

  if (cvs.length === 0) {
    return (
      <EmptyCvDropzone
        uploading={uploading}
        error={error}
        pageDragOver={pageDragOver}
        uploadInput={uploadInput}
        onChoose={() => fileInput.current?.click()}
        onFileDrop={(file) => {
          resetDrag();
          if (!uploading) void addCv(file);
        }}
      />
    );
  }

  const selectedCv = cvs.find((c) => c.id === cvId) ?? cvs[0];
  const canGrade = !busy && Boolean(cvId) && (kind !== "role" || role.trim().length >= 2);
  const historyChart = <ScoreHistory history={history} cvId={cvId} />;
  const stale = Boolean(result) && gradedKey !== `${cvId}|${targetKey(kind, role, job)}`;
  const targetPreviewLabel =
    kind === "job" && job ? `${job.title}${job.company ? ` at ${job.company}` : ""}` : kind === "role" ? role.trim() || "Choose a target role" : "General quality review";

  return (
    <div className="relative mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:py-12">
      <AnimatePresence>
        {pageDragOver && !uploading && !busy && (
          <motion.div
            key="page-drop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-sand/80 px-4 backdrop-blur-sm"
            aria-hidden
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className="w-full max-w-[440px] rounded-[2rem] bg-forest/10 p-2 shadow-lift ring-1 ring-forest/20"
            >
              <div className="rounded-[calc(2rem-0.5rem)] border-2 border-dashed border-forest bg-paper px-8 py-10 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint text-forest shadow-soft">
                  <AnimatedUploadCloud size={26} />
                </span>
                <p className="mt-4 font-display text-xl font-extrabold tracking-[-0.02em] text-ink">Drop your CV to upload</p>
                <p className="mt-1.5 text-[14px] text-muted">PDF or DOCX · up to 5 MB · sets as your main CV</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-[11.5px] font-bold tracking-[0.12em] text-forest-deep uppercase">
            <Sparkles size={12} aria-hidden /> CV Studio
          </span>
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.02] font-extrabold tracking-[-0.035em]">CV Grader</h1>
          <p className="mt-3 max-w-[54ch] text-[15.5px] leading-relaxed text-muted">
            Honest rubric scoring, exact line rewrites from your own CV facts, and a clear list of what to fix for the role you want.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-medium text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3.5 py-2 ring-1 ring-line">
            <ShieldCheck size={14} className="text-forest" aria-hidden />
            Name &amp; contact stripped before scoring
          </span>
          <span className="rounded-full bg-paper px-3.5 py-2 font-semibold text-forest-deep ring-1 ring-line tabular-nums">
            {cvs.length} {cvs.length === 1 ? "CV saved" : "CVs saved"}
          </span>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0 w-full lg:sticky lg:top-24 lg:self-start">
          <div className="min-w-0 rounded-[32px] bg-ink/[0.035] p-2 shadow-soft ring-1 ring-line">
            <section className="min-w-0 space-y-6 rounded-[26px] bg-paper p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.75)] sm:p-6">
              <fieldset aria-label="Choose your CV" className="min-w-0 w-full">
                <StepLabel n={1} title="Choose your CV" aside="PDF or DOCX · max 5 MB" />
                <ul data-lenis-prevent className="max-h-[188px] space-y-2 overflow-y-auto overscroll-contain pr-0.5">
                  <AnimatePresence initial={false}>
                    {cvs.map((c) => (
                      <motion.li
                        key={c.id}
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease }}
                        className="overflow-hidden"
                      >
                        <div
                          className={`flex items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-2 text-[13.5px] ring-1 transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest ${
                            cvId === c.id ? "bg-mint/60 shadow-soft ring-2 ring-forest" : "bg-white ring-line hover:ring-ink/25"
                          }`}
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1">
                            <input
                              type="radio"
                              name="cv"
                              className="sr-only"
                              checked={cvId === c.id}
                              onChange={() => {
                                setCvId(c.id);
                              }}
                            />
                            <span
                              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-extrabold tracking-wide ${
                                cvId === c.id ? "bg-forest text-white" : "bg-mint text-forest-deep"
                              }`}
                            >
                              {fileExt(c.fileName)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{c.fileName}</span>
                              {c.isPrimary && <span className="text-[11px] font-bold tracking-wide text-forest uppercase">Main CV</span>}
                            </span>
                          </label>
                          <IconTapButton
                            type="button"
                            onClick={() => setConfirmId(confirmId === c.id ? null : c.id)}
                            disabled={busy || deletingId === c.id}
                            aria-label={`Remove ${c.fileName}`}
                            aria-expanded={confirmId === c.id}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-coral/10 hover:text-[#c2410c] disabled:opacity-50"
                          >
                            {deletingId === c.id ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <AnimatedTrash size={14} />}
                          </IconTapButton>
                        </div>
                        <AnimatePresence initial={false}>
                          {confirmId === c.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease }}
                              className="overflow-hidden"
                            >
                              <div className="mt-1.5 flex items-center justify-between gap-2 rounded-2xl bg-coral/[0.07] px-3.5 py-2 text-[12.5px]">
                                <span>Delete this CV and its grades?</span>
                                <span className="flex shrink-0 gap-1">
                                  <button type="button" onClick={() => setConfirmId(null)} className="rounded-full px-2.5 py-1 font-semibold hover:bg-ink/5">
                                    Keep
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void removeCv(c.id)}
                                    disabled={deletingId === c.id}
                                    className="rounded-full bg-[#c2410c] px-3 py-1 font-semibold text-white"
                                  >
                                    Delete
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
                <motion.label
                  {...sideUploadTap}
                  whileTap={busy ? undefined : { scale: 0.985 }}
                  onDragEnter={(e) => {
                    if (!hasFiles(e.dataTransfer)) return;
                    e.preventDefault();
                    setSideDropOver(true);
                  }}
                  onDragOver={(e) => {
                    if (!hasFiles(e.dataTransfer)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = uploading || busy ? "none" : "copy";
                    setSideDropOver(true);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setSideDropOver(false);
                  }}
                  onDrop={(e) => {
                    if (!hasFiles(e.dataTransfer)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    resetDrag();
                    const f = e.dataTransfer.files?.[0];
                    if (f && !uploading && !busy) void addCv(f);
                  }}
                  className={`mt-2.5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-3 py-2.5 text-[13px] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest ${
                    uploading || sideDropOver ? "border-forest bg-mint/55 text-forest" : "border-forest/25 text-forest hover:bg-mint/40"
                  } ${busy ? "pointer-events-none opacity-60" : ""}`}
                >
                  {uploadInput}
                  {uploading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <AnimatedUploadCloud size={15} />}
                  {uploading ? "Uploading securely…" : sideDropOver ? "Drop CV here" : "Upload another CV"}
                </motion.label>
              </fieldset>

              <div className="h-px bg-line" aria-hidden />

              <fieldset aria-label="Pick a target" className="min-w-0 w-full">
                <StepLabel n={2} title="Pick a target" />
                <div className={`grid w-full gap-1 rounded-2xl bg-sand p-1 text-[13px] font-semibold ring-1 ring-line ${job ? "grid-cols-3" : "grid-cols-2"}`}>
                  {(["role", ...(job ? ["job"] : []), "general"] as TargetKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      aria-pressed={kind === k}
                      className={`relative rounded-xl px-2 py-2 transition-colors ${kind === k ? "text-white" : "text-muted hover:text-ink"}`}
                    >
                      {kind === k && (
                        <motion.span
                          layoutId="grade-kind"
                          className="absolute inset-0 rounded-xl bg-forest shadow-soft"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="relative">{k === "role" ? "A role" : k === "job" ? "This job" : "General"}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-3 min-w-0">
                  {kind === "role" && (
                    <div className="min-w-0 space-y-2.5">
                      <input
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="Type any target role, e.g. Financial Analyst"
                        aria-label="Target role"
                        className="h-11 w-full min-w-0 rounded-2xl bg-white px-4 text-[14px] ring-1 ring-line outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-forest"
                      />
                      {roles.length > 0 && (
                        <div data-lenis-prevent className="flex max-h-[96px] flex-wrap gap-1.5 overflow-y-auto overscroll-contain pr-0.5">
                          {roles.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setRole(r)}
                              aria-pressed={role === r}
                              className={`max-w-full truncate rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
                                role === r ? "bg-forest text-white" : "bg-white text-ink/80 ring-1 ring-line hover:ring-ink/25"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {kind === "job" && job && (
                    <p className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-[13.5px] ring-1 ring-line">
                      <Target size={16} className="shrink-0 text-forest" aria-hidden />
                      <span className="min-w-0 truncate">
                        <span className="font-semibold">{job.title}</span> <span className="text-muted">at {job.company}</span>
                      </span>
                    </p>
                  )}
                  {kind === "general" && (
                    <p className="rounded-2xl bg-white/80 px-4 py-3 text-[13px] leading-snug text-muted ring-1 ring-line">
                      General CV quality review across structure, clarity, and impact.
                    </p>
                  )}
                </div>
              </fieldset>

              <div className="space-y-2.5">
                <motion.button
                  type="button"
                  onClick={grade}
                  disabled={!canGrade}
                  {...gradeTap}
                  whileTap={canGrade ? { scale: 0.98 } : undefined}
                  className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0e7a5f,#0a5c48)] font-display text-[15px] font-bold text-white shadow-lift transition-[filter,opacity] hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
                >
                  {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <AnimatedCheck size={17} strokeWidth={3} />}
                  {busy ? "Grading your CV…" : stale ? "Grade again" : "Grade my CV"}
                </motion.button>
                <p className="text-center text-[11.5px] leading-relaxed text-muted">AI estimate, not a guarantee · Rewrites use only your own CV facts</p>
              </div>
            </section>
          </div>
        </aside>

        <section ref={stageRef} className="min-w-0 scroll-mt-24" aria-live="polite">
          <FormAlert message={error} />
          <AnimatePresence mode="wait">
            {busy ? (
              <motion.div
                key="busy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease }}
              >
                <Hero>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <HeroEyebrow>Analyzing CV</HeroEyebrow>
                      <h2 className="mt-2 truncate font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.025em]">Grading {selectedCv?.fileName ?? "your CV"}…</h2>
                      <p className="mt-1.5 text-[14px] text-white/75">Target: {targetPreviewLabel} · usually 10–25 seconds on first run.</p>
                    </div>
                    <span className="rounded-full bg-white/14 px-3.5 py-1.5 font-display text-[13px] font-bold tabular-nums ring-1 ring-white/20">
                      Step {Math.min(stage + 1, STAGES.length)} of {STAGES.length}
                    </span>
                  </div>

                  <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/15">
                    <motion.div
                      className="h-full origin-left rounded-full bg-mint"
                      initial={{ scaleX: 0.12 }}
                      animate={{ scaleX: (stage + 1) / STAGES.length }}
                      transition={{ duration: 0.65, ease }}
                    />
                  </div>

                  <ol className="mt-6 grid gap-2.5 sm:grid-cols-2">
                    {STAGES.map((s, i) => (
                      <li
                        key={s}
                        className={`flex items-center gap-3 rounded-2xl p-3.5 text-[14.5px] ring-1 transition-colors ${
                          i === stage ? "bg-white/18 ring-white/40" : i < stage ? "bg-white/10 ring-white/15" : "bg-transparent ring-white/10"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold transition-colors duration-300 ${
                            i < stage ? "bg-mint text-forest-deep" : i === stage ? "bg-white text-forest" : "bg-white/12 text-white/60"
                          }`}
                        >
                          {i < stage ? <AnimatedCheck size={14} strokeWidth={3} /> : i === stage ? <Loader2 size={14} className="animate-spin" aria-hidden /> : i + 1}
                        </span>
                        <span className={i <= stage ? "font-semibold" : "text-white/60"}>{s}</span>
                      </li>
                    ))}
                  </ol>
                </Hero>
              </motion.div>
            ) : result ? (
              <Results key="result" r={result} stale={stale} onRegrade={grade} canRegrade={canGrade} afterHero={historyChart} />
            ) : (
              <motion.div
                key="empty"
                initial={reduce ? undefined : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease }}
                onDragEnter={(e) => {
                  if (!hasFiles(e.dataTransfer)) return;
                  e.preventDefault();
                  setEmptyResultDropOver(true);
                }}
                onDragOver={(e) => {
                  if (!hasFiles(e.dataTransfer)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = uploading ? "none" : "copy";
                  setEmptyResultDropOver(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setEmptyResultDropOver(false);
                }}
                onDrop={(e) => {
                  if (!hasFiles(e.dataTransfer)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  resetDrag();
                  const f = e.dataTransfer.files?.[0];
                  if (f && !uploading) void addCv(f);
                }}
                className="space-y-4"
              >
                <Hero>
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <HeroEyebrow>{emptyResultDropOver ? "Drop to switch CV" : "Ready to grade"}</HeroEyebrow>
                      <h2 className="mt-2.5 truncate font-display text-[clamp(1.5rem,2.6vw,2rem)] leading-tight font-extrabold tracking-[-0.03em]">{selectedCv?.fileName}</h2>
                      <p className="mt-2 text-[14.5px] text-white/75">
                        Target: <span className="font-semibold text-white">{targetPreviewLabel}</span>
                      </p>
                      <motion.button
                        type="button"
                        onClick={grade}
                        disabled={!canGrade}
                        {...studioGradeTap}
                        whileTap={canGrade ? { scale: 0.97 } : undefined}
                        className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-display text-[15px] font-bold text-forest-deep shadow-lift transition-colors hover:bg-mint disabled:opacity-60"
                      >
                        Grade now
                        <AnimatedArrowRight size={16} />
                      </motion.button>
                    </div>
                    <GhostRing />
                  </div>
                </Hero>

                {historyChart}

                <div className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-7">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-[1.15rem] font-extrabold tracking-[-0.02em]">How your score is calculated</h3>
                    <span className="text-[12.5px] text-muted">6 weighted criteria · 100% total</span>
                  </div>

                  <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-ink/[0.06]" role="img" aria-label="Score weights by criterion">
                    {RUBRIC_AXES.map((a, i) => (
                      <motion.span
                        key={a.key}
                        className="h-full bg-forest"
                        style={{ width: `${a.weight}%`, opacity: WEIGHT_OPACITY[i], borderRight: "2px solid var(--paper)" }}
                        initial={reduce ? undefined : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.7, ease, delay: 0.1 + i * 0.06 }}
                      />
                    ))}
                  </div>

                  <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    {RUBRIC_AXES.map((axis, i) => (
                      <motion.li
                        key={axis.key}
                        initial={reduce ? undefined : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease, delay: 0.05 + i * 0.04 }}
                        className="flex gap-3"
                      >
                        <span className="mt-1 h-3 w-3 shrink-0 rounded-[4px] bg-forest" style={{ opacity: WEIGHT_OPACITY[i] }} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-display text-[14px] font-bold">{axis.label}</span>
                            <span className="font-display text-[14px] font-extrabold text-forest-deep tabular-nums">{axis.weight}%</span>
                          </div>
                          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{axis.hint}</p>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                <ul className="grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: ListChecks, title: "7 instant checks", text: "Dates, contact info, length, weak openings & metrics." },
                    { icon: PenLine, title: "Exact line rewrites", text: "Flags weak bullets without inventing fake claims." },
                    { icon: Crosshair, title: "Role-fit gaps", text: "Missing keywords & prioritized next edits." },
                  ].map((f, i) => (
                    <motion.li
                      key={f.title}
                      initial={reduce ? undefined : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease, delay: 0.2 + i * 0.05 }}
                      className="rounded-3xl bg-paper p-4 shadow-soft ring-1 ring-line"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-forest-deep">
                        <f.icon size={17} aria-hidden />
                      </span>
                      <p className="mt-3 font-display text-[14px] font-bold">{f.title}</p>
                      <p className="mt-1 text-[12.5px] leading-snug text-muted">{f.text}</p>
                    </motion.li>
                  ))}
                </ul>

                <p
                  className={`flex items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-center text-[12.5px] transition-colors ${
                    emptyResultDropOver ? "border-forest bg-mint/40 text-forest-deep" : "border-ink/15 text-muted"
                  }`}
                >
                  <FileText size={14} aria-hidden />
                  {emptyResultDropOver ? "Release the file to upload and make it your main CV." : "Tip: drop a new PDF or DOCX anywhere on this page to upload a fresh version."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

function Hero({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0b5f4a_0%,#0e7a5f_55%,#14906f_100%)] p-6 text-white shadow-lift sm:p-9">
      <div aria-hidden className="pointer-events-none absolute -top-28 -right-20 h-72 w-72 rounded-full bg-mint/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-sun/20 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}

function HeroEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1 text-[11.5px] font-bold tracking-[0.12em] uppercase ring-1 ring-white/20">
      <span className="h-1.5 w-1.5 rounded-full bg-mint" aria-hidden />
      {children}
    </span>
  );
}

function GhostRing() {
  const size = 132;
  const stroke = 10;
  const r = (size - stroke) / 2;
  return (
    <div className="hidden shrink-0 rounded-full bg-paper/95 p-3 shadow-lift sm:block" aria-hidden>
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mint)" strokeWidth={stroke} strokeDasharray="3 9" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center text-ink">
          <div>
            <p className="font-display text-[2rem] leading-none font-extrabold text-ink/25">?</p>
            <p className="mt-1 text-[11px] font-medium text-muted">your score</p>
          </div>
        </div>
      </div>
    </div>
  );
}
