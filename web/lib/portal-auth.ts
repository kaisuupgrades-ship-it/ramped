import { NextResponse, type NextRequest } from "next/server";
import { verifyMapToken, isMapTokenConfigured } from "./map-token";

/**
 * Portal route guard. Validates the URL params (?id=&exp=&t=) on every
 * /api/portal-* route. Returns either { ok: true, id } to continue, or a
 * NextResponse to short-circuit with 400/403/503.
 *
 * Pattern keeps each portal route's auth boilerplate down to a single line.
 */
export function checkPortalToken(req: NextRequest): { ok: true; id: string } | { ok: false; res: NextResponse } {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const exp = searchParams.get("exp");
  const t = searchParams.get("t");

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, res: NextResponse.json({ error: "Invalid ID" }, { status: 400 }) };
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return { ok: false, res: NextResponse.json({ error: "DB not configured" }, { status: 503 }) };
  }
  if (!isMapTokenConfigured()) {
    return { ok: false, res: NextResponse.json({ error: "Token signing not configured" }, { status: 503 }) };
  }
  if (!exp || !t || !verifyMapToken(id, exp, t)) {
    return { ok: false, res: NextResponse.json({ error: "Invalid or expired token" }, { status: 403 }) };
  }
  return { ok: true, id };
}
