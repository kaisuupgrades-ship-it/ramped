import { NextResponse, type NextRequest } from "next/server";
import { verifyMapToken, isMapTokenConfigured } from "@/lib/map-token";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/get-roadmap?id=<uuid>&exp=<unix>&t=<hmac>
 *
 * Public roadmap viewer — HMAC-signed expiring token required. Returns ONLY
 * client-safe fields (no grade, no email, no admin notes, no tier).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const exp = searchParams.get("exp");
  const t = searchParams.get("t");

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (!isMapTokenConfigured()) {
    return NextResponse.json({ error: "Roadmap link signing not configured" }, { status: 503 });
  }
  if (!exp || !t || !verifyMapToken(id, exp, t)) {
    return NextResponse.json({ error: "This link is invalid or has expired. Please request a new one." }, { status: 403 });
  }

  const r = await supabaseRest<Array<{
    id: string; name: string | null; company: string | null;
    datetime: string | null; automation_map: unknown;
    questionnaire?: { industry?: string };
  }>>("GET", `/bookings?id=eq.${encodeURIComponent(id)}&select=id,name,company,datetime,automation_map,questionnaire`);
  if (!r.ok) return NextResponse.json({ error: "Database error" }, { status: 500 });
  const b = Array.isArray(r.data) ? r.data[0] : null;
  if (!b) return NextResponse.json({ error: "Roadmap not found" }, { status: 404 });
  if (!b.automation_map) return NextResponse.json({ error: "Roadmap not yet generated for this booking" }, { status: 404 });

  return NextResponse.json({
    id: b.id,
    name: b.name,
    company: b.company,
    industry: b.questionnaire?.industry || null,
    datetime: b.datetime,
    roadmap: b.automation_map,
  });
}
