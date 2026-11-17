import { computeFit } from "../src/lib/jobs/match";

const job = {
  jobTitle: "Junior Full-Stack Developer",
  jobSkills: ["JavaScript", "TypeScript", "Node.js", "React", "PostgreSQL", "Git", "REST APIs"],
  jobMode: "hybrid",
  jobLevel: "junior",
  desiredRoles: ["Full-Stack Developer"],
  headline: "Senior full stack web developer",
  workModes: ["remote"],
  level: "senior",
};

const cases: { name: string; skills: string[]; expectMatched: string[]; expectMissing: string[] }[] = [
  { name: "Next.js + Express user", skills: ["Next.js", "Express", "TypeScript", "Postgres", "Git"], expectMatched: ["React", "Node.js", "JavaScript", "PostgreSQL", "TypeScript"], expectMissing: ["REST APIs"] },
  { name: "Plain Python user", skills: ["Python", "SQL"], expectMatched: [], expectMissing: ["React", "Node.js", "TypeScript"] },
  { name: "Variants only", skills: ["NodeJS", "ReactJS", "psql", "JS"], expectMatched: ["Node.js", "React", "PostgreSQL", "JavaScript"], expectMissing: ["TypeScript"] },
];

let failed = 0;
for (const c of cases) {
  const f = computeFit({ ...job, skills: c.skills });
  const okMatched = c.expectMatched.every((s) => f.matched.includes(s));
  const okMissing = c.expectMissing.every((s) => f.missing.includes(s));
  const pass = okMatched && okMissing;
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${c.name}: score ${f.score}, matched [${f.matched.join(", ")}], missing [${f.missing.join(", ")}], via [${f.via.map((v) => `${v.skill}<-${v.from}`).join(", ")}]`);
}
console.log(failed ? `\n${failed} FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
