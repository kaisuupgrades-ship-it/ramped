import { Resend } from "resend";
import { site } from "./site";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM_EMAIL ?? site.email;

const resend = apiKey ? new Resend(apiKey) : null;

export interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string | string[];
}

/** Fire-and-forget email. Returns { ok, id } so callers can log if they care. */
export async function sendEmail(args: SendArgs): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send", { to: args.to, subject: args.subject });
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: `Ramped AI <${fromAddress}>`,
      to: Array.isArray(args.to) ? args.to : [args.to],
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo ?? site.email,
      cc: args.cc,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Wrap arbitrary HTML body in a brand-shell with header + footer. */
export function emailShell(bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0d121b;font-family:Inter,system-ui,sans-serif;color:#f4f6fa;line-height:1.5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d121b">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
      <tr><td style="padding-bottom:24px">
        <a href="${site.tagline ? "https://www.30dayramp.com" : "#"}" style="color:#60a5fa;font-weight:700;text-decoration:none;font-size:18px;letter-spacing:-0.02em">Ramped AI</a>
      </td></tr>
      <tr><td style="background:#161d28;border:1px solid #262f3f;border-radius:14px;padding:28px;color:#c8d0dc;font-size:14.5px">
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding-top:20px;text-align:center;color:#646e7e;font-size:12px">
        Ramped AI · <a href="mailto:${site.email}" style="color:#60a5fa">${site.email}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
