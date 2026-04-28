// api/portal-billing.js — customer-facing billing summary.
// GET /api/portal-billing?id=BOOKING_UUID&exp=…&t=…
//
// Auth: HMAC-signed portal token. Returns Stripe-derived data only — no full card numbers.
//
// Returned fields:
//   subscription:    { status, current_period_end, monthly_cents, label }
//   next_invoice:    { amount_due_cents, due_date }       (if any pending)
//   invoice_history: [{ id, number, status, amount_paid_cents, hosted_url, pdf_url, created_at }, ...]
//   payment_method:  { brand, last4, exp_month, exp_year }  (or null if none on file)

import { verifyMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { stripeRequest, isStripeConfigured } from './_lib/stripe.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' });

  const { id, exp, t } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id))    return res.status(400).json({ error: 'Invalid ID' });
  if (!isMapTokenConfigured())                return res.status(503).json({ error: 'Token signing not configured' });
  if (!verifyMapToken(id, exp, t))            return res.status(403).json({ error: 'Invalid or expired token' });
  if (!SUPABASE_URL || !SUPABASE_KEY)         return res.status(503).json({ error: 'DB not configured' });

  // Look up booking → stripe ids
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=stripe_customer_id,stripe_subscription_id,stripe_invoice_id,billing_cadence,tier,payment_status,contract_amount_cents`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) return res.status(500).json({ error: 'DB error' });
  const arr = await r.json();
  const b = arr?.[0];
  if (!b) return res.status(404).json({ error: 'Booking not found' });

  // If Stripe isn't configured OR no customer linked yet, return empty shape
  if (!isStripeConfigured() || !b.stripe_customer_id) {
    return res.status(200).json({
      configured: false,
      payment_status: b.payment_status || 'unpaid',
      tier: b.tier || null,
      billing_cadence: b.billing_cadence || null,
      monthly_cents: b.contract_amount_cents || null,
      subscription: null,
      next_invoice: null,
      invoice_history: [],
      payment_method: null,
    });
  }

  // Fetch from Stripe — best-effort, swallow individual errors
  let subscription = null;
  let invoiceHistory = [];
  let paymentMethod = null;
  let nextInvoice = null;

  try {
    if (b.stripe_subscription_id) {
      const s = await stripeRequest('GET', `/subscriptions/${b.stripe_subscription_id}?expand[]=default_payment_method`);
      const item = s.items?.data?.[0];
      subscription = {
        status: s.status,
        current_period_end: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
        monthly_cents: item?.price?.unit_amount || null,
        label: item?.price?.nickname || (item?.price?.unit_amount ? `${(item.price.unit_amount / 100).toFixed(0)} USD / month` : null),
        cancel_at_period_end: !!s.cancel_at_period_end,
      };
      if (s.default_payment_method?.card) {
        const c = s.default_payment_method.card;
        paymentMethod = { brand: c.brand, last4: c.last4, exp_month: c.exp_month, exp_year: c.exp_year };
      }
    }
  } catch (e) { console.warn('subscription lookup failed:', e.message); }

  try {
    const list = await stripeRequest('GET', `/invoices?customer=${encodeURIComponent(b.stripe_customer_id)}&limit=20`);
    invoiceHistory = (list?.data || []).map(inv => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,                    // open / paid / void / uncollectible / draft
      amount_paid_cents: inv.amount_paid,
      amount_due_cents: inv.amount_due,
      total_cents: inv.total,
      hosted_url: inv.hosted_invoice_url || null,
      pdf_url: inv.invoice_pdf || null,
      created_at: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      description: inv.description || null,
    }));
    // Find earliest open invoice as "next invoice"
    const open = invoiceHistory.find(i => i.status === 'open');
    if (open) {
      nextInvoice = {
        amount_due_cents: open.amount_due_cents,
        hosted_url: open.hosted_url,
        invoice_id: open.id,
      };
    }
  } catch (e) { console.warn('invoice list failed:', e.message); }

  // Fallback to a payment method on the customer record if none on the subscription
  if (!paymentMethod) {
    try {
      const cust = await stripeRequest('GET', `/customers/${b.stripe_customer_id}?expand[]=default_source`);
      if (cust.invoice_settings?.default_payment_method) {
        const pm = await stripeRequest('GET', `/payment_methods/${cust.invoice_settings.default_payment_method}`);
        if (pm?.card) {
          paymentMethod = { brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year };
        }
      } else if (cust.default_source?.last4) {
        paymentMethod = { brand: cust.default_source.brand, last4: cust.default_source.last4, exp_month: cust.default_source.exp_month, exp_year: cust.default_source.exp_year };
      }
    } catch (e) { console.warn('customer payment method fallback failed:', e.message); }
  }

  return res.status(200).json({
    configured: true,
    payment_status: b.payment_status || null,
    tier: b.tier || null,
    billing_cadence: b.billing_cadence || null,
    monthly_cents: b.contract_amount_cents || subscription?.monthly_cents || null,
    subscription,
    next_invoice: nextInvoice,
    invoice_history: invoiceHistory,
    payment_method: paymentMethod,
  });
}
