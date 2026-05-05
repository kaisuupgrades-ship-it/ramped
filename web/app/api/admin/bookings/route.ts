import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { signMapToken, isMapTokenConfigured } from "@/lib/map-token";
import { computePhase, type PhaseInfo } from "@/lib/phase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/bookings — bearer-token-gated. Returns bookings + leads + maps,
 * each booking enriched with computed phase + signed portal URL.
 *
 * Server-side mints portal tokens so MAP_LINK_SECRET never reaches the
 * frontend. Same shape as legacy /api/admin (api/admin.js).
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";

interface BookingRow extends Record<string, unknown> {
  id: string;
  datetime: string | null;
}

async function supabaseGet<T>(path: string): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? r.json() : [];
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ configured: false, bookings: [], leads: [], maps: [] });
  }

  const [bookingsRaw, leads, maps] = await Promise.all([
    supabaseGet<BookingRow>("/bookings?select=*&order=datetime.desc&limit=200"),
    supabaseGet<unknown>("/leads?select=*&order=created_at.desc&limit=200"),
    supabaseGet<unknown>("/automation_maps?select=*&order=created_at.desc&limit=200"),
  ]);

  const tokensConfigured = isMapTokenConfigured();
  const bookings = bookingsRaw.map((b) => {
    const phase: PhaseInfo = computePhase(b.datetime);
    let portal_url: string | null = null;
    if (tokensConfigured && b.id) {
      try {
        const { exp, t } = signMapToken(b.id, 60 * 60 * 24 * 90);
        portal_url = `${SITE_URL}/portal?id=${b.id}&exp=${exp}&t=${encodeURIComponent(t)}`;
      } catch { /* MAP_LINK_SECRET missing — leave null */ }
    }
    return {
      ...b,
      phase: phase.phase,
      phase_eyebrow: phase.eyebrow,
      phase_step: phase.step,
      day_of_thirty: phase.dayOfThirty,
      portal_url,
    };
  });

  return NextResponse.json({
    configured: true,
    portal_links_enabled: tokensConfigured,
    bookings,
    leads,
    maps,
  });
}
