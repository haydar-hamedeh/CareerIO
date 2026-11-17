import Link from "next/link";
import { Briefcase, Building2, ClipboardList, FileCheck2, LayoutDashboard, LogOut, PlusCircle, Settings, UserRound, UserSearch } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/landing/logo";
import { MessagesLink } from "./messages-link";
import { NotificationBell } from "./notification-bell";

type Active = "feed" | "profile" | "grader" | "applications" | "recruiter" | "post" | "messages" | "talent" | "company" | "settings";
type Props = { name?: string; active?: Active; showProfile?: boolean; role?: "candidate" | "employer" };

export function AppHeader({ name, active, showProfile = true, role = "candidate" }: Props) {
  const employer = role === "employer";
  const initials = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const links = !showProfile
    ? []
    : employer
      ? [
          { href: "/recruiter", label: "Dashboard", key: "recruiter" as const, Icon: LayoutDashboard },
          { href: "/recruiter/talent", label: "Talent", key: "talent" as const, Icon: UserSearch },
          { href: "/recruiter/jobs/new", label: "Post a job", key: "post" as const, Icon: PlusCircle },
          { href: "/recruiter/company", label: "Company", key: "company" as const, Icon: Building2 },
        ]
      : [
          { href: "/feed", label: "Jobs", key: "feed" as const, Icon: Briefcase },
          { href: "/applications", label: "Applications", key: "applications" as const, Icon: ClipboardList },
          { href: "/grader", label: "CV Grader", key: "grader" as const, Icon: FileCheck2 },
          { href: "/profile", label: "Profile", key: "profile" as const, Icon: UserRound },
        ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={employer ? "/recruiter" : "/feed"} aria-label="CareerIO home" className="rounded-xl">
          <Logo />
        </Link>
        <nav aria-label="App" className="flex items-center gap-1">
          {links.map(({ href, label, key, Icon }) => (
            <Link
              key={key}
              href={href}
              aria-current={active === key ? "page" : undefined}
              className={`group inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors ${
                active === key ? "bg-mint text-forest-deep" : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon size={16} className="transition-transform group-hover:-translate-y-0.5" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          {showProfile && <MessagesLink active={active === "messages"} />}
          {showProfile && <NotificationBell />}
          {showProfile && (
            <Link
              href="/settings"
              aria-label="Settings"
              aria-current={active === "settings" ? "page" : undefined}
              className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${active === "settings" ? "bg-mint text-forest-deep" : "text-muted hover:bg-ink/5 hover:text-ink"}`}
            >
              <Settings size={17} aria-hidden />
            </Link>
          )}
          {initials && showProfile && !employer && (
            <Link
              href="/profile"
              aria-label="Your profile"
              className="ml-1 hidden h-9 w-9 place-items-center rounded-full bg-forest font-display text-[13px] font-bold text-white transition-transform hover:scale-105 sm:grid"
            >
              {initials}
            </Link>
          )}
          <form action={signOut}>
            <button className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-semibold text-muted transition-colors hover:bg-ink/5 hover:text-ink">
              <LogOut size={16} aria-hidden />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
