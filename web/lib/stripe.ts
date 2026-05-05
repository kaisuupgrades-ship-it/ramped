/**
 * Thin Stripe REST wrapper (no SDK) — fetch + Bearer + form-encoded bodies.
 *
 * Pricing is the source of truth here: any change to the website's pricing
 * must update TIER_PRICES below. The legacy api/_lib/stripe.js notes this same
 * audit M1 follow-up.
 *
 * Required env: STRIPE_SECRET_KEY (sk_test_... or sk_live_...)
 *               STRIPE_WEBHOOK_SECRET (whsec_..., used by /api/stripe-webhook)
 */

import crypto from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

export const TIER_PRICES = {
  starter: {
    monthly: { recurring_amount: 250000, onboarding_amount: 250000, label: "Starter" },
    annual: { recurring_amount: 208300, onboarding_amount: 250000, label: "Starter (annual billing)" },
  },
  growth: {
    monthly: { recurring_amount: 500000, onboarding_amount: 350000, label: "Growth" },
    annual: { recurring_amount: 416700, onboarding_amount: 350000, label: "Growth (annual billing)" },
  },
} as const;

export type Tier = keyof typeof TIER_PRICES;
export type Billing = "monthly" | "annual";
export interface TierPricing { recurring_amount: number; onboarding_amount: number; label: string }

export function isStripeConfigured(): boolean {
  return !!STRIPE_KEY && STRIPE_KEY.startsWith("sk_");
}

export function getTierPricing(tier: string | null | undefined, billing: string | null | undefined): TierPricing | null {
  const t = TIER_PRICES[String(tier || "").toLowerCase() as Tier];
  if (!t) return null;
  const b = t[String(billing || "").toLowerCase() as Billing];
  return b || null;
}

