import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin-update — patch a booking row.
 *
 * Body: { id, status?, admin_notes?, name?, email?, company?, datetime?, notes?,
 *         tier?, timezone?, meet_link?, gcal_event_id? }
 *
 * Whitelisted fields only. Empty string for optional fields → null.
 */

const VALID_STATUSES = new Set(["new", "discovery", "proposal", "negotiation", "won", "lost", "post_won", "no_show"]);
const VALID_TIERS = new Set(["starter", "growth", "enterprise", ""]);
const EDITABLE_FIELDS = ["status", "admin_notes", "name", "email", "company", "datetime", "notes", "tier", "timezone", "meet_link", "gcal_event_id"];

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const id = body.id;
  if (!id || typeof id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) patch[field] = body[field];
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });

  if (patch.status !== undefined && !VALID_STATUSES.has(patch.status as string)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
  }
  if (patch.tier !== undefined && patch.tier !== null && !VALID_TIERS.has(patch.tier as string)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  for (const f of ["company", "notes", "tier", "timezone", "admin_notes"]) {
    if (patch[f] === "") patch[f] = null;
  }

  const r = await supabaseRest("PATCH", `/bookings?id=eq.${encodeURIComponent(id)}`, patch);
  if (!r.ok) {
    logAdminAction(req, { action: "booking.update", target_table: "bookings", target_id: id, payload: patch, result_status: 500 }).catch(() => {});
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
  logAdminAction(req, { action: "booking.update", target_table: "bookings", target_id: id, payload: patch, result_status: 200 }).catch(() => {});
  return NextResponse.json({ success: true });
}
