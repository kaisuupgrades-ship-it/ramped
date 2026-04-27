// api/_lib/stripe.js — thin REST wrapper for Stripe
//
// We don't use the official `stripe` Node SDK because the repo has no
// package.json / build step. This file calls api.stripe.com directly with
// fetch + Bearer auth + form-encoded bodies.
//
// Tier prices are the source of truth here. If you change pricing on the
// site, change it here too. (Audit M1 — when the build pipeline lands,
// move these into a shared constants file.)
//
// Required env vars:
//   STRIPE_SECRET_KEY      — sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET  — whsec_... (only used by api/stripe-webhook.js)
//
// Optional env vars (test mode bypass for owner_email / from_email):
//   OWNER_EMAIL            — defaults to jon@30dayramp.com

import crypto from 'crypto';

const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

// ── Pricing source of truth ──────────────────────────────────────────────────
// Cents because Stripe wants integer minor units.
const TIER_PRICES = {
  starter: {
    monthly: { recurring_amount: 250000, onboarding_amount: 250000, label: 'Starter' },
    annual:  { recurring_amount: 208300, onboarding_amount: 250000, label: 'Starter (annual billing)' },
  },
  growth: {
    monthly: { recurring_amount: 500000, onboarding_amount: 350000, label: 'Growth' },
    annual:  { recurring_amount: 416700, onboarding_amount: 350000, label: 'Growth (annual billing)' },
  },
  // 'enterprise' is intentionally absent — those deals are scoped on the
  // discovery call and invoiced manually from the Stripe dashboard.
};

export function isStripeConfigured() {
  return !!STRIPE_KEY && STRIPE_KEY.startsWith('sk_');
}

export function getTierPricing(tier, billing) {
  const t = TIER_PRICES[String(tier || '').toLowerCase()];
  if (!t) return null;
  const b = t[String(billing || '').toLowerCase()];
  return b || null;
}

// ── Form encoding (Stripe REST API expects application/x-www-form-urlencoded) ─
// Supports nested objects via Stripe's bracket notation: foo[bar]=baz.
function encodeForm(obj, prefix) {
  const parts = [];
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') {
          parts.push(encodeForm(item, `${key}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`);
        }
      });
    } else if (v && typeof v === 'object') {
      parts.push(encodeForm(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.join('&');
}

// ── Core request helper ─────────────────────────────────────────────────────
export async function stripeRequest(method, path, body, { idempotencyKey } = {}) {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in Vercel.');
  }
  const headers = {
    'Authorization': `Bearer ${STRIPE_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers,
    body: body ? encodeForm(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe ${method} ${path} failed: ${res.status}`);
    err.status = res.status;
    err.stripe = data?.error || data;
    throw err;
  }
  return data;
}

// ── Customer ────────────────────────────────────────────────────────────────
export async function createOrFindCustomer({ email, name, company, bookingId }) {
  // Search for existing customer by email. Stripe search is eventually-consistent
  // (~1 min lag), so for very-back-to-back creates we may double-create — that's
  // acceptable, and we record the chosen id on the booking.
  const list = await stripeRequest('GET', `/customers?email=${encodeURIComponent(email)}&limit=1`);
  if (list?.data?.[0]) return list.data[0];
  const created = await stripeRequest('POST', '/customers', {
    email,
    name: name || undefined,
    description: company ? `Ramped AI — ${company}` : 'Ramped AI prospect',
    metadata: bookingId ? { ramped_booking_id: bookingId } : undefined,
  }, { idempotencyKey: bookingId ? `cust_${bookingId}` : undefined });
  return created;
}

