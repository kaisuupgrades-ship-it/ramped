import { NextResponse, type NextRequest } from "next/server";
import { verifyStripeSignature } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe-webhook
 *
 * Verifies the Stripe-Signature header against STRIPE_WEBHOOK_SECRET, records
 * the event in the `stripe_events` table for idempotency, then patches the
 * matching `bookings` row based on event type.
 *
 * Stripe signature requires the raw request body — we read it as text and pass
 * the bytes through verifyStripeSignature without re-serializing.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET;

interface BookingMatch { id: string; email: string; name: string | null }

async function findBooking({ customerId, subscriptionId, bookingMetadataId }: {
  customerId: string | null;
  subscriptionId: string | null;
  bookingMetadataId: string | null;
}): Promise<BookingMatch | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  if (bookingMetadataId && /^[0-9a-f-]{36}$/i.test(bookingMetadataId)) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingMetadataId}&select=id,email,name`, { headers });
    if (r.ok) { const arr = await r.json(); if (arr[0]) return arr[0]; }
  }
  if (customerId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=id,email,name&order=created_at.desc&limit=1`, { headers });
    if (r.ok) { const arr = await r.json(); if (arr[0]) return arr[0]; }
  }
  if (subscriptionId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id,email,name&limit=1`, { headers });
    if (r.ok) { const arr = await r.json(); if (arr[0]) return arr[0]; }
  }
  return null;
}

async function patchBooking(id: string, patch: Record<string, unknown>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

async function recordEventOnce(eventId: string, type: string, payload: unknown): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/stripe_events`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ id: eventId, type, payload }),
  });
  // 201 created = fresh; 409 = already recorded (replay)
  return r.ok;
}

export async function POST(req: NextRequest) {
  if (!WHSEC) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not configured" }, { status: 503 });
  if (!SUPABASE_URL || !SUPABASE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!verifyStripeSignature({ rawBody, signatureHeader: sig, secret: WHSEC })) {
    console.warn("Stripe webhook signature mismatch");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { id: string; type: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const fresh = await recordEventOnce(event.id, event.type, event);
  if (!fresh) return NextResponse.json({ ok: true, replayed: true });

  const obj = (event.data?.object || {}) as Record<string, unknown>;
  const customerId = (obj.customer as string | null) || (obj.customer_id as string | null) || null;
  const objId = obj.id as string | undefined;
  const subId = objId?.startsWith("sub_") ? objId : ((obj.subscription as string | null) || null);
  const bookingMeta = ((obj.metadata as Record<string, string> | undefined)?.ramped_booking_id) || null;
  const booking = await findBooking({ customerId, subscriptionId: subId, bookingMetadataId: bookingMeta });

  switch (event.type) {
    case "invoice.paid":
    case "invoice.payment_succeeded": {
      if (booking) {
        await patchBooking(booking.id, {
          payment_status: "onboarding_paid",
          onboarding_paid_at: new Date().toISOString(),
        });
      }
      break;
    }
    case "invoice.payment_failed": {
      if (booking) await patchBooking(booking.id, { payment_status: "past_due" });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      if (booking) {
        const status = (obj.status as string) || "active";
        const map: Record<string, string> = {
          active: "subscription_active", past_due: "past_due", canceled: "cancelled",
          trialing: "subscription_active", incomplete: "unpaid",
        };
        const startDate = obj.start_date as number | undefined;
        await patchBooking(booking.id, {
          stripe_subscription_id: objId,
          payment_status: map[status] || "subscription_active",
          subscription_started_at: startDate ? new Date(startDate * 1000).toISOString() : new Date().toISOString(),
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      if (booking) {
        await patchBooking(booking.id, {
          payment_status: "cancelled",
          subscription_cancelled_at: new Date().toISOString(),
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
