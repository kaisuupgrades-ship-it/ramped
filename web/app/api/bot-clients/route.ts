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
  api_server_key: string | null;
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

  const nowIso = new Date().toISOString();
  const codesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes?select=*&claimed_at=is.null&expires_at=gt.${encodeURIComponent(nowIso)}&order=created_at.desc`,
    { headers },
  );
  const codes: SetupCode[] = codesRes.ok ? ((await codesRes.json()) as SetupCode[]) : [];

  // Map first unclaimed code per client (already sorted desc → first = latest).
  const latestByClient = new Map<string, string>();
  for (const c of codes) {
    if (!latestByClient.has(c.client_id)) latestByClient.set(c.client_id, c.code);
  }

  const enriched = clients.map((c) => ({
    ...c,
    latest_code: latestByClient.get(c.id) ?? null,
  }));

  return NextResponse.json({ clients: enriched });
}
