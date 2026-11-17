export const typeLabel: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

export const levelShort: Record<string, string> = { intern: "Intern", junior: "Junior", mid: "Mid-level", senior: "Senior", lead: "Lead" };

export type ParsedSection = {
  heading: string | null;
  bullets: string[];
  paragraphs: string[];
};

export function parseDescription(description: string, fallbackRequirements: string[]) {
  const blocks = description
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const [intro = "", ...restBlocks] = blocks;
  const sections: ParsedSection[] = [];
  let hasRequirementsSection = false;

  for (const block of restBlocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    let heading: string | null = null;
    let body = lines;

    if (lines[0].endsWith(":") && lines[0].length <= 60) {
      heading = lines[0].slice(0, -1);
      body = lines.slice(1);
      if (heading.toLowerCase().includes("requirement") || heading.toLowerCase().includes("looking for")) {
        hasRequirementsSection = true;
      }
    }

    const bullets: string[] = [];
    const paragraphs: string[] = [];
    for (const line of body) {
      if (line.startsWith("- ")) bullets.push(line.slice(2).trim());
      else paragraphs.push(line);
    }

    sections.push({ heading, bullets, paragraphs });
  }

  if (!hasRequirementsSection && fallbackRequirements.length > 0) {
    sections.push({ heading: "Requirements", bullets: fallbackRequirements, paragraphs: [] });
  }

  return { intro, sections };
}

export const avatarPalette = ["bg-mint text-forest-deep", "bg-sun/40 text-ink", "bg-coral/15 text-[#b4391f]", "bg-forest text-white", "bg-ink text-sand"];

export function fitTone(pct: number) {
  if (pct >= 70) return { ring: "var(--forest)", text: "text-forest", label: "Strong fit" };
  if (pct >= 40) return { ring: "#d99a1e", text: "text-[#a16207]", label: "Partial fit" };
  return { ring: "var(--coral)", text: "text-[#c2410c]", label: "Stretch" };
}
