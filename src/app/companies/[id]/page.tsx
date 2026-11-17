import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ExternalLink, Globe, MapPin, Pencil, Users } from "lucide-react";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/app/app-header";
import { CompanyAvatar } from "@/components/company/company-avatar";
import { levelShort, typeLabel } from "@/lib/jobs/format";
import { formatSalary } from "@/lib/jobs/match";
import { workModeLabel } from "@/lib/onboarding/schema";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Company · CareerIO" };

export default function CompanyPublicPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageTransition>
      <Suspense fallback={<div className="h-16 border-b border-line bg-paper" />}>
        <CompanyView params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function CompanyView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const session = await requireSession(`/companies/${id}`);
  if (!session.onboarded) redirect("/onboarding");
  const { supabase, user, role, fullName } = session;

  const [{ data: c }, { data: jobs }] = await Promise.all([
    supabase.from("companies").select("id, owner_id, name, industry, size, website, location, description, logo_path").eq("id", id).maybeSingle(),
    supabase
      .from("jobs")
      .select("id, title, location, work_mode, employment_type, seniority, salary_min, salary_max, salary_currency, published_at")
      .eq("company_id", id)
      .eq("status", "open")
      .order("published_at", { ascending: false })
      .limit(50),
  ]);
  if (!c) notFound();
  const mine = c.owner_id === user.id;

  return (
    <>
      <AppHeader name={fullName} role={role} />
      <main className="mx-auto max-w-[860px] px-4 py-6 sm:px-6 lg:py-10">
        <section className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-8">
          <div className="flex flex-wrap items-start gap-5">
            <CompanyAvatar name={c.name} logoPath={c.logo_path} size="xl" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.2rem)] leading-tight font-extrabold tracking-[-0.03em]">{c.name}</h1>
              {c.industry && <p className="mt-0.5 text-[14.5px] text-muted">{c.industry}</p>}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-muted">
                {c.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} aria-hidden /> {c.location}
                  </span>
                )}
                {c.size && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={14} aria-hidden /> {c.size} people
                  </span>
                )}
                {c.website && (
                  <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 font-semibold text-forest hover:underline">
                    <Globe size={14} aria-hidden /> {c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </div>
            </div>
            {mine && (
              <Link href="/recruiter/company" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-semibold ring-1 ring-line hover:ring-forest/40">
                <Pencil size={14} aria-hidden /> Edit
              </Link>
            )}
          </div>
          {c.description && (
            <div className="mt-6 border-t border-line pt-5">
              <h2 className="font-display text-[1.05rem] font-extrabold tracking-tight">About</h2>
              <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-ink/85">{c.description}</p>
            </div>
          )}
        </section>

        <h2 className="mt-8 font-display text-[1.2rem] font-extrabold tracking-tight">
          Open roles <span className="text-muted tabular-nums">{jobs?.length ?? 0}</span>
        </h2>
        {(jobs ?? []).length === 0 ? (
          <p className="mt-3 rounded-[24px] bg-paper p-6 text-center text-[14px] text-muted ring-1 ring-line">No open roles right now.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {(jobs ?? []).map((j) => {
              const salary = formatSalary(j.salary_min, j.salary_max, j.salary_currency);
              return (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="block rounded-[24px] bg-paper p-5 shadow-soft ring-1 ring-line transition-shadow hover:shadow-lift hover:ring-forest/40">
                    <p className="font-display text-[1.05rem] font-bold tracking-tight">{j.title}</p>
                    <p className="mt-1 text-[13.5px] text-muted">
                      {[levelShort[j.seniority] ?? j.seniority, typeLabel[j.employment_type] ?? j.employment_type, workModeLabel[j.work_mode as keyof typeof workModeLabel] ?? j.work_mode, j.location, salary].filter(Boolean).join(" · ")}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
