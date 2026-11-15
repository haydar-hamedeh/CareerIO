import { z } from "zod";

export const workModes = ["onsite", "hybrid", "remote"] as const;
export const seniorities = ["intern", "junior", "mid", "senior", "lead"] as const;
export const companySizes = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export const workModeLabel: Record<(typeof workModes)[number], string> = {
  onsite: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};

export const seniorityLabel: Record<(typeof seniorities)[number], string> = {
  intern: "Intern / student",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead / manager",
};

const text = (max: number, msg: string) => z.string().trim().min(1, { error: msg }).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const tags = (max: number) => z.array(z.string().trim().min(1).max(60)).max(max);
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Pick a month." });

export const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

export const basicsSchema = z.object({
  fullName: z.string().trim().min(2, { error: "Enter your full name." }).max(120),
  headline: text(160, "Add a short headline, like “Junior Frontend Developer”."),
  phone: z
    .string()
    .trim()
    .regex(PHONE_RE, { error: "Enter a valid phone number, like 70 123 456." })
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 7 && digits <= 15;
    }, { error: "That number looks too short or too long." }),
  country: text(80, "Choose your country."),
  city: text(120, "Enter your city."),
});

export const positionSchema = z
  .object({
    title: text(120, "Add the job title."),
    company: text(120, "Add the company."),
    start: yearMonth,
    end: yearMonth.or(z.literal("")),
    current: z.boolean(),
    summary: optionalText(600),
  })
  .refine((p) => p.current || p.end !== "", { error: "Add an end date or tick “I work here now”.", path: ["end"] })
  .refine((p) => p.current || p.end === "" || p.end >= p.start, { error: "End date is before the start date.", path: ["end"] });

export const experienceSchema = z.object({
  seniority: z.enum(seniorities, { error: "Choose your level." }),
  yearsExperience: z.coerce
    .number({ error: "Enter a number." })
    .int({ error: "Use a whole number, like 2." })
    .min(0)
    .max(60, { error: "Enter 60 or less." }),
  positions: z.array(positionSchema).max(15),
});

export const educationItemSchema = z
  .object({
    school: text(160, "Add the school or university."),
    degree: text(120, "Choose your degree."),
    field: text(120, "Choose or type your major."),
    startYear: z.coerce.number().int().min(1950).max(2040),
    endYear: z.coerce.number().int().min(1950).max(2045),
  })
  .refine((e) => e.endYear >= e.startYear, { error: "End year is before the start year.", path: ["endYear"] });

export const educationSchema = z.object({ education: z.array(educationItemSchema).max(10) });

export const skillsSchema = z.object({
  skills: tags(40).min(3, { error: "Add at least 3 skills." }),
  languages: tags(10).min(1, { error: "Add at least one language." }),
});

export const preferencesSchema = z
  .object({
    desiredRoles: tags(10).min(1, { error: "Add at least one role you want." }),
    workModes: z.array(z.enum(workModes)).min(1, { error: "Pick at least one." }),
    preferredLocations: tags(10),
    salaryMin: z.coerce.number().int().min(0).max(10_000_000).optional(),
    salaryMax: z.coerce.number().int().min(0).max(10_000_000).optional(),
    salaryCurrency: z.string().length(3).default("USD"),
  })
  .refine((p) => !p.salaryMin || !p.salaryMax || p.salaryMin <= p.salaryMax, {
    error: "Minimum is higher than maximum.",
    path: ["salaryMax"],
  });

export const candidateOnboardingSchema = z.object({
  basics: basicsSchema,
  experience: experienceSchema,
  education: educationSchema,
  skills: skillsSchema,
  preferences: preferencesSchema,
});

export type CandidateOnboarding = z.input<typeof candidateOnboardingSchema>;

export const employerOnboardingSchema = z.object({
  fullName: z.string().trim().min(2, { error: "Enter your full name." }).max(120),
  companyName: z.string().trim().min(2, { error: "Enter the company name." }).max(120),
  size: z.enum(companySizes, { error: "Choose the company size." }),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), { error: "Use a full link, like https://example.com." }),
  location: text(120, "Where is the company based?"),
  description: z.string().trim().min(20, { error: "Write at least a sentence about the company." }).max(4000),
});

export type EmployerOnboarding = z.input<typeof employerOnboardingSchema>;

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
