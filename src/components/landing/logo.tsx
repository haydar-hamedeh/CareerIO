export function Logo({ tone = "ink" }: { tone?: "ink" | "sand" }) {
  const text = tone === "ink" ? "text-ink" : "text-sand";
  return (
    <span className={`inline-flex items-center gap-2 ${text}`}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="10" fill="var(--forest)" />
        <path
          d="M20.5 11.2a6.4 6.4 0 1 0 0 9.6"
          fill="none"
          stroke="var(--sand)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="22.4" cy="16" r="2.2" fill="var(--sun)" />
      </svg>
      <span className="font-display text-[19px] font-extrabold tracking-tight">
        Career<span className="text-forest">IO</span>
      </span>
    </span>
  );
}
