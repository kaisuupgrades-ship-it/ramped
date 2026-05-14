import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

interface BotClient {
  id: string;
  name: string;
  slug: string;
  droplet_id: string | null;
  droplet_ip: string | null;
  vps_status: string | null;
  hermes_url: string | null;
  novnc_url: string | null;
  api_server_key: string | null;
  email: string | null;
  booking_id: string | null;
  created_at: string | null;
  last_active_at: string | null;
  notes: string | null;
}

interface SetupCode {
  id: string;
  client_id: string;
  code: string;
  created_at: string | null;
  expires_at: string;
  claimed_at: string | null;
  claimed_by_ip: string | null;
}

interface BookingLite { id: string; name: string | null; email: string | null; company: string | null }

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  const clientsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?select=*&order=created_at.desc`,
    { headers },
  );
  if (!clientsRes.ok) {
    return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
  }
  const clients = (await clientsRes.json()) as BotClient[];

  // Fetch all bookings referenced by the clients in one round-trip, then merge.
  // Cheaper than PostgREST embeds when only a handful of fields are needed and
  // avoids the FK-detection edge case if the constraint hasn't been picked up
  // yet by the schema cache.
  const bookingIds = Array.from(new Set(clients.map((c) => c.booking_id).filter(Boolean) as string[]));
  let bookingsById = new Map<string, BookingLite>();
  if (bookingIds.length > 0) {
    const inList = bookingIds.map((id) => `"${id}"`).join(",");
    const bRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=in.(${encodeURIComponent(inList)})&select=id,name,email,company`,
      { headers },
    );
    if (bRes.ok) {
      const rows = (await bRes.json()) as BookingLite[];
      bookingsById = new Map(rows.map((b) => [b.id, b]));
    }
  }

  const nowIso = new Date().toISOString();
  const codesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes?select=*&claimed_at=is.null&expires_at=gt.${encodeURIComponent(nowIso)}&order=created_at.desc`,
    { headers },
  );
  const codes: SetupCode[] = codesRes.ok ? ((await codesRes.json()) as SetupCode[]) : [];

  const latestByClient = new Map<string, string>();
  for (const c of codes) {
    if (!latestByClient.has(c.client_id)) latestByClient.set(c.client_id, c.code);
  }

  const enriched = clients.map((c) => {
    const b = c.booking_id ? bookingsById.get(c.booking_id) : null;
    return {
      ...c,
      latest_code: latestByClient.get(c.id) ?? null,
      booking_name: b?.name ?? null,
      booking_email: b?.email ?? null,
      booking_company: b?.company ?? null,
    };
  });

  return NextResponse.json({ clients: enriched });
}
