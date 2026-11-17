import "server-only";
import { admin, hasAdmin } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "./send";
import { renderEmail, type EmailContent } from "./template";

/** Emails one person, unless they turned email notifications off. Fails quietly. */
export async function emailUser(userId: string, content: EmailContent, opts: { ignoreSettings?: boolean } = {}): Promise<boolean> {
  if (!emailConfigured() || !hasAdmin()) return false;
  try {
    const db = admin();
    if (!opts.ignoreSettings) {
      const { data: s } = await db.from("user_settings").select("email_notifications").eq("user_id", userId).maybeSingle();
      if (s && s.email_notifications === false) return false;
    }
    const { data } = await db.auth.admin.getUserById(userId);
    const to = data.user?.email;
    if (!to) return false;
    return sendEmail({ to, ...renderEmail(content) });
  } catch {
    return false;
  }
}

const first = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Tells the company owner someone applied. */
export async function emailNewApplicant(applicationId: string) {
  if (!emailConfigured() || !hasAdmin()) return;
  try {
    const { data: app } = await admin()
      .from("applications")
      .select("job_id, candidate_id, jobs(title, companies(owner_id))")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) return;
    const job = first(app.jobs as unknown as { title: string; companies: { owner_id: string | null } | { owner_id: string | null }[] | null } | null);
    const ownerId = first(job?.companies)?.owner_id;
    if (!job || !ownerId) return;
    const { data: p } = await admin().from("profiles").select("full_name").eq("id", app.candidate_id).maybeSingle();
    await emailUser(ownerId, {
      subject: `New applicant for ${job.title}`,
      heading: "You have a new applicant",
      paragraphs: [`${p?.full_name ?? "Someone"} applied for ${job.title}. The AI review is ready in a minute.`],
      cta: { label: "Review the application", path: `/recruiter/jobs/${app.job_id}` },
    });
  } catch {
    // Email is best effort.
  }
}

/** Tells the candidate the status of their application changed. */
export async function emailStatusChange(applicationId: string, status: string, note?: string | null) {
  if (!emailConfigured() || !hasAdmin()) return;
  try {
    const { data: app } = await admin()
      .from("applications")
      .select("candidate_id, jobs(title, companies(name))")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) return;
    const job = first(app.jobs as unknown as { title: string; companies: { name: string } | { name: string }[] | null } | null);
    const company = first(job?.companies)?.name ?? "The company";
    const title = job?.title ?? "your application";
    const copy: Record<string, { subject: string; heading: string; line: string }> = {
      in_review: { subject: `${company} is reviewing your application`, heading: "Your application is being reviewed", line: `${company} started reviewing your application for ${title}.` },
      interview: { subject: `${company} wants to interview you`, heading: "You're invited to an interview", line: `${company} invited you to interview for ${title}.` },
      rejected: { subject: `Update on your application to ${company}`, heading: "An update on your application", line: `${company} decided not to move forward with your application for ${title} this time. Keep going, there are more roles that fit you.` },
      hired: { subject: `Congratulations from ${company}`, heading: "You got the job", line: `${company} selected you for ${title}. Congratulations.` },
    };
    const c = copy[status];
    if (!c) return;
    await emailUser(app.candidate_id, {
      subject: c.subject,
      heading: c.heading,
      paragraphs: [c.line, ...(status === "interview" && note ? [note] : [])],
      cta: { label: "View your applications", path: "/applications" },
    });
  } catch {
    // Email is best effort.
  }
}

/** Emails the recipient of a chat message, but only for the first unread message (the bell works the same way). */
export async function emailNewMessage(conversationId: string, senderId: string, sentAt: string, preview: string) {
  if (!emailConfigured() || !hasAdmin()) return;
  try {
    const db = admin();
    const { data: conv } = await db.from("conversations").select("employer_id, candidate_id, job_title").eq("id", conversationId).maybeSingle();
    if (!conv) return;
    const recipient = senderId === conv.employer_id ? conv.candidate_id : conv.employer_id;
    // The database trigger creates one bell entry per burst. If this message created it, it is the first unread one.
    const { data: fresh } = await db
      .from("notifications")
      .select("id")
      .eq("user_id", recipient)
      .eq("href", `/messages?c=${conversationId}`)
      .is("read_at", null)
      .gte("created_at", sentAt)
      .limit(1);
    if (!fresh?.length) return;
    let who = "Someone";
    if (senderId === conv.employer_id) {
      const { data: c } = await db.from("companies").select("name").eq("owner_id", senderId).order("created_at").limit(1).maybeSingle();
      who = c?.name ?? "A company";
    } else {
      const { data: p } = await db.from("profiles").select("full_name").eq("id", senderId).maybeSingle();
      who = p?.full_name ?? "A candidate";
    }
    await emailUser(recipient, {
      subject: `New message from ${who}`,
      heading: `${who} sent you a message`,
      paragraphs: [`About ${conv.job_title}:`, `“${preview.slice(0, 240)}”`],
      cta: { label: "Open the conversation", path: `/messages?c=${conversationId}` },
    });
  } catch {
    // Email is best effort.
  }
}

/** Tells a candidate a company invited them to apply. */
export async function emailInvite(candidateId: string, jobId: string, message: string | null) {
  if (!emailConfigured() || !hasAdmin()) return;
  try {
    const { data: job } = await admin().from("jobs").select("title, location, companies(name)").eq("id", jobId).maybeSingle();
    if (!job) return;
    const company = first(job.companies as { name: string } | { name: string }[] | null)?.name ?? "A company";
    await emailUser(candidateId, {
      subject: `${company} invited you to apply`,
      heading: `${company} invited you to apply`,
      paragraphs: [`They saw your profile and think you could be a fit for ${job.title}.`, ...(message ? [`“${message.slice(0, 400)}”`] : [])],
      cta: { label: "See the job", path: `/jobs/${jobId}` },
    });
  } catch {
    // Email is best effort.
  }
}
