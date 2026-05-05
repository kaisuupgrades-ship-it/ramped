import { NextResponse, type NextRequest } from "next/server";
import { checkPortalToken } from "@/lib/portal-auth";
import { supabaseRest } from "@/lib/supabase";
import { notifyOnboardingCompleted } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/portal-onboarding?id&exp&t  → returns onboarding_data + uploaded docs
 * POST /api/portal-onboarding?id&exp&t  → save onboarding fields (and optionally mark complete)
 */

const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";
const FIELD_MAX = 4000;
const ALLOWED_FIELDS = ["brand_voice_notes", "forbidden_phrases", "escalation_triggers", "signoff_style", "integrations_notes", "sample_email_link"] as const;

interface BookingOnboarding {
  onboarding_data: Record<string, string> | null;
  onboarding_completed_at: string | null;
  payment_status: string | null;
  name: string | null;
  email: string | null;
}

export async function GET(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  const r = await supabaseRest<BookingOnboarding[]>("GET",
    `/bookings?id=eq.${encodeURIComponent(id)}&select=onboarding_data,onboarding_completed_at,payment_status,name,email`);
  const b = (r.ok && Array.isArray(r.data)) ? r.data[0] : null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const dr = await supabaseRest<unknown[]>("GET",
    `/onboarding_documents?booking_id=eq.${encodeURIComponent(id)}&select=id,category,filename,size_bytes,mime,uploaded_at&order=uploaded_at.desc`);
  const docs = (dr.ok && Array.isArray(dr.data)) ? dr.data : [];

  return NextResponse.json({
    onboarding_data: b.onboarding_data || {},
    onboarding_completed_at: b.onboarding_completed_at,
    payment_status: b.payment_status,
    documents: docs,
  });
}

export async function POST(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const data: Record<string, string> = {};
  for (const k of ALLOWED_FIELDS) {
    const v = body[k];
    if (typeof v === "string") data[k] = v.slice(0, FIELD_MAX);
  }
  const complete = !!body.complete;
  const patch: Record<string, unknown> = { onboarding_data: data };
  if (complete) patch.onboarding_completed_at = new Date().toISOString();

  const r = await supabaseRest<BookingOnboarding[]>("PATCH",
    `/bookings?id=eq.${encodeURIComponent(id)}`, patch);
  if (!r.ok) return NextResponse.json({ error: "DB write failed" }, { status: 500 });

  if (complete) {
    const updated = Array.isArray(r.data) ? r.data[0] : null;
    notifyOnboardingCompleted({
      name: updated?.name, email: updated?.email || "",
      bookingId: id, siteUrl: SITE_URL,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, complete });
}
