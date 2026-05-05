import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";
import { supabaseRest } from "@/lib/supabase";
import { isStripeConfigured, createMonthlySubscription, createOrFindCustomer, type Billing } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin-create-subscription  body: { bookingId, trialEnd? }
 *
 * Starts the recurring subscription for a booking. Monthly billing only —
 * annual is invoiced 12x upfront so there's no recurring sub. Idempotent on
 * stripe_subscription_id.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: { bookingId?: string; tier?: string; billing?: string; trialEnd?: string | number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const bookingId = String(body.bookingId || "");
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });

  const r = await supabaseRest<Array<{
    id: string; name: string | null; email: string | null; company: string | null;
    tier: string | null; billing_cadence: string | null;
    stripe_customer_id: string | null; stripe_subscription_id: string | null;
  }>>("GET", `/bookings?id=eq.${bookingId}&select=id,name,email,company,tier,billing_cadence,stripe_customer_id,stripe_subscription_id`);
  if (!r.ok) return NextResponse.json({ error: "DB read failed" }, { status: 500 });
  const booking = (Array.isArray(r.data)) ? r.data[0] : null;
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (booking.stripe_subscription_id) {
    return NextResponse.json({ ok: true, alreadyCreated: true, subscriptionId: booking.stripe_subscription_id });
  }

  const tier = (body.tier || booking.tier || "starter").toLowerCase();
  const billing = ((body.billing || booking.billing_cadence || "monthly").toLowerCase()) as Billing;
  if (billing !== "monthly") {
    return NextResponse.json({ error: "Annual billing is invoiced 12x upfront — no recurring subscription needed." }, { status: 400 });
  }

  try {
    const customer = booking.stripe_customer_id
      ? { id: booking.stripe_customer_id }
      : await createOrFindCustomer({ email: booking.email!, name: booking.name, company: booking.company, bookingId });

    const sub = await createMonthlySubscription({
      customerId: customer.id, tier, billing, bookingId, trialEnd: body.trialEnd,
    }) as { id: string; status: string };

    await supabaseRest("PATCH", `/bookings?id=eq.${bookingId}`, {
      stripe_customer_id: customer.id,
      stripe_subscription_id: sub.id,
      subscription_started_at: new Date().toISOString(),
      payment_status: "subscription_active",
    });

    logAdminAction(req, {
      action: "subscription.create", target_table: "bookings", target_id: bookingId,
      payload: { tier, billing, subscriptionId: sub.id, status: sub.status },
      result_status: 200,
    }).catch(() => {});

    return NextResponse.json({ ok: true, subscriptionId: sub.id, status: sub.status });
  } catch (err) {
    const e = err as Error & { stripe?: unknown };
    console.error("admin-create-subscription failed:", e.message, e.stripe);
    logAdminAction(req, {
      action: "subscription.create", target_table: "bookings", target_id: bookingId,
      payload: { tier, billing, error: e.message },
      result_status: 500,
    }).catch(() => {});
    return NextResponse.json({ error: e.message, stripe: e.stripe || null }, { status: 500 });
  }
}
