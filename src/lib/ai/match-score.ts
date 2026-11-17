import "server-only";
import { models } from "./gemini";
import { profileText, sha256, type ProfileForText } from "./texts";

// The AI match score is cached per person (ai_match_scores). Anything that changes the AI's view of the person
// (profile, CV skills, prompt, model) changes this hash, which invalidates the cached scores.
export const MATCH_PROMPT_VERSION = "match-v3";

export const matchProfileHash = (profile: ProfileForText, extraSkills: string[] = []) =>
  sha256(`${MATCH_PROMPT_VERSION}|${models.chat}|${profileText(profile, extraSkills)}`);
