import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";
import { supabaseRest } from "@/lib/supabase";
import { isStripeConfigured, getTierPricing, createOrFindCustomer, createOnboardingPlusFirstInvoice, type Billing } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin-create-invoice  body: { bookingId, tier?, billing? }
 *
 * Creates the customer's onboarding + first-period invoice in Stripe and
 * persists the IDs back to the booking row. Idempotent on stripe_invoice_id —
 * a second call returns the existing invoice without re-creating.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: { bookingId?: string; tier?: string; billing?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const bookingId = String(body.bookingId || "");
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });

  const r = await supabaseRest<Array<{
    id: string; name: string | null; email: string | null; company: string | null;
    tier: string | null; stripe_customer_id: string | null;
    stripe_invoice_id: string | null; billing_cadence: string | null;
  }>>("GET", `/bookings?id=eq.${bookingId}&select=id,name,email,company,tier,stripe_customer_id,stripe_invoice_id,billing_cadence`);
  if (!r.ok) return NextResponse.json({ error: "DB read failed" }, { status: 500 });
  const booking = (Array.isArray(r.data)) ? r.data[0] : null;
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!booking.email) return NextResponse.json({ error: "Booking has no email" }, { status: 400 });

  if (booking.stripe_invoice_id) {
    return NextResponse.json({ ok: true, alreadyCreated: true, invoiceId: booking.stripe_invoice_id });
  }

  const tier = (body.tier || booking.tier || "starter").toLowerCase();
  const billing = ((body.billing || booking.billing_cadence || "annual").toLowerCase()) as Billing;
  const pricing = getTierPricing(tier, billing);
  if (!pricing) return NextResponse.json({ error: `Unknown tier/billing: ${tier}/${billing}` }, { status: 400 });

  try {
    const customer = booking.stripe_customer_id
      ? { id: booking.stripe_customer_id }
      : await createOrFindCustomer({ email: booking.email, name: booking.name, company: booking.company, bookingId });

    const invoice = await createOnboardingPlusFirstInvoice({
      customerId: customer.id, tier, billing, bookingId,
    }) as { id: string; total: number; hosted_invoice_url?: string };

    await supabaseRest("PATCH", `/bookings?id=eq.${bookingId}`, {
      stripe_customer_id: customer.id,
      stripe_invoice_id: invoice.id,
      billing_cadence: billing,
      contract_amount_cents: pricing.recurring_amount,
      payment_status: "unpaid",
    });

    logAdminAction(req, {
      action: "invoice.create", target_table: "bookings", target_id: bookingId,
      payload: { tier, billing, invoiceId: invoice.id, total: invoice.total },
      result_status: 200,
    }).catch(() => {});

    return NextResponse.json({
      ok: true, invoiceId: invoice.id,
      hostedUrl: invoice.hosted_invoice_url || null,
      total: invoice.total, tier, billing,
    });
  } catch (err) {
    const e = err as Error & { stripe?: unknown };
    console.error("admin-create-invoice failed:", e.message, e.stripe);
    logAdminAction(req, {
      action: "invoice.create", target_table: "bookings", target_id: bookingId,
      payload: { tier, billing, error: e.message },
      result_status: 500,
    }).catch(() => {});
    return NextResponse.json({ error: e.message, stripe: e.stripe || null }, { status: 500 });
  }
}
