import "server-only";

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

const FROM = () => process.env.EMAIL_FROM ?? "CareerIO <onboarding@resend.dev>";

/** Sends one email through Resend. Never throws: email is a convenience and must not break the action that triggered it. */
export async function sendEmail(input: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to: [input.to], subject: input.subject, html: input.html, text: input.text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