function encodeForm(obj: unknown, prefix?: string): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries((obj as Record<string, unknown>) || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === "object") parts.push(encodeForm(item, `${key}[${i}]`));
        else parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (v && typeof v === "object") {
      parts.push(encodeForm(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join("&");
}

interface StripeError extends Error { status?: number; stripe?: unknown }

export async function stripeRequest<T = unknown>(method: string, path: string, body?: unknown, opts: { idempotencyKey?: string } = {}): Promise<T> {
  if (!isStripeConfigured()) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in Vercel.");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const res = await fetch(`${STRIPE_API}${path}`, { method, headers, body: body ? encodeForm(body) : undefined });
  const text = await res.text();
  let data: unknown = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) {
    const errMsg = (data as { error?: { message?: string } })?.error?.message || `Stripe ${method} ${path} failed: ${res.status}`;
    const err: StripeError = new Error(errMsg);
    err.status = res.status;
    err.stripe = (data as { error?: unknown })?.error || data;
    throw err;
  }
  return data as T;
}

export interface StripeCustomer { id: string; email?: string; name?: string }

export async function createOrFindCustomer({ email, name, company, bookingId }: {
  email: string; name?: string | null; company?: string | null; bookingId?: string;
}): Promise<StripeCustomer> {
  const list = await stripeRequest<{ data: StripeCustomer[] }>("GET", `/customers?email=${encodeURIComponent(email)}&limit=1`);
  if (list?.data?.[0]) return list.data[0];
  return stripeRequest<StripeCustomer>("POST", "/customers", {
    email, name: name || undefined,
    description: company ? `Ramped AI — ${company}` : "Ramped AI prospect",
    metadata: bookingId ? { ramped_booking_id: bookingId } : undefined,
  }, { idempotencyKey: bookingId ? `cust_${bookingId}` : undefined });
}

export async function createOnboardingPlusFirstInvoice({ customerId, tier, billing, bookingId }: {
  customerId: string; tier: string; billing: Billing; bookingId?: string;
}): Promise<unknown> {
  const pricing = getTierPricing(tier, billing);
  if (!pricing) throw new Error(`Unknown tier/billing: ${tier}/${billing}`);

  await stripeRequest("POST", "/invoiceitems", {
    customer: customerId, amount: pricing.onboarding_amount, currency: "usd",
    description: `${pricing.label} — onboarding (one-time)`,
    metadata: { ramped_booking_id: bookingId, ramped_kind: "onboarding" },
  }, { idempotencyKey: bookingId ? `iitem_onb_${bookingId}` : undefined });

  if (billing === "annual") {
    await stripeRequest("POST", "/invoiceitems", {
      customer: customerId, amount: pricing.recurring_amount * 12, currency: "usd",
      description: `${pricing.label} — 12 months prepaid`,
      metadata: { ramped_booking_id: bookingId, ramped_kind: "annual_prepay" },
    }, { idempotencyKey: bookingId ? `iitem_yr_${bookingId}` : undefined });
  } else {
    await stripeRequest("POST", "/invoiceitems", {
      customer: customerId, amount: pricing.recurring_amount, currency: "usd",
      description: `${pricing.label} — first month`,
      metadata: { ramped_booking_id: bookingId, ramped_kind: "first_month" },
    }, { idempotencyKey: bookingId ? `iitem_m1_${bookingId}` : undefined });
  }

  const invoice = await stripeRequest<{ id: string }>("POST", "/invoices", {
    customer: customerId, auto_advance: true, collection_method: "send_invoice", days_until_due: 7,
    description: `Ramped AI — ${pricing.label} kickoff. 30-day go-live guarantee. Booking: ${bookingId || "n/a"}`,
    metadata: { ramped_booking_id: bookingId, ramped_tier: tier, ramped_billing: billing },
  }, { idempotencyKey: bookingId ? `inv_${bookingId}` : undefined });

  return stripeRequest("POST", `/invoices/${invoice.id}/finalize`, { auto_advance: true });
}

export async function createMonthlySubscription({ customerId, tier, billing, bookingId, trialEnd }: {
  customerId: string; tier: string; billing: Billing; bookingId?: string; trialEnd?: string | number;
}): Promise<unknown> {
  const pricing = getTierPricing(tier, billing);
  if (!pricing) throw new Error(`Unknown tier/billing: ${tier}/${billing}`);
  if (billing !== "monthly") throw new Error("Annual billing is invoiced 12x upfront, no recurring subscription needed.");

  const product = await stripeRequest<{ id: string }>("POST", "/products", {
    name: `Ramped AI — ${pricing.label}`,
    metadata: { ramped_tier: tier, ramped_billing: billing },
  }, { idempotencyKey: bookingId ? `prod_${tier}_${billing}` : undefined });

  const price = await stripeRequest<{ id: string }>("POST", "/prices", {
    product: product.id, unit_amount: pricing.recurring_amount, currency: "usd",
    recurring: { interval: "month" },
    metadata: { ramped_tier: tier, ramped_billing: billing },
  }, { idempotencyKey: bookingId ? `price_${tier}_${billing}_${pricing.recurring_amount}` : undefined });

  const computedTrialEnd = trialEnd
    ? Math.floor(new Date(trialEnd).getTime() / 1000)
    : Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

  return stripeRequest("POST", "/subscriptions", {
    customer: customerId, items: [{ price: price.id }],
    trial_end: computedTrialEnd, proration_behavior: "none",
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: { ramped_booking_id: bookingId, ramped_tier: tier, ramped_billing: billing },
  }, { idempotencyKey: bookingId ? `sub_${bookingId}` : undefined });
}

/**
 * Stripe webhook signature verification — HMAC-SHA256 with timestamp tolerance.
 * Header format: t=<unix>,v1=<hmac>,v0=<hmac>
 */
export function verifyStripeSignature({ rawBody, signatureHeader, secret, toleranceSeconds = 300 }: {
  rawBody: string; signatureHeader: string | null; secret: string; toleranceSeconds?: number;
}): boolean {
  if (!rawBody || !signatureHeader || !secret) return false;
  const parts = String(signatureHeader).split(",").map((s) => s.trim());
  const tsStr = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!tsStr || !v1.length) return false;
  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return false;
  const signedPayload = `${ts}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return v1.some((sig) => {
    if (sig.length !== expected.length) return false;
    try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); }
    catch { return false; }
  });
}
