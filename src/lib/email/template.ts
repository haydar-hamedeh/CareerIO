const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type EmailContent = {
  subject: string;
  heading: string;
  /** Plain paragraphs. */
  paragraphs: string[];
  /** Optional list of lines shown as a card (job titles, etc.). */
  items?: { title: string; sub?: string }[];
  cta: { label: string; path: string };
  footer?: string;
};

export function renderEmail(c: EmailContent) {
  const url = `${siteUrl()}${c.cta.path}`;
  const items = (c.items ?? [])
    .map(
      (i) =>
        `<tr><td style="padding:12px 16px;border-top:1px solid #e8e1d2"><div style="font-weight:700;font-size:15px;color:#10231b">${esc(i.title)}</div>${
          i.sub ? `<div style="font-size:13px;color:#5f6b64;margin-top:2px">${esc(i.sub)}</div>` : ""
        }</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e7;font-family:Helvetica,Arial,sans-serif;color:#10231b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 16px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#0e5c42">CareerIO</td></tr>
<tr><td style="background:#ffffff;border-radius:24px;padding:28px 28px 24px;border:1px solid #e8e1d2">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;letter-spacing:-0.02em">${esc(c.heading)}</h1>
${c.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#33423a">${esc(p)}</p>`).join("")}
${items ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;background:#faf7f0;border-radius:16px;overflow:hidden">${items}</table>` : ""}
<a href="${esc(url)}" style="display:inline-block;background:#0e5c42;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:999px">${esc(c.cta.label)}</a>
</td></tr>
<tr><td style="padding:16px 8px 0;font-size:12px;line-height:1.5;color:#7a857e">${esc(
    c.footer ?? "You get this because of your CareerIO notification settings.",
  )} <a href="${esc(siteUrl())}/settings" style="color:#0e5c42">Change settings</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [c.heading, "", ...c.paragraphs, ...(c.items ?? []).map((i) => `- ${i.title}${i.sub ? ` (${i.sub})` : ""}`), "", `${c.cta.label}: ${url}`].join("\n");
  return { subject: c.subject, html, text };
}
