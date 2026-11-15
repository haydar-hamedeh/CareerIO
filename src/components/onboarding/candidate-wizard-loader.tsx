"use client";

import dynamic from "next/dynamic";

export const CandidateWizardLoader = dynamic(() => import("./candidate-wizard").then((m) => m.CandidateWizard), {
  ssr: false,
  loading: () => (
    <div aria-busy="true" aria-label="Loading" className="mx-auto grid max-w-[1100px] animate-pulse gap-10 px-6 py-14 lg:grid-cols-[260px_1fr]">
      <div className="hidden space-y-3 lg:block">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-12 rounded-2xl bg-ink/6" />
        ))}
      </div>
      <div>
        <div className="h-10 w-1/2 rounded-xl bg-ink/8" />
        <div className="mt-3 h-4 w-2/3 rounded bg-ink/6" />
        <div className="mt-8 h-80 rounded-[28px] bg-ink/6" />
      </div>
    </div>
  ),
});
