import { z } from "zod";
import { PASSWORD_MAX, passwordRules } from "./password-rules";

export const roles = ["candidate", "employer"] as const;
export type Role = (typeof roles)[number];

const email = z.email({ error: "Enter a valid email address." }).trim().toLowerCase();

export const password = z
  .string()
  .max(PASSWORD_MAX, { error: `Use ${PASSWORD_MAX} characters or fewer.` })
  .superRefine((v, ctx) => {
    const failed = passwordRules.find((r) => !r.test(v));
    if (failed) ctx.addIssue({ code: "custom", message: failed.error });
  });

const matching = (v: { password: string; confirm: string }) => v.password === v.confirm;
const mismatch = { error: "Passwords do not match.", path: ["confirm"] };

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, { error: "Enter your full name." }).max(80, { error: "That name is too long." }),
    email,
    password,
    confirm: z.string().min(1, { error: "Confirm your password." }),
    role: z.enum(roles, { error: "Choose how you will use CareerIO." }),
  })
  .refine(matching, mismatch);

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password." }),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ password, confirm: z.string().min(1, { error: "Confirm your password." }) })
  .refine(matching, mismatch);

export function safeNext(next: unknown, fallback = "/feed") {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

export function parseRole(value: unknown): Role | null {
  return roles.includes(value as Role) ? (value as Role) : null;
}
