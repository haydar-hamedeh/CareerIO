import "server-only";
import { admin } from "@/lib/supabase/admin";
import { emailUser } from "@/lib/email/notify";
import { computeFit } from "./match";
import { cosine } from "./cosine";

const HOUR = 3_600_000;
const MIN_FIT = 60;
const MAX_JOBS = 5;
const first = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type JobRow = {
  id: string;
  title: string;
  skills: string[] | null;
  work_mode: string;
  seniority: string;
  location: string | null;
  published_at: string | null;
  embedding: unknown;
  companies: { name: string } | { name: string }[] | null;
};

/**
 * Sends each opted-in job seeker the new jobs that fit them since their last alert.
 * Runs once a day; "weekly" people are simply skipped until a week has passed.
 */
export async function runJobAlerts(): Promise<{ checked: number; sent: number }> {
  const db = admin();
  const now = Date.now();

  const { data: jobsRaw } = await db
    .from("jobs")
    .select("id, title, skills, work_mode, seniority, location, published_at, embedding, companies(name)")
    .eq("status", "open")
    .gte("published_at", new Date(now - 8 * 24 * HOUR).toISOString())
    .order("published_at", { ascending: false })
    .limit(400);
  const jobs = (jobsRaw ?? []) as unknown as JobRow[];
  if (jobs.length === 0) return { checked: 0, sent: 0 };

  const { data: people } = await db.from("profiles").select("id").eq("role", "candidate").not("onboarded_at", "is", null).limit(2000);
  const ids = (people ?? []).map((p) => p.id);
  if (ids.length === 0) return { checked: 0, sent: 0 };

  const { data: settings } = await db.from("user_settings").select("user_id, job_alerts, last_alert_at").in("user_id", ids);
  const byUser = new Map((settings ?? []).map((s) => [s.user_id, s]));

  let checked = 0;
  let sent = 0;
  for (const id of ids) {
    const s = byUser.get(id);
    const freq = (s?.job_alerts ?? "weekly") as "off" | "daily" | "weekly";
    if (freq === "off") continue;
    const last = s?.last_alert_at ? new Date(s.last_alert_at).getTime() : null;
    const gap = freq === "daily" ? 20 * HOUR : 6.5 * 24 * HOUR;
    if (last !== null && now - last < gap) continue;
    checked++;

    const since = last ?? now - 7 * 24 * HOUR;
    const fresh = jobs.filter((j) => j.published_at && new Date(j.published_at).getTime() > since);
    let top: { job: JobRow; score: number }[] = [];
    if (fresh.length) {
      const [{ data: profile }, { data: applied }] = await Promise.all([
        db.from("candidate_profiles").select("headline, desired_roles, skills, seniority, work_modes, embedding").eq("user_id", id).maybeSingle(),
        db.from("applications").select("job_id").eq("candidate_id", id),
      ]);
      if (profile) {
        const done = new Set((applied ?? []).map((a) => a.job_id));
        top = fresh
          .filter((j) => !done.has(j.id))
          .map((job) => ({
            job,
            score: computeFit({
              jobTitle: job.title,
              jobSkills: job.skills ?? [],
              jobMode: job.work_mode,
              jobLevel: job.seniority,
              skills: profile.skills ?? [],
              desiredRoles: profile.desired_roles ?? [],
              headline: profile.headline ?? "",
              workModes: profile.work_modes ?? [],
              level: profile.seniority ?? null,
              semantic: cosine(profile.embedding, job.embedding),
            }).score,
          }))
          .filter((x) => x.score >= MIN_FIT)
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_JOBS);
      }
    }

    // Move the window forward even when nothing matched, so the next alert only looks at newer jobs.
    await db.from("user_settings").upsert({ user_id: id, last_alert_at: new Date(now).toISOString() }, { onConflict: "user_id" });
    if (top.length === 0) continue;

    const n = top.length;
    await db.from("notifications").insert({
      user_id: id,
      kind: "alert",
      title: n === 1 ? "A new job matches you" : `${n} new jobs match you`,
      body: top.map((t) => t.job.title).join(", ").slice(0, 300),
      href: "/feed",
    });
    await emailUser(id, {
      subject: n === 1 ? "A new job that fits you" : `${n} new jobs that fit you`,
      heading: n === 1 ? "A new job matches your profile" : `${n} new jobs match your profile`,
      paragraphs: ["These were posted recently and fit your skills and the roles you want."],
      items: top.map((t) => ({ title: t.job.title, sub: `${first(t.job.companies)?.name ?? "Company"}${t.job.location ? ` · ${t.job.location}` : ""} · ${t.score}% match` })),
      cta: { label: "See your matches", path: "/feed" },
      footer: "You get job alerts because they are on in your settings.",
    });
    sent++;
  }
  return { checked, sent };
}
