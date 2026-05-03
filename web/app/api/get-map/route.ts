import { NextResponse, type NextRequest } from "next/server";
import { verifyMapToken, isMapTokenConfigured } from "@/lib/map-token";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/get-map?id=<uuid>&exp=<unix>&t=<hmac>
 *
 * Public automation-map viewer — same HMAC-signed expiring token gate as
 * /api/get-roadmap. Fail-closed if MAP_LINK_SECRET isn't set (returns 503).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const exp = searchParams.get("exp");
  const t = searchParams.get("t");

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!isMapTokenConfigured()) return NextResponse.json({ error: "Map link signing not configured" }, { status: 503 });
  if (!exp || !t || !verifyMapToken(id, exp, t)) {
    return NextResponse.json({ error: "This link is invalid or has expired. Please request a new one." }, { status: 403 });
  }

  const r = await supabaseRest<unknown[]>("GET", `/automation_maps?id=eq.${encodeURIComponent(id)}&select=id,created_at,company,name,industry,map_data,status`);
  if (!r.ok) return NextResponse.json({ error: "Database error" }, { status: 500 });
  const data = Array.isArray(r.data) ? r.data[0] : null;
  if (!data) return NextResponse.json({ error: "Map not found" }, { status: 404 });
  return NextResponse.json(data);
}
