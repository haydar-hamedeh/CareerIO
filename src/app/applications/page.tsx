import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CalendarCheck, ClipboardList, MessageSquare, Minus, Plus } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/app/app-header";
import { MatchRing } from "@/components/feed/job-card";
import { statusLabel, statusTone, type AppStatus } from "@/lib/recruiter/types";
import { CompanyAvatar } from "@/components/company/company-avatar";

export const metadata: Metadata = { title: "My applications · CareerIO" };

export default function ApplicationsPage() {
  return (
    <div className="min-h-dvh w-full">
      <Suspense fallback={<div className="h-16 border-b border-line bg-paper" />}>
        <Applications />
      </Suspense>
    </div>
  );
}

const next: Record<AppStatus, string> = {
  applied: "Sent. The employer will look at it soon.",
  in_review: "The employer is reviewing your application.",
  interview: "They want to talk to you.",
  rejected: "Not selected this time. Keep going.",
  hired: "Congratulations, you got the job.",
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

async function Applications() {
  await connection();
  const session = await requireSession("/applications");
  if (!session.onboarded) redirect("/onboarding");
  if (session.role === "employer") redirect("/recruiter");
  const { supabase, user, fullName } = session;

  const { data } = await supabase
    .from("applications")
    .select("id, job_id, status, match_score, match_explanation, feedback, interview_at, interview_note, created_at, jobs(title, companies(id, name, logo_path))")
    .eq("candidate_id", user.id)
    .order("created_at", { ascending: false });
  const rows = data ?? [];

  // Companies start the chat. The candidate only gets a way in once the company has written.
  const { data: chats } = await supabase.from("conversations").select("id, application_id, last_message_preview").eq("candidate_id", user.id);
  const chatByApp = new Map((chats ?? []).filter((c) => c.application_id && c.last_message_preview).map((c) => [c.application_id as string, c.id]));

  return (
    <>
      <AppHeader name={fullName} active="applications" role="candidate" />
      <main className="mx-auto max-w-[860px] px-4 py-6 sm:px-6 lg:py-10">
        <h1 className="font-display text-[clamp(1.8rem,3.6vw,2.4rem)] leading-tight font-extrabold tracking-[-0.03em]">My applications</h1>
        <p className="mt-2 text-muted">Where each one stands, and what the AI review saw in your application.</p>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-[28px] bg-paper p-8 text-center shadow-soft ring-1 ring-line">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint text-forest">
              <ClipboardList size={22} aria-hidden />
            </span>
            <p className="mt-4 font-display text-[1.15rem] font-extrabold">No applications yet</p>
            <Link href="/feed" className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-6 text-[14.5px] font-bold text-white hover:bg-forest-deep">
              Find a job
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {rows.map((a) => {
              const job = (Array.isArray(a.jobs) ? a.jobs[0] : a.jobs) as { title: string; companies: { id: string; name: string; logo_path: string | null } | { id: string; name: string; logo_path: string | null }[] | null } | null;
              const co = job ? ((Array.isArray(job.companies) ? job.companies[0] : job.companies) as { id: string; name: string; logo_path: string | null } | null) : null;
              const company = co?.name ?? "Company";
              const status = a.status as AppStatus;
              const fb = (a.feedback ?? {}) as { strengths?: unknown; gaps?: unknown };
              const strengths = strings(fb.strengths);
              const gaps = strings(fb.gaps);
              return (
                <li key={a.id} className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-6">
                  <div className="flex items-start gap-4">
                    <CompanyAvatar name={company} logoPath={co?.logo_path} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/jobs/${a.job_id}`} className="font-display text-[1.1rem] font-bold tracking-tight hover:underline">
                        {job?.title ?? "Job"}
                      </Link>
                      <p className="text-[13.5px] text-muted">
                        {company} · Applied {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${statusTone[status]}`}>{statusLabel[status] === "New" ? "Sent" : statusLabel[status]}</span>
                        <span className="text-[13px] text-muted">{next[status]}</span>
                      </div>
                    </div>
                    {typeof a.match_score === "number" && <MatchRing pct={a.match_score} ai />}
                  </div>

                  {chatByApp.has(a.id) && (
                    <Link
                      href={`/messages?c=${chatByApp.get(a.id)}`}
                      className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-mint px-5 text-[14px] font-semibold text-forest-deep ring-1 ring-forest/20 transition-colors hover:bg-mint/70"
                    >
                      <MessageSquare size={15} aria-hidden /> {company} sent you a message
                    </Link>
                  )}

                  {status === "interview" && (a.interview_note || a.interview_at) && (
                    <p className="mt-4 flex items-start gap-2 rounded-2xl bg-mint/60 px-4 py-3 text-[14px] leading-snug text-forest-deep">
                      <CalendarCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
                      {a.interview_note ?? "You've been invited to an interview."}
                    </p>
                  )}

                  {(a.match_explanation || strengths.length > 0 || gaps.length > 0) && (
                    <div className="mt-4 rounded-2xl bg-sand p-4">
                      <p className="text-[12px] font-bold tracking-[0.1em] text-forest-deep uppercase">AI review of your application</p>
                      {a.match_explanation && <p className="mt-1.5 text-[14px] leading-snug">{a.match_explanation}</p>}
                      {(strengths.length > 0 || gaps.length > 0) && (
                        <ul className="mt-3 space-y-1.5">
                          {strengths.map((x, i) => (
                            <li key={`s${i}`} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
                              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest text-white" aria-hidden>
                                <Plus size={12} strokeWidth={3} />
                              </span>
                              {x}
                            </li>
                          ))}
                          {gaps.map((x, i) => (
                            <li key={`g${i}`} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
                              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral/20 text-[#b4391f]" aria-hidden>
                                <Minus size={12} strokeWidth={3} />
                              </span>
                              {x}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
