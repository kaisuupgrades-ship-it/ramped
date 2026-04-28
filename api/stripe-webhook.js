// api/stripe-webhook.js — receives Stripe events, verifies signature, updates booking row.
// POST /api/stripe-webhook
//
// Vercel passes the body as a stream by default; we re-read it as raw text so the HMAC
// matches what Stripe signed. Disable bodyParser via the `config` export at the bottom.

import { verifyStripeSignature } from './_lib/stripe.js';
import { notifyPaymentEvent } from './_lib/notify.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL     = process.env.SITE_URL || 'https://www.30dayramp.com';
const WHSEC        = process.env.STRIPE_WEBHOOK_SECRET;

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function findBookingByCustomerOrSub({ customerId, subscriptionId, bookingMetadataId }) {
  // Prefer explicit booking_id metadata when present on the event payload.
  if (bookingMetadataId && /^[0-9a-f-]{36}$/i.test(bookingMetadataId)) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingMetadataId}&select=id,email,name`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const arr = r.ok ? await r.json() : [];
    if (arr[0]) return arr[0];
  }
  if (customerId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=id,email,name&order=created_at.desc&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const arr = r.ok ? await r.json() : [];
    if (arr[0]) return arr[0];
  }
  if (subscriptionId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id,email,name&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const arr = r.ok ? await r.json() : [];
    if (arr[0]) return arr[0];
  }
  return null;
}

async function patchBooking(id, patch) {
  return fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function recordEventOnce(eventId, type, payload) {
  // Insert into stripe_events table; if PK collision, this is a replay — return false.
  const r = await fetch(`${SUPABASE_URL}/rest/v1/stripe_events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ id: eventId, type, payload }),
  });
  return r.ok || r.status === 201;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!WHSEC) return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET not configured' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'DB not configured' });

  const rawBody = await readRawBody(req);
  const sig = req.headers['stripe-signature'];

  if (!verifyStripeSignature({ rawBody, signatureHeader: sig, secret: WHSEC })) {
    console.warn('Stripe webhook signature mismatch');
    return res.status(400).json({ error: 'Invalid signature' });
  }
  let event;
  try { event = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'Bad JSON' }); }

  // Idempotency — duplicate event delivery is a normal Stripe behavior
  const fresh = await recordEventOnce(event.id, event.type, event);
  if (!fresh) return res.status(200).json({ ok: true, replayed: true });

  const obj = event.data?.object || {};
  const customerId   = obj.customer || obj.customer_id || null;
  const subId        = obj.id?.startsWith('sub_') ? obj.id : (obj.subscription || null);
  const bookingMeta  = obj.metadata?.ramped_booking_id || null;
  const booking = await findBookingByCustomerOrSub({ customerId, subscriptionId: subId, bookingMetadataId: bookingMeta });

  // Switch on event type
  switch (event.type) {
    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      if (booking) {
        await patchBooking(booking.id, {
          payment_status: 'onboarding_paid',
          onboarding_paid_at: new Date().toISOString(),
        });
      }
      notifyPaymentEvent({
        event: event.type,
        customerEmail: booking?.email || obj.customer_email || null,
        amount: obj.amount_paid || obj.total || null,
        bookingId: booking?.id || null,
        siteUrl: SITE_URL,
      }).catch(() => {});
      break;
    }
    case 'invoice.payment_failed': {
      if (booking) await patchBooking(booking.id, { payment_status: 'past_due' });
      notifyPaymentEvent({
        event: event.type,
        customerEmail: booking?.email || obj.customer_email || null,
        amount: obj.amount_due || null,
        bookingId: booking?.id || null,
        siteUrl: SITE_URL,
      }).catch(() => {});
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      if (booking) {
        const status = obj.status || 'active';
        const map = { active: 'subscription_active', past_due: 'past_due', canceled: 'cancelled', trialing: 'subscription_active', incomplete: 'unpaid' };
        await patchBooking(booking.id, {
          stripe_subscription_id: obj.id,
          payment_status: map[status] || 'subscription_active',
          subscription_started_at: obj.start_date ? new Date(obj.start_date * 1000).toISOString() : new Date().toISOString(),
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      if (booking) {
        await patchBooking(booking.id, {
          payment_status: 'cancelled',
          subscription_cancelled_at: new Date().toISOString(),
        });
      }
      notifyPaymentEvent({
        event: event.type,
        customerEmail: booking?.email || null,
        amount: null,
        bookingId: booking?.id || null,
        siteUrl: SITE_URL,
      }).catch(() => {});
      break;
    }
    default:
      // Unhandled but recorded; fine.
      break;
  }

  return res.status(200).json({ ok: true });
}

// IMPORTANT: Stripe signature verification needs the raw bytes.
export const config = { api: { bodyParser: false } };
