import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin-delete  body: { id }
 * Hard-delete a booking row. Mirrored audit log.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const r = await supabaseRest("DELETE", `/bookings?id=eq.${encodeURIComponent(body.id)}`);
  if (!r.ok) {
    logAdminAction(req, { action: "booking.delete", target_table: "bookings", target_id: body.id, result_status: 500 }).catch(() => {});
    return NextResponse.json({ error: "Failed to delete booking" }, { status: 500 });
  }
  logAdminAction(req, { action: "booking.delete", target_table: "bookings", target_id: body.id, result_status: 200 }).catch(() => {});
  return NextResponse.json({ success: true });
}
