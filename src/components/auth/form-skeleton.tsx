export function FormSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-9 w-2/3 rounded-xl bg-ink/8" />
      <div className="mt-3 h-4 w-1/2 rounded-lg bg-ink/6" />
      <div className="mt-8 h-12 rounded-full bg-ink/6" />
      <div className="my-6 h-px bg-line" />
      <div className="space-y-5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i}>
            <div className="mb-2 h-4 w-24 rounded bg-ink/8" />
            <div className="h-12 rounded-2xl bg-ink/6" />
          </div>
        ))}
      </div>
      <div className="mt-6 h-12 rounded-full bg-ink/10" />
    </div>
  );
}
