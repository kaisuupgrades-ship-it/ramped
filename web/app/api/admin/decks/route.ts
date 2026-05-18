/**
 * GET  /api/admin/decks  → list of bookings with their latest deck status
 * POST /api/admin/decks  → body { booking_id } → regenerate the deck for that booking
 *
 * Admin-only (Bearer ADMIN_TOKEN). Powers the new Prospect Decks panel
 * in /admin.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { supabaseRest } from "@/lib/supabase";
import { generateDeckForBooking } from "@/lib/deck/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // deck generation can take ~30-90s

interface BookingRow {
  id: string;
  datetime: string;
  name: string;
  email: string;
  company: string;
  company_url: string | null;
  status: string | null;
}

interface DeckRow {
  id: string;
  booking_id: string;
  status: string;
  company_url: string | null;
  company_url_source: string | null;
  research_confidence: string | null;
  deck_storage_path: string | null;
  deck_filename: string | null;
  template_version: string | null;
  error_message: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bookings in the last 60 days OR upcoming
  const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString();
  const { ok: okB, data: bookings } = await supabaseRest<BookingRow[]>(
    "GET",
    `/bookings?or=(datetime.gte.${encodeURIComponent(cutoff)})&select=id,datetime,name,email,company,company_url,status&order=datetime.desc&limit=200`,
  );
  if (!okB || !bookings) return NextResponse.json({ error: "Failed to load bookings" }, { status: 500 });

  // All decks for those bookings (we want latest per booking — fetch all then group)
  const ids = bookings.map(b => b.id);
  let decks: DeckRow[] = [];
  if (ids.length > 0) {
    const inList = `(${ids.map(i => `"${i}"`).join(",")})`;
    const { ok: okD, data } = await supabaseRest<DeckRow[]>(
      "GET",
      `/prospect_decks?booking_id=in.${encodeURIComponent(inList)}&select=*&order=created_at.desc&limit=500`,
    );
    if (okD && data) decks = data;
  }

  // Group: latest deck per booking
  const latestByBooking = new Map<string, DeckRow>();
  for (const d of decks) {
    if (!latestByBooking.has(d.booking_id)) latestByBooking.set(d.booking_id, d);
  }

  const rows = bookings.map(b => ({
    booking: b,
    deck: latestByBooking.get(b.id) || null,
  }));

  return NextResponse.json({ rows }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { booking_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.booking_id) {
    return NextResponse.json({ error: "booking_id required" }, { status: 400 });
  }
  const result = await generateDeckForBooking(body.booking_id);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
