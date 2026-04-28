// api/admin-create-subscription.js — start the recurring subscription for a booking.
// POST /api/admin-create-subscription  body: { bookingId, trialEnd? }
//
// Only valid for monthly billing (annual is invoiced 12x upfront — no recurring sub).
// Idempotent on stripe_subscription_id.

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';
import { isStripeConfigured, createMonthlySubscription, createOrFindCustomer } from './_lib/stripe.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise(r => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); req.on('error', () => r({}));
  });
}

export default async function handler(req, res) {
  setAdminCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isStripeConfigured()) return res.status(503).json({ error: 'Stripe not configured' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'DB not configured' });

  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId || '');
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return res.status(400).json({ error: 'Invalid bookingId' });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}&select=id,name,email,company,tier,billing_cadence,stripe_customer_id,stripe_subscription_id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) return res.status(500).json({ error: 'DB read failed' });
  const arr = await r.json();
  const booking = arr?.[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.stripe_subscription_id) {
    return res.status(200).json({ ok: true, alreadyCreated: true, subscriptionId: booking.stripe_subscription_id });
  }

  const tier    = (body.tier || booking.tier || 'starter').toLowerCase();
  const billing = (body.billing || booking.billing_cadence || 'monthly').toLowerCase();
  if (billing !== 'monthly') {
    return res.status(400).json({ error: 'Annual billing is invoiced 12x upfront — no recurring subscription needed.' });
  }

  try {
    let customer;
    if (booking.stripe_customer_id) {
      customer = { id: booking.stripe_customer_id };
    } else {
      customer = await createOrFindCustomer({
        email: booking.email, name: booking.name, company: booking.company, bookingId,
      });
    }
    const sub = await createMonthlySubscription({
      customerId: customer.id, tier, billing, bookingId, trialEnd: body.trialEnd,
    });
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        stripe_customer_id: customer.id,
        stripe_subscription_id: sub.id,
        subscription_started_at: new Date().toISOString(),
        payment_status: 'subscription_active',
      }),
    });
    return res.status(200).json({ ok: true, subscriptionId: sub.id, status: sub.status });
  } catch (err) {
    console.error('admin-create-subscription failed:', err.message, err.stripeError || err.stripe || null);
    return res.status(500).json({ error: err.message, stripe: err.stripeError || err.stripe || null });
  }
}
