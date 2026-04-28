// api/_lib/notify.js — fan-out notifications to Slack (+ email if needed) for
// admin-facing events. Best-effort: never throws; logs failures.
//
// Required env: SLACK_WEBHOOK_URL (incoming-webhook URL). Falls through if absent.

const SLACK_URL = process.env.SLACK_WEBHOOK_URL;

export function isSlackConfigured() {
  return !!SLACK_URL && SLACK_URL.startsWith('https://hooks.slack.com/');
}

export async function notifySlack({ text, blocks = null }) {
  if (!isSlackConfigured()) return false;
  try {
    const res = await fetch(SLACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blocks ? { text, blocks } : { text }),
    });
    if (!res.ok) console.warn('Slack notify failed:', res.status);
    return res.ok;
  } catch (err) {
    console.warn('Slack notify error:', err.message);
    return false;
  }
}

// Convenience for the most common ramped event shapes
export async function notifyTicketCreated({ subject, body, customerName, customerEmail, ticketId, siteUrl }) {
  return notifySlack({
    text: `🎟 New ticket from ${customerName || customerEmail}: ${subject}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🎟 New support ticket' } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${subject}*\n_${customerName || ''}${customerEmail ? ' · ' + customerEmail : ''}_` } },
      { type: 'section', text: { type: 'mrkdwn', text: '```' + (body || '').slice(0, 800) + '```' } },
      { type: 'actions', elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Open admin' }, url: `${siteUrl}/admin#tickets`, style: 'primary' }
      ]},
    ],
  });
}

export async function notifyBookingCreated({ name, email, company, when, tier, siteUrl, bookingId }) {
  return notifySlack({
    text: `📅 New booking: ${name} (${email})${tier ? ` — ${tier}` : ''} for ${when}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📅 New discovery call booked' } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Name*\n${name || '—'}` },
        { type: 'mrkdwn', text: `*When*\n${when || '—'}` },
        { type: 'mrkdwn', text: `*Email*\n${email || '—'}` },
        { type: 'mrkdwn', text: `*Tier*\n${tier || '—'}` },
        { type: 'mrkdwn', text: `*Company*\n${company || '—'}` },
        { type: 'mrkdwn', text: `*Booking*\n${bookingId || '—'}` },
      ]},
      { type: 'actions', elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Open admin' }, url: `${siteUrl}/admin`, style: 'primary' }
      ]},
    ],
  });
}

export async function notifyPaymentEvent({ event, customerEmail, amount, bookingId, siteUrl }) {
  const dollars = amount != null ? `$${(amount / 100).toFixed(2)}` : '—';
  const emoji = event.includes('paid') || event.includes('succeeded') ? '💰' : event.includes('failed') ? '⚠️' : '🔔';
  return notifySlack({
    text: `${emoji} Stripe: ${event} — ${customerEmail} ${dollars}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `${emoji} *Stripe event:* \`${event}\`\n*Customer:* ${customerEmail || '—'} *Amount:* ${dollars} *Booking:* ${bookingId || '—'}` } },
      { type: 'actions', elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Open admin' }, url: `${siteUrl}/admin`, style: 'primary' }
      ]},
    ],
  });
}

export async function notifyOnboardingCompleted({ name, email, bookingId, siteUrl }) {
  return notifySlack({
    text: `✅ ${name || email} finished onboarding — ready to build.`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `✅ *Onboarding complete:* ${name || email}\nBooking: ${bookingId}` } },
      { type: 'actions', elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Open portal' }, url: `${siteUrl}/admin`, style: 'primary' }
      ]},
    ],
  });
}
