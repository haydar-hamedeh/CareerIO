export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export const passwordRules = [
  { id: "length", label: `${PASSWORD_MIN}+ characters`, error: `Use at least ${PASSWORD_MIN} characters.`, test: (v: string) => v.length >= PASSWORD_MIN },
  { id: "upper", label: "One uppercase letter", error: "Add an uppercase letter (A–Z).", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", label: "One lowercase letter", error: "Add a lowercase letter (a–z).", test: (v: string) => /[a-z]/.test(v) },
  { id: "number", label: "One number", error: "Add a number (0–9).", test: (v: string) => /\d/.test(v) },
  { id: "symbol", label: "One special character", error: "Add a special character, like ! @ # or ?.", test: (v: string) => /[^A-Za-z0-9\s]/.test(v) },
] as const;

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(v: string): { met: number; score: PasswordStrength } {
  const met = passwordRules.filter((r) => r.test(v)).length;
  if (!v) return { met, score: 0 };
  if (met <= 2) return { met, score: 1 };
  if (met <= 4) return { met, score: 2 };
  return { met, score: v.length >= 12 ? 4 : 3 };
}
