# CareerIO

> **Demo project.** All candidates, CVs, companies and jobs shown are synthetic. Not a real hiring service.

CareerIO is an AI-assisted hiring platform. Candidates upload a CV, get it graded against a visible rubric, and see jobs ranked by how well they match. Employers post jobs and see applicants ranked with an explanation. The AI assists; a human decides.

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Repo scaffold, CI, secret scanning | Done |
| 1 | Supabase schema, RLS, migrations, seed | Not started |
| 2 | Auth pages, roles, onboarding shell | Not started |
| 3 | Landing page | First version, awaiting feedback |
| 4–9 | CV parsing, grader, matching, employer flow, evals, deploy | Not started |

## Stack

Next.js (App Router), TypeScript strict, Tailwind CSS v4, Framer Motion, Zod, Supabase (Auth, Postgres + pgvector, Storage), Google Gemini, Vitest, Playwright, GitHub Actions, Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Sections still to write

- Architecture diagram
- Matching score formula
- Fairness and privacy notes (and their limits)
- Eval results (real numbers from real runs only)
- Known limits

## License

MIT. See [LICENSE](LICENSE).
