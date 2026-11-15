import "server-only";
import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";
import { admin, hasAdmin } from "../supabase/admin";

export const models = {
  chat: process.env.GEMINI_CHAT_MODEL || "gemini-3.6-flash",
  fallback: process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite",
  embed: process.env.GEMINI_EMBED_MODEL || "gemini-embedding-2",
};

export const EMBED_DIMS = 768;

// USD per 1M tokens, used only for the "estimated cost" column. Override from the official pricing page.
const PRICE_IN = Number(process.env.GEMINI_PRICE_IN_PER_M ?? 0.3);
const PRICE_OUT = Number(process.env.GEMINI_PRICE_OUT_PER_M ?? 2.5);

let client: GoogleGenAI | null = null;
function ai() {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiUnavailableError("GEMINI_API_KEY is not set.");
  client = new GoogleGenAI({ apiKey });
  return client;
}

export class AiBusyError extends Error {
  constructor() {
    super("The AI is busy right now. Please try again in a minute.");
  }
}
export class AiUnavailableError extends Error {}
export class AiOutputError extends Error {
  constructor() {
    super("The AI returned something we couldn't use. Please try again.");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryable = (e: unknown) =>
  (e instanceof ApiError && [429, 500, 502, 503, 504].includes(e.status)) ||
  (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError" || /fetch failed|ECONNRESET|timed out/i.test(e.message)));

async function logCall(row: {
  feature: string;
  model: string;
  latency_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  ok: boolean;
  error_code?: string;
}) {
  if (!hasAdmin()) return;
  const est = ((row.input_tokens ?? 0) * PRICE_IN + (row.output_tokens ?? 0) * PRICE_OUT) / 1_000_000;
  try {
    await admin().from("ai_calls").insert({ ...row, est_cost_usd: Number(est.toFixed(6)) });
  } catch {
    // Logging must never break the user flow.
  }
}

function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })), ms)),
  ]);
}

type JsonOptions<S extends z.ZodType> = {
  feature: string;
  schema: S;
  system: string;
  parts: Part[];
  temperature?: number;
  thinkingBudget?: number;
  timeoutMs?: number;
  model?: string;
};

/**
 * Structured generation: JSON schema output, Zod validation, one repair attempt,
 * retries with backoff on rate limits / overload, then the fallback model.
 */
export async function generateJson<S extends z.ZodType>(opts: JsonOptions<S>): Promise<{ data: z.infer<S>; model: string }> {
  const jsonSchema = forGemini(z.toJSONSchema(opts.schema, { target: "draft-7" }));
  const first = opts.model ?? models.chat;
  const chain = [first, first === models.chat ? models.fallback : models.chat];

  for (const model of chain) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const started = Date.now();
      try {
        const res = await withTimeout(
          ai().models.generateContent({
            model,
            contents: [{ role: "user", parts: opts.parts }],
            config: {
              systemInstruction: opts.system,
              responseMimeType: "application/json",
              responseJsonSchema: jsonSchema,
              temperature: opts.temperature ?? 0,
              ...(opts.thinkingBudget !== undefined && model === models.chat
                ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } }
                : {}),
            },
          }),
          opts.timeoutMs ?? 45_000,
        );
        const usage = res.usageMetadata;
        const text = res.text ?? "";
        let parsed = opts.schema.safeParse(safeJson(text));
        if (!parsed.success) {
          parsed = opts.schema.safeParse(repairJson(text));
        }
        await logCall({
          feature: opts.feature,
          model,
          latency_ms: Date.now() - started,
          input_tokens: usage?.promptTokenCount,
          output_tokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
          ok: parsed.success,
          error_code: parsed.success ? undefined : "invalid_output",
        });
        if (parsed.success) return { data: parsed.data, model };
        if (attempt === 1) break;
      } catch (e) {
        const code = e instanceof ApiError ? `http_${e.status}` : e instanceof Error ? e.name : "unknown";
        if (process.env.AI_DEBUG) console.error(`[ai:${opts.feature}] ${model}`, e instanceof Error ? e.message.slice(0, 600) : e);
        await logCall({ feature: opts.feature, model, latency_ms: Date.now() - started, ok: false, error_code: code });
        if (e instanceof AiUnavailableError) throw e;
        if (!retryable(e)) throw new AiOutputError();
        if (attempt < 2) await sleep(700 * 2 ** attempt + Math.random() * 300);
      }
    }
  }
  throw new AiBusyError();
}

// Gemini rejects some JSON-schema keywords in nested schemas. Send the shape only;
// Zod still enforces every length, range and size limit on the response.
const KEEP = new Set(["type", "properties", "items", "required", "enum", "description", "anyOf", "nullable", "format"]);
function forGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(forGemini);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (!KEEP.has(k)) continue;
    out[k] = k === "properties" ? Object.fromEntries(Object.entries(v as object).map(([p, s]) => [p, forGemini(s)])) : forGemini(v);
  }
  return out;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function repairJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  return safeJson(text.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1"));
}

export type EmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY";

export async function embed(texts: string[], task: EmbedTask, feature = "embed"): Promise<number[][]> {
  if (texts.length === 0) return [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = Date.now();
    try {
      const res = await withTimeout(
        ai().models.embedContent({
          model: models.embed,
          contents: texts.map((t) => ({ role: "user", parts: [{ text: t.slice(0, 8000) }] })),
          config: { taskType: task, outputDimensionality: EMBED_DIMS },
        }),
        20_000,
      );
      const vectors = (res.embeddings ?? []).map((e) => normalize(e.values ?? []));
      await logCall({ feature, model: models.embed, latency_ms: Date.now() - started, ok: vectors.length === texts.length });
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBED_DIMS)) throw new AiOutputError();
      return vectors;
    } catch (e) {
      await logCall({
        feature,
        model: models.embed,
        latency_ms: Date.now() - started,
        ok: false,
        error_code: e instanceof ApiError ? `http_${e.status}` : "error",
      });
      if (!retryable(e) || attempt === 2) throw e instanceof AiOutputError ? e : new AiBusyError();
      await sleep(600 * 2 ** attempt);
    }
  }
  throw new AiBusyError();
}

// Truncated embeddings are not unit length; normalise so cosine distance behaves.
function normalize(v: number[]) {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

export const toPgVector = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(",")}]`;
