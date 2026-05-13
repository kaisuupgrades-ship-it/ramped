import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/booking-delete — soft-delete a booking. Admin-gated.
 *
 * Sets status='lost' and admin_notes='Archived' rather than dropping the row.
 * Audit log + email history stay intact; the CRM panel just stops showing the
 * row in any "open" filter.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const id = body.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const patch = { status: "lost", admin_notes: "Archived" };
  const r = await supabaseRest("PATCH", `/bookings?id=eq.${encodeURIComponent(id)}`, patch);
  if (!r.ok) {
    logAdminAction(req, {
      action: "booking.archive", target_table: "bookings", target_id: id,
      payload: patch, result_status: 500,
    }).catch(() => {});
    return NextResponse.json({ error: "Failed to archive booking" }, { status: 500 });
  }
  logAdminAction(req, {
    action: "booking.archive", target_table: "bookings", target_id: id,
    payload: patch, result_status: 200,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
