import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { AuthPanel } from "@/components/auth/auth-panel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="sticky top-0 hidden h-dvh lg:block" aria-hidden>
        <AuthPanel />
      </aside>
      <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-10 sm:py-8">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="CareerIO home" className="rounded-xl">
            <Logo />
          </Link>
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-semibold text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ArrowLeft size={16} className="transition-transform duration-300 group-hover:-translate-x-0.5" aria-hidden />
            Home
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
