import "server-only";
import mammoth from "mammoth";
import { admin } from "@/lib/supabase/admin";
import { PARSE_VERSION, extractCv, parsedCvSchema, type ParsedCv } from "./cv";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type CvRow = { id: string; storage_path: string; mime_type: string; parsed: unknown };

/**
 * The structured content of a CV. Uses the stored parse when there is one; otherwise reads the file once and stores
 * the result so the next caller (the grader, another application) does not pay for it again. Never throws.
 */
export async function loadParsedCv(cv: CvRow): Promise<ParsedCv | null> {
  const stored = cv.parsed as { v?: string; data?: unknown } | null;
  if (stored?.v === PARSE_VERSION) {
    const ok = parsedCvSchema.safeParse(stored.data);
    if (ok.success) return ok.data;
  }
  try {
    const db = admin();
    const { data: blob, error } = await db.storage.from("cvs").download(cv.storage_path);
    if (error || !blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = cv.mime_type === DOCX ? (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value : undefined;
    if (cv.mime_type === DOCX && !text?.trim()) return null;
    const { data } = await extractCv({ bytes, mime: cv.mime_type, text });
    await db.from("cvs").update({ parsed: { v: PARSE_VERSION, data }, parse_status: "parsed" }).eq("id", cv.id);
    return data;
  } catch {
    return null;
  }
}
