import { ViewTransition } from "react";

/** Wraps a page so it animates out when you leave and in when you arrive. Put it in `page.tsx`, not a layout. */
export function PageTransition({ children, className = "min-h-dvh w-full" }: { children: React.ReactNode; className?: string }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className={className || undefined}>{children}</div>
    </ViewTransition>
  );
}
