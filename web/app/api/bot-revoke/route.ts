import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DO_API_TOKEN = process.env.DO_API_TOKEN;

interface BotClient {
  id: string;
  droplet_id: string | null;
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { client_id?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}&select=id,droplet_id`,
    { headers },
  );
  if (!lookupRes.ok) return NextResponse.json({ error: "Failed to load client" }, { status: 500 });
  const clients = (await lookupRes.json()) as BotClient[];
  const client = Array.isArray(clients) ? clients[0] : null;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (client.droplet_id && DO_API_TOKEN) {
    const doRes = await fetch(
      `https://api.digitalocean.com/v2/droplets/${encodeURIComponent(client.droplet_id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${DO_API_TOKEN}` } },
    );
    // 204 = deleted, 404 = already gone. Anything else is a transient DO issue —
    // we still clear the DB so the operator isn't stuck, and surface the failure.
    if (doRes.status !== 204 && doRes.status !== 404) {
      console.error(`[bot-revoke] DO delete failed for droplet ${client.droplet_id}: ${doRes.status}`);
    }
  }

  const clientRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        vps_status: "pending",
        droplet_id: null,
        droplet_ip: null,
        hermes_url: null,
      }),
    },
  );
  if (!clientRes.ok) return NextResponse.json({ error: "Failed to revoke client" }, { status: 500 });

  const nowIso = new Date().toISOString();
  await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes?client_id=eq.${encodeURIComponent(clientId)}&claimed_at=is.null`,
    { method: "PATCH", headers, body: JSON.stringify({ expires_at: nowIso }) },
  );

  return NextResponse.json({ ok: true });
}
