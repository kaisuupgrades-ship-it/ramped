import { NextResponse, type NextRequest } from "next/server";
import { checkPortalToken } from "@/lib/portal-auth";
import { supabaseRest } from "@/lib/supabase";
import { stripeRequest, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal-billing?id&exp&t
 *
 * Customer-facing billing summary derived from Stripe + the booking row.
 * Returns Stripe-derived data only — never raw card numbers.
 */

interface BookingBilling {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  billing_cadence: string | null;
  tier: string | null;
  payment_status: string | null;
  contract_amount_cents: number | null;
}

interface StripeSubscription {
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items?: { data?: Array<{ price?: { unit_amount?: number; nickname?: string } }> };
  default_payment_method?: { card?: { brand: string; last4: string; exp_month: number; exp_year: number } };
}

interface StripeInvoice {
  id: string; number: string | null; status: string;
  amount_paid: number; amount_due: number; total: number;
  hosted_invoice_url: string | null; invoice_pdf: string | null;
  created: number; description: string | null;
}

interface StripeCustomer {
  invoice_settings?: { default_payment_method?: string };
  default_source?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
}

interface StripePaymentMethod {
  card?: { brand: string; last4: string; exp_month: number; exp_year: number };
}

export async function GET(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  const r = await supabaseRest<BookingBilling[]>("GET",
    `/bookings?id=eq.${encodeURIComponent(id)}&select=stripe_customer_id,stripe_subscription_id,stripe_invoice_id,billing_cadence,tier,payment_status,contract_amount_cents`);
  if (!r.ok) return NextResponse.json({ error: "DB error" }, { status: 500 });
  const b = Array.isArray(r.data) ? r.data[0] : null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (!isStripeConfigured() || !b.stripe_customer_id) {
    return NextResponse.json({
      configured: false,
      payment_status: b.payment_status || "unpaid",
      tier: b.tier,
      billing_cadence: b.billing_cadence,
      monthly_cents: b.contract_amount_cents,
      subscription: null, next_invoice: null, invoice_history: [], payment_method: null,
    });
  }

  let subscription: {
    status: string; current_period_end: string | null; monthly_cents: number | null; label: string | null; cancel_at_period_end: boolean;
  } | null = null;
  let invoiceHistory: Array<{
    id: string; number: string | null; status: string;
    amount_paid_cents: number; amount_due_cents: number; total_cents: number;
    hosted_url: string | null; pdf_url: string | null; created_at: string | null; description: string | null;
  }> = [];
  let paymentMethod: { brand: string; last4: string; exp_month: number; exp_year: number } | null = null;
  let nextInvoice: { amount_due_cents: number; hosted_url: string | null; invoice_id: string } | null = null;

  try {
    if (b.stripe_subscription_id) {
      const s = await stripeRequest<StripeSubscription>("GET", `/subscriptions/${b.stripe_subscription_id}?expand[]=default_payment_method`);
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
  } catch (e) { console.warn("subscription lookup failed:", (e as Error).message); }

  try {
    const list = await stripeRequest<{ data: StripeInvoice[] }>("GET", `/invoices?customer=${encodeURIComponent(b.stripe_customer_id)}&limit=20`);
    invoiceHistory = (list?.data || []).map((inv) => ({
      id: inv.id, number: inv.number, status: inv.status,
      amount_paid_cents: inv.amount_paid, amount_due_cents: inv.amount_due, total_cents: inv.total,
      hosted_url: inv.hosted_invoice_url, pdf_url: inv.invoice_pdf,
      created_at: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      description: inv.description,
    }));
    const open = invoiceHistory.find((i) => i.status === "open");
    if (open) nextInvoice = { amount_due_cents: open.amount_due_cents, hosted_url: open.hosted_url, invoice_id: open.id };
  } catch (e) { console.warn("invoice list failed:", (e as Error).message); }

  if (!paymentMethod) {
    try {
      const cust = await stripeRequest<StripeCustomer>("GET", `/customers/${b.stripe_customer_id}?expand[]=default_source`);
      if (cust.invoice_settings?.default_payment_method) {
        const pm = await stripeRequest<StripePaymentMethod>("GET", `/payment_methods/${cust.invoice_settings.default_payment_method}`);
        if (pm?.card) paymentMethod = { brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year };
      } else if (cust.default_source?.last4) {
        paymentMethod = {
          brand: cust.default_source.brand || "", last4: cust.default_source.last4,
          exp_month: cust.default_source.exp_month || 0, exp_year: cust.default_source.exp_year || 0,
        };
      }
    } catch (e) { console.warn("customer payment method fallback failed:", (e as Error).message); }
  }

  return NextResponse.json({
    configured: true,
    payment_status: b.payment_status, tier: b.tier, billing_cadence: b.billing_cadence,
    monthly_cents: b.contract_amount_cents || subscription?.monthly_cents || null,
    subscription, next_invoice: nextInvoice,
    invoice_history: invoiceHistory, payment_method: paymentMethod,
  });
}
