import { z } from "zod";

export const MAX_QUESTIONS = 5;

export const screeningQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().trim().min(3, { error: "Write the question." }).max(200, { error: "Keep it under 200 characters." }),
  type: z.enum(["text", "yesno"]),
  required: z.boolean(),
});

export const screeningQuestionsSchema = z.array(screeningQuestionSchema).max(MAX_QUESTIONS);

export type ScreeningQuestion = z.infer<typeof screeningQuestionSchema>;
export type ScreeningAnswer = { id: string; q: string; a: string };

export const parseQuestions = (value: unknown): ScreeningQuestion[] => screeningQuestionsSchema.safeParse(value).data ?? [];
