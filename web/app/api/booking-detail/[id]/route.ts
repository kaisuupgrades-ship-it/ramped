import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/booking-detail/[id] — full record for the CRM client-detail panel.
 *
 * Returns the booking, any linked Ramped Bot client, and the latest unclaimed
 * setup code for that client (if any). Admin-gated.
 */

interface Booking { id: string; [k: string]: unknown }
interface BotClient {
  id: string;
  booking_id: string | null;
  name: string;
  slug: string;
  droplet_id: string | null;
  droplet_ip: string | null;
  vps_status: string | null;
  hermes_url: string | null;
  novnc_url: string | null;
  api_server_key: string | null;
  email: string | null;
  created_at: string | null;
  last_active_at: string | null;
  notes: string | null;
}
interface SetupCode { code: string; expires_at: string; claimed_at: string | null }

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const bookingRes = await supabaseRest<Booking[]>(
    "GET",
    `/bookings?id=eq.${encodeURIComponent(id)}&select=*`,
  );
  if (!bookingRes.ok || !Array.isArray(bookingRes.data) || !bookingRes.data[0]) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  const booking = bookingRes.data[0];

  const botRes = await supabaseRest<BotClient[]>(
    "GET",
    `/ramped_bot_clients?booking_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc&limit=1`,
  );
  const bot_client = (botRes.ok && Array.isArray(botRes.data) && botRes.data[0]) ? botRes.data[0] : null;

  let latest_code: string | null = null;
  if (bot_client) {
    const nowIso = new Date().toISOString();
    const codeRes = await supabaseRest<SetupCode[]>(
      "GET",
      `/ramped_bot_setup_codes?client_id=eq.${encodeURIComponent(bot_client.id)}&claimed_at=is.null&expires_at=gt.${encodeURIComponent(nowIso)}&select=code,expires_at,claimed_at&order=created_at.desc&limit=1`,
    );
    if (codeRes.ok && Array.isArray(codeRes.data) && codeRes.data[0]) {
      latest_code = codeRes.data[0].code;
    }
  }

  return NextResponse.json({ booking, bot_client, latest_code });
}