// ── First invoice: onboarding + first month ─────────────────────────────────
// Annual flow: charge onboarding + 12 months upfront on the first invoice.
// Monthly flow: charge onboarding + first month, then create a subscription
// after this invoice is paid (api/admin-create-subscription.js).
export async function createOnboardingPlusFirstInvoice({ customerId, tier, billing, bookingId }) {
  const pricing = getTierPricing(tier, billing);
  if (!pricing) throw new Error(`Unknown tier/billing: ${tier}/${billing}`);

  // Add onboarding line item (one-time)
  await stripeRequest('POST', '/invoiceitems', {
    customer: customerId,
    amount: pricing.onboarding_amount,
    currency: 'usd',
    description: `${pricing.label} — onboarding (one-time)`,
    metadata: { ramped_booking_id: bookingId, ramped_kind: 'onboarding' },
  }, { idempotencyKey: bookingId ? `iitem_onb_${bookingId}` : undefined });

  // Add the first billing period as a one-off line item (the recurring subscription
  // takes over for month 2+ on monthly billing; on annual we charge 12× upfront here).
  if (billing === 'annual') {
    await stripeRequest('POST', '/invoiceitems', {
      customer: customerId,
      amount: pricing.recurring_amount * 12,
      currency: 'usd',
      description: `${pricing.label} — 12 months prepaid`,
      metadata: { ramped_booking_id: bookingId, ramped_kind: 'annual_prepay' },
    }, { idempotencyKey: bookingId ? `iitem_yr_${bookingId}` : undefined });
  } else {
    await stripeRequest('POST', '/invoiceitems', {
      customer: customerId,
      amount: pricing.recurring_amount,
      currency: 'usd',
      description: `${pricing.label} — first month`,
      metadata: { ramped_booking_id: bookingId, ramped_kind: 'first_month' },
    }, { idempotencyKey: bookingId ? `iitem_m1_${bookingId}` : undefined });
  }

  // Create + finalize the invoice. auto_advance=true means Stripe emails the
  // customer a hosted invoice link automatically and retries collection per the
  // payment-failed schedule configured in the Stripe dashboard.
  const invoice = await stripeRequest('POST', '/invoices', {
    customer: customerId,
    auto_advance: true,
    collection_method: 'send_invoice',
    days_until_due: 7,
    description: `Ramped AI — ${pricing.label} kickoff. 30-day go-live guarantee. Booking: ${bookingId || 'n/a'}`,
    metadata: { ramped_booking_id: bookingId, ramped_tier: tier, ramped_billing: billing },
  }, { idempotencyKey: bookingId ? `inv_${bookingId}` : undefined });

  // Finalize so it actually sends.
  const finalized = await stripeRequest('POST', `/invoices/${invoice.id}/finalize`, {
    auto_advance: true,
  });
  return finalized;
}

// ── Recurring subscription (monthly billing only) ───────────────────────────
// Run AFTER the first invoice has been paid. Stripe will charge the saved
// payment method on the next billing cycle.
export async function createMonthlySubscription({ customerId, tier, billing, bookingId, trialEnd }) {
  const pricing = getTierPricing(tier, billing);
  if (!pricing) throw new Error(`Unknown tier/billing: ${tier}/${billing}`);
  if (billing !== 'monthly') {
    throw new Error('Annual billing is invoiced 12x upfront, no recurring subscription needed.');
  }

  // Stripe wants us to attach a Price, not raw amount. We create a one-shot Price
  // pinned to a Product on the fly. Re-using would require persistent Product/Price
  // ids — keeping it self-bootstrapping for now. (Audit follow-up: cache these.)
  const product = await stripeRequest('POST', '/products', {
    name: `Ramped AI — ${pricing.label}`,
    metadata: { ramped_tier: tier, ramped_billing: billing },
  }, { idempotencyKey: bookingId ? `prod_${tier}_${billing}` : undefined });

  const price = await stripeRequest('POST', '/prices', {
    product: product.id,
    unit_amount: pricing.recurring_amount,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { ramped_tier: tier, ramped_billing: billing },
  }, { idempotencyKey: bookingId ? `price_${tier}_${billing}_${pricing.recurring_amount}` : undefined });

  // Trial-end lets us start the recurring clock the day AFTER the first invoice
  // covers (i.e. 30 days later for monthly). Caller can override.
  const computedTrialEnd = trialEnd
    ? Math.floor(new Date(trialEnd).getTime() / 1000)
    : Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

  const subscription = await stripeRequest('POST', '/subscriptions', {
    customer: customerId,
    items: [{ price: price.id }],
    trial_end: computedTrialEnd,
    proration_behavior: 'none',
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    metadata: { ramped_booking_id: bookingId, ramped_tier: tier, ramped_billing: billing },
  }, { idempotencyKey: bookingId ? `sub_${bookingId}` : undefined });

  return subscription;
}

// ── Webhook signature verification (HMAC-SHA256 timestamped) ────────────────
// Implements https://stripe.com/docs/webhooks/signatures without the SDK.
export function verifyStripeSignature({ rawBody, signatureHeader, secret, toleranceSeconds = 300 }) {
  if (!rawBody || !signatureHeader || !secret) return false;
  // Header format: t=1492774577,v1=hmac,v0=...
  const parts = String(signatureHeader).split(',').map(s => s.trim());
  const tsStr = parts.find(p => p.startsWith('t='))?.slice(2);
  const v1 = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  if (!tsStr || !v1.length) return false;
  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return false;
  const signedPayload = `${ts}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return v1.some(sig => {
    if (sig.length !== expected.length) return false;
    try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); }
    catch { return false; }
  });
}
