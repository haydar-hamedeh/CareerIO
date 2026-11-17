import { z } from "zod";
import { seniorities } from "@/lib/onboarding/schema";
import { screeningQuestionsSchema } from "@/lib/jobs/screening";

export const employmentTypes = ["full_time", "part_time", "contract", "internship", "temporary"] as const;
export const jobWorkModes = ["onsite", "hybrid", "remote"] as const;

/** Short field names (what the feed filters show), each tied to the skill field whose skills and roles we suggest. */
export const jobFields: { id: string; name: string }[] = [
  { id: "cs", name: "Software" },
  { id: "engineering", name: "Engineering" },
  { id: "construction", name: "Construction" },
  { id: "finance", name: "Finance" },
  { id: "business", name: "Business" },
  { id: "marketing", name: "Marketing" },
  { id: "sales", name: "Sales" },
  { id: "health", name: "Healthcare" },
  { id: "education", name: "Education" },
  { id: "law", name: "Legal" },
  { id: "design", name: "Design" },
  { id: "media", name: "Media" },
  { id: "science", name: "Science" },
  { id: "hr", name: "HR" },
  { id: "logistics", name: "Logistics" },
  { id: "hospitality", name: "Hospitality" },
  { id: "social", name: "Social care" },
  { id: "trades", name: "Trades" },
];

const money = z.coerce.number().int().min(0).max(10_000_000);

const base = z.object({
  title: z.string().trim().min(2, { error: "Add the job title." }).max(140),
  field: z.string().trim().min(1, { error: "Choose a field." }).max(60),
  seniority: z.enum(seniorities, { error: "Choose the level." }),
  employmentType: z.enum(employmentTypes, { error: "Choose the contract type." }),
  workMode: z.enum(jobWorkModes, { error: "Choose where the work happens." }),
  location: z.string().trim().max(120).default(""),
  salaryMin: money.optional(),
  salaryMax: money.optional(),
  salaryCurrency: z.string().length(3).default("USD"),
  requirements: z.array(z.string().trim().min(1).max(200)).max(12),
  screeningQuestions: screeningQuestionsSchema,
  status: z.enum(["draft", "open"]),
});

const salaryOk = (v: { salaryMin?: number; salaryMax?: number }) => !v.salaryMin || !v.salaryMax || v.salaryMin <= v.salaryMax;
const salaryIssue = { error: "Minimum is higher than maximum.", path: ["salaryMax"] };

/** Publishing needs the whole form. */
export const jobSchema = base
  .extend({
    description: z
      .string()
      .trim()
      .min(40, { error: "Describe the role in a few sentences (at least 40 characters)." })
      .max(8000, { error: "Keep it under 8,000 characters." }),
    skills: z.array(z.string().trim().min(1).max(60)).min(3, { error: "Add at least 3 skills so candidates can be matched." }).max(15, { error: "Keep it to 15 skills." }),
  })
  .refine(salaryOk, salaryIssue);

/** A draft can be saved half-written: the description and skills can wait. */
export const draftSchema = base
  .extend({
    description: z.string().trim().max(8000, { error: "Keep it under 8,000 characters." }).default(""),
    skills: z.array(z.string().trim().min(1).max(60)).max(15, { error: "Keep it to 15 skills." }),
  })
  .refine(salaryOk, salaryIssue);

export const schemaFor = (status: "draft" | "open") => (status === "open" ? jobSchema : draftSchema);

export type JobInput = z.input<typeof jobSchema>;
