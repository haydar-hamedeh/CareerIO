import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Logo } from "./logo";

export function FinalCta() {
  return (
    <section className="grain relative w-full overflow-hidden bg-forest py-24 text-white sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-drift absolute -right-24 -bottom-40 h-[420px] w-[420px] rounded-full bg-mint/20 blur-3xl" />
      </div>
      <Reveal className="relative mx-auto max-w-[900px] px-4 text-center sm:px-6">
        <h2 className="font-display text-[clamp(2.2rem,6vw,4rem)] leading-[1.04] font-extrabold tracking-[-0.035em]">
          Your next job search can feel a lot less scary.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-white/80">
          Upload your CV, see what to fix, and find roles that fit. It takes about two minutes.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button href="/signup" variant="light" arrow>
            Get started
          </Button>
          <Link
            href="#employers"
            className="inline-flex h-12 items-center rounded-full px-6 font-display text-[15px] font-bold text-white ring-1 ring-white/30 transition-colors hover:bg-white/10"
          >
            For employers
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

const fields = ["Software", "Design", "Marketing", "Finance", "Healthcare", "Education", "Engineering"];

export function Fields() {
  const row = [...fields, ...fields];
  return (
    <div className="w-full overflow-hidden border-y border-line bg-sand py-5" aria-label="Job fields on CareerIO">
      <div className="animate-marquee flex w-max">
        {[0, 1].map((k) => (
          <ul key={k} className="flex shrink-0 gap-10 pr-10" aria-hidden={k === 1}>
            {row.map((f, i) => (
              <li key={`${f}-${i}`} className="flex items-center gap-10 font-display text-lg font-bold whitespace-nowrap text-ink/45">
                {f}
                <span className="h-1.5 w-1.5 rounded-full bg-coral/60" aria-hidden />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="w-full bg-ink py-14 text-sand">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-start">
          <div className="max-w-sm">
            <Logo tone="sand" />
            <p className="mt-4 leading-relaxed text-sand/60">
              Get your CV graded honestly and matched to jobs that fit. Employers get ranked applicants and keep the
              final say.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-14 gap-y-3 text-[15px]">
            <a href="#how" className="text-sand/70 hover:text-sand">How it works</a>
            <Link href="/signup" className="text-sand/70 hover:text-sand">Get started</Link>
            <a href="#grader" className="text-sand/70 hover:text-sand">CV Grader</a>
            <Link href="/login" className="text-sand/70 hover:text-sand">Log in</Link>
            <a href="#trust" className="text-sand/70 hover:text-sand">Your data</a>
            <a href="#employers" className="text-sand/70 hover:text-sand">For employers</a>
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-[13px] text-sand/50 md:flex-row md:justify-between">
          <p>© 2026 CareerIO. All rights reserved.</p>
          <p>This service uses the ESCO classification of the European Commission.</p>
        </div>
      </div>
    </footer>
  );
}
