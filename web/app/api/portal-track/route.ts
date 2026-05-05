import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { checkPortalToken } from "@/lib/portal-auth";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/portal-track?id&exp&t  body: { event, path?, metadata? }
 *
 * Beacon endpoint — inserts a portal_events row + bumps the booking's
 * portal_last_seen_at and portal_visit_count. Best-effort; returns 204 even on
 * partial failure. IPs are SHA-256-hashed before storage.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const IP_SALT = process.env.IP_HASH_SALT || "ramped-default-salt-rotate-me";

const ALLOWED_EVENTS = new Set([
  "view", "click_roadmap", "click_meet", "click_team_email",
  "submit_ticket", "view_ticket", "click_quick_link",
]);

function ipHash(ip: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(`${ip}:${IP_SALT}`).digest("hex").slice(0, 16);
}

function uaHint(ua: string | null): string | null {
  if (!ua) return null;
  if (/iPhone|iPad|iPod/i.test(ua)) return /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua) ? "iOS Safari" : "iOS browser";
  if (/Android/i.test(ua)) return /Chrome/i.test(ua) ? "Android Chrome" : "Android browser";
  if (/Macintosh.*Safari/i.test(ua) && !/Chrome/i.test(ua)) return "macOS Safari";
  if (/Chrome/i.test(ua)) return "Chrome desktop";
  if (/Firefox/i.test(ua)) return "Firefox desktop";
  return "Other";
}

export async function POST(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  let body: { event?: string; path?: string; metadata?: unknown };
  try { body = await req.json(); } catch { body = {}; }

  const event = body.event && ALLOWED_EVENTS.has(body.event) ? body.event : "view";
  const path = typeof body.path === "string" ? body.path.slice(0, 200) : null;
  const metadata = (body.metadata && typeof body.metadata === "object") ? body.metadata : {};

  const xff = req.headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0].trim() : null) || req.headers.get("x-real-ip");
  const ua = req.headers.get("user-agent");

  // Insert event row (best-effort)
  if (SUPABASE_URL && SUPABASE_KEY) {
    fetch(`${SUPABASE_URL}/rest/v1/portal_events`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({ booking_id: id, event, path, ip_hash: ipHash(ip), ua_hint: uaHint(ua), metadata }),
    }).catch((err) => console.warn("portal_events insert failed:", (err as Error).message));

    // Bump portal_visit_count + last_seen_at (read then PATCH; race acceptable)
    try {
      const cur = await supabaseRest<{ portal_visit_count: number | null }[]>("GET",
        `/bookings?id=eq.${encodeURIComponent(id)}&select=portal_visit_count`);
      const current = (cur.ok && Array.isArray(cur.data)) ? cur.data[0] : null;
      const next = (current?.portal_visit_count || 0) + 1;
      supabaseRest("PATCH", `/bookings?id=eq.${encodeURIComponent(id)}`, {
        portal_last_seen_at: new Date().toISOString(),
        portal_visit_count: next,
      }).catch((err) => console.warn("bookings last_seen PATCH failed:", err));
    } catch (err) {
      console.warn("portal-track update failed:", (err as Error).message);
    }
  }

  return new NextResponse(null, { status: 204 });
}
