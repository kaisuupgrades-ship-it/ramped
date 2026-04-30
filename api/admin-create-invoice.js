// api/admin-create-invoice.js — admin sends a customer their onboarding + first-period invoice.
// POST /api/admin-create-invoice  body: { bookingId, tier?, billing? }
//
// Tier/billing default to whatever's on the booking row but admin can override.
// Idempotent — if a stripe_invoice_id is already on the booking, returns it without re-creating.

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';
import { isStripeConfigured, getTierPricing, createOrFindCustomer, createOnboardingPlusFirstInvoice } from './_lib/stripe.js';
import { logAdminAction } from './_lib/audit-log.js';

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

  // Look up booking
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}&select=id,name,email,company,tier,stripe_customer_id,stripe_invoice_id,billing_cadence`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) return res.status(500).json({ error: 'DB read failed' });
  const arr = await r.json();
  const booking = arr?.[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!booking.email) return res.status(400).json({ error: 'Booking has no email' });

  // Idempotency — if invoice was already created, return it
  if (booking.stripe_invoice_id) {
    return res.status(200).json({ ok: true, alreadyCreated: true, invoiceId: booking.stripe_invoice_id });
  }

  const tier    = (body.tier || booking.tier || 'starter').toLowerCase();
  const billing = (body.billing || booking.billing_cadence || 'annual').toLowerCase();
  const pricing = getTierPricing(tier, billing);
  if (!pricing) return res.status(400).json({ error: `Unknown tier/billing: ${tier}/${billing}` });

  try {
    // Find or create the customer
    let customer;
    if (booking.stripe_customer_id) {
      customer = { id: booking.stripe_customer_id };
    } else {
      customer = await createOrFindCustomer({
        email: booking.email,
        name: booking.name,
        company: booking.company,
        bookingId,
      });
    }

    // Create + finalize invoice
    const invoice = await createOnboardingPlusFirstInvoice({
      customerId: customer.id,
      tier, billing, bookingId,
    });

    // Persist on booking
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        stripe_customer_id: customer.id,
        stripe_invoice_id: invoice.id,
        billing_cadence: billing,
        contract_amount_cents: pricing.recurring_amount,
        payment_status: 'unpaid',
      }),
    });

    logAdminAction(req, {
      action: 'invoice.create',
      target_table: 'bookings',
      target_id: bookingId,
      payload: { tier, billing, invoiceId: invoice.id, total: invoice.total },
      result_status: 200,
    }).catch(() => {});
    return res.status(200).json({
      ok: true,
      invoiceId: invoice.id,
      hostedUrl: invoice.hosted_invoice_url || null,
      total: invoice.total,
      tier, billing,
    });
  } catch (err) {
    console.error('admin-create-invoice failed:', err.message, err.stripeError || err.stripe || null);
    logAdminAction(req, { action: 'invoice.create', target_table: 'bookings', target_id: bookingId, payload: { tier, billing, error: err.message }, result_status: 500 }).catch(() => {});
    return res.status(500).json({ error: err.message, stripe: err.stripeError || err.stripe || null });
  }
}
