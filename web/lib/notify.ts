/**
 * Slack fan-out for admin-facing events. Best-effort: never throws, logs
 * failures. Falls through silently if SLACK_WEBHOOK_URL isn't set.
 */

const SLACK_URL = process.env.SLACK_WEBHOOK_URL;

export function isSlackConfigured(): boolean {
  return !!SLACK_URL && SLACK_URL.startsWith("https://hooks.slack.com/");
}

interface SlackBlock { type: string; [k: string]: unknown }

export async function notifySlack({ text, blocks = null }: { text: string; blocks?: SlackBlock[] | null }): Promise<boolean> {
  if (!isSlackConfigured()) return false;
  try {
    const res = await fetch(SLACK_URL as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blocks ? { text, blocks } : { text }),
    });
    if (!res.ok) console.warn("Slack notify failed:", res.status);
    return res.ok;
  } catch (err) {
    console.warn("Slack notify error:", (err as Error).message);
    return false;
  }
}

export async function notifyTicketCreated({ subject, body, customerName, customerEmail, ticketId, siteUrl }: {
  subject: string; body?: string; customerName?: string | null; customerEmail?: string | null; ticketId?: string | null; siteUrl: string;
}): Promise<boolean> {
  return notifySlack({
    text: `🎟 New ticket from ${customerName || customerEmail}: ${subject}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "🎟 New support ticket" } },
      { type: "section", text: { type: "mrkdwn", text: `*${subject}*\n_${customerName || ""}${customerEmail ? " · " + customerEmail : ""}_` } },
      { type: "section", text: { type: "mrkdwn", text: "```" + (body || "").slice(0, 800) + "```" } },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open admin" }, url: `${siteUrl}/admin#tickets`, style: "primary" }] },
    ],
  });
}

export async function notifyBookingCreated({ name, email, company, when, tier, siteUrl, bookingId }: {
  name: string; email: string; company?: string | null; when: string; tier?: string | null; siteUrl: string; bookingId?: string;
}): Promise<boolean> {
  return notifySlack({
    text: `📅 New booking: ${name} (${email})${tier ? ` — ${tier}` : ""} for ${when}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "📅 New discovery call booked" } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*Name*\n${name || "—"}` },
        { type: "mrkdwn", text: `*When*\n${when || "—"}` },
        { type: "mrkdwn", text: `*Email*\n${email || "—"}` },
        { type: "mrkdwn", text: `*Tier*\n${tier || "—"}` },
        { type: "mrkdwn", text: `*Company*\n${company || "—"}` },
        { type: "mrkdwn", text: `*Booking*\n${bookingId || "—"}` },
      ] },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open admin" }, url: `${siteUrl}/admin`, style: "primary" }] },
    ],
  });
}

export async function notifyPaymentEvent({ event, customerEmail, amount, bookingId, siteUrl }: {
  event: string; customerEmail?: string | null; amount?: number | null; bookingId?: string | null; siteUrl: string;
}): Promise<boolean> {
  const dollars = amount != null ? `$${(amount / 100).toFixed(2)}` : "—";
  const emoji = event.includes("paid") || event.includes("succeeded") ? "💰" : event.includes("failed") ? "⚠️" : "🔔";
  return notifySlack({
    text: `${emoji} Stripe: ${event} — ${customerEmail} ${dollars}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `${emoji} *Stripe event:* \`${event}\`\n*Customer:* ${customerEmail || "—"} *Amount:* ${dollars} *Booking:* ${bookingId || "—"}` } },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open admin" }, url: `${siteUrl}/admin`, style: "primary" }] },
    ],
  });
}

export async function notifyOnboardingCompleted({ name, email, bookingId, siteUrl }: {
  name?: string | null; email: string; bookingId?: string; siteUrl: string;
}): Promise<boolean> {
  return notifySlack({
    text: `✅ ${name || email} finished onboarding — ready to build.`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `✅ *Onboarding complete:* ${name || email}\nBooking: ${bookingId}` } },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open portal" }, url: `${siteUrl}/admin`, style: "primary" }] },
    ],
  });
}
