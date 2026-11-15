"use client";

import { createClient } from "@/lib/supabase/client";
import { registerCv, type CvItem } from "@/app/profile/actions";

export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const fileSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Validate, upload to the private bucket, then register the CV row. The new CV becomes the main one. */
export async function uploadCvFile(userId: string, file: File): Promise<{ cv?: CvItem; error?: string }> {
  const name = file.name.toLowerCase();
  const ext = file.type === PDF || name.endsWith(".pdf") ? "pdf" : file.type === DOCX || name.endsWith(".docx") ? "docx" : null;
  if (!ext) return { error: "Upload a PDF or Word (.docx) file." };
  if (file.size === 0) return { error: "That file is empty." };
  if (file.size > CV_MAX_BYTES) return { error: `That file is ${fileSize(file.size)}. The limit is 5 MB.` };

  try {
    const mimeType = ext === "pdf" ? PDF : DOCX;
    const hash = await sha256(file);
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await createClient().storage.from("cvs").upload(path, file, { contentType: mimeType, upsert: false });
    if (upErr) return { error: "Upload failed. Check your connection and try again." };
    const res = await registerCv({ path, fileName: file.name.slice(0, 255), mimeType: mimeType as never, size: file.size, hash });
    if (res.error || !res.cv) return { error: res.error ?? "We couldn't save your CV. Please try again." };
    return { cv: res.cv };
  } catch {
    return { error: "Upload failed. Check your connection and try again." };
  }
}
