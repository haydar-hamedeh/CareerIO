"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Loader2 } from "lucide-react";
import { AnimatedArrowRight, AnimatedFileText, AnimatedUploadCloud, useIconTap } from "@/components/animated-icons";
import { FormAlert } from "@/components/auth/fields";
import { ease } from "@/lib/site";

const hasFiles = (dt: DataTransfer | null | undefined) => !!dt && Array.from(dt.types ?? []).includes("Files");

export function EmptyCvDropzone({
  uploading,
  error,
  pageDragOver,
  uploadInput,
  onChoose,
  onFileDrop,
}: {
  uploading: boolean;
  error?: string;
  pageDragOver: boolean;
  uploadInput: React.ReactNode;
  onChoose: () => void;
  onFileDrop: (file: File) => void;
}) {
  const [zoneOver, setZoneOver] = useState(false);
  const reduce = useReducedMotion();
  const uploadTap = useIconTap();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [1.6, -1.6]), { stiffness: 220, damping: 24 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-1.6, 1.6]), { stiffness: 220, damping: 24 });

  const isActive = !uploading && (zoneOver || pageDragOver);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
      <motion.div
        initial={reduce ? undefined : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0, scale: isActive ? 1.015 : 1 }}
        transition={{ duration: 0.55, ease }}
        style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 1000 }}
        onPointerMove={(e) => {
          if (reduce || e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          mx.set((e.clientX - r.left) / r.width);
          my.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => {
          mx.set(0.5);
          my.set(0.5);
        }}
        className="w-full max-w-[600px]"
      >
        <div
          role="region"
          aria-label="CV upload dropzone"
          onClick={() => {
            if (!uploading) onChoose();
          }}
          onDragEnter={(e) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
            setZoneOver(true);
          }}
          onDragOver={(e) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = uploading ? "none" : "copy";
            setZoneOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setZoneOver(false);
          }}
          onDrop={(e) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
            e.stopPropagation();
            setZoneOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFileDrop(f);
          }}
          className={`cursor-pointer rounded-[2rem] p-2 transition-colors duration-300 ${
            isActive ? "bg-forest/10 ring-1 ring-forest/30 shadow-lift" : "bg-ink/[0.035] ring-1 ring-line shadow-soft hover:ring-ink/20"
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-[calc(2rem-0.5rem)] border-2 border-dashed px-6 py-10 text-center transition-colors duration-300 sm:px-10 sm:py-12 ${
              isActive
                ? "border-forest bg-mint/35"
                : uploading
                  ? "border-forest/40 bg-paper"
                  : "border-forest/25 bg-paper shadow-[inset_0_1px_1px_rgba(255,255,255,0.75)]"
            }`}
          >
            <motion.div
              aria-hidden
              animate={reduce ? undefined : { opacity: isActive ? 0.85 : [0.35, 0.55, 0.35], scale: isActive ? 1.15 : [1, 1.06, 1] }}
              transition={isActive ? { duration: 0.25 } : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-mint/70 blur-3xl"
            />

            <motion.span
              animate={reduce ? undefined : uploading ? { y: [0, -4, 0] } : isActive ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
              transition={uploading ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 320, damping: 22 }}
              className="relative mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-mint text-forest shadow-soft"
            >
              {uploading ? (
                <Loader2 size={28} className="animate-spin" aria-hidden />
              ) : isActive ? (
                <AnimatedUploadCloud size={28} />
              ) : (
                <AnimatedFileText size={28} />
              )}
            </motion.span>

            <h1 className="relative mt-6 font-display text-[1.85rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.1rem]">
              {uploading ? "Uploading your CV…" : isActive ? "Drop your PDF or DOCX here" : "Upload a CV to grade"}
            </h1>
            <p className="relative mx-auto mt-2.5 max-w-[44ch] text-[15px] leading-relaxed text-muted">
              Drag & drop a PDF or Word (.docx) anywhere on this page, or choose a file. Up to 5 MB · stored privately; delete anytime.
            </p>

            <div className="relative mx-auto mt-5 max-w-sm" onClick={(e) => e.stopPropagation()}>
              <FormAlert message={error} />
            </div>

            <div className="relative mt-3 flex flex-col items-center">
              <motion.label
                {...uploadTap}
                whileTap={uploading ? undefined : { scale: 0.97 }}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-full bg-forest px-7 font-display text-[15px] font-bold text-white shadow-soft transition-colors hover:bg-forest-deep has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest"
              >
                {uploadInput}
                {uploading ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <AnimatedUploadCloud size={17} />}
                {uploading ? "Uploading…" : "Upload a CV"}
              </motion.label>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[12px] font-medium text-muted">
                <span className="rounded-full bg-white/85 px-3 py-1 ring-1 ring-line">PDF or DOCX</span>
                <span className="rounded-full bg-white/85 px-3 py-1 ring-1 ring-line">Max 5 MB</span>
                <span className="rounded-full bg-white/85 px-3 py-1 ring-1 ring-line">Drop anywhere</span>
              </div>
            </div>

            <p className="relative mt-6 text-[13px] text-muted">
              Or manage your files on your{" "}
              <Link
                href="/profile"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-semibold text-forest hover:underline"
              >
                <motion.span initial="rest" animate="rest" whileHover="play" whileFocus="play" className="inline-flex items-center gap-1">
                  profile
                  <AnimatedArrowRight size={13} />
                </motion.span>
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
