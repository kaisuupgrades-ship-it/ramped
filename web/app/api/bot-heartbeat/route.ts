import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Called by the cloud-init script on a freshly provisioned droplet — no normal
// browser Origin. Auth is the api_server_key bearer, not admin.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface BotClientRow {
  id: string;
  vps_status: string | null;
  droplet_ip: string | null;
}

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

function bearerToken(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return withCors(NextResponse.json({ error: "Database not configured" }, { status: 503 }));
  }

  const apiServerKey = bearerToken(req);
  if (!apiServerKey || !/^[a-f0-9]{16,128}$/i.test(apiServerKey)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  let body: { ip?: unknown; slug?: unknown; status?: unknown } = {};
  try { body = await req.json(); } catch { /* body is optional */ }

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?select=id,vps_status,droplet_ip&api_server_key=eq.${encodeURIComponent(apiServerKey)}`,
    { headers },
  );
  if (!lookupRes.ok) {
    return withCors(NextResponse.json({ error: "Lookup failed" }, { status: 500 }));
  }
  const rows = (await lookupRes.json()) as BotClientRow[];
  const client = rows[0];
  if (!client) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  if (client.vps_status !== "provisioning" && client.vps_status !== "awaiting_oauth") {
    return withCors(NextResponse.json({ error: "Invalid status for heartbeat" }, { status: 409 }));
  }

  // Prefer the IP the droplet self-reports (icanhazip in cloud-init); fall back
  // to the request's edge IP. Skip if neither yields anything new.
  const bodyIp = typeof body.ip === "string" && body.ip.trim() ? body.ip.trim().slice(0, 64) : null;
  const ip = bodyIp ?? clientIp(req);

  const patch: Record<string, unknown> = {
    vps_status: "awaiting_oauth",
    last_active_at: new Date().toISOString(),
  };
  if (ip && ip !== client.droplet_ip) {
    patch.droplet_ip = ip;
    patch.hermes_url = `http://${ip}:10255`;
    patch.novnc_url = `http://${ip}:6080/vnc.html`;
  }

  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(client.id)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    },
  );
  if (!patchRes.ok) {
    return withCors(NextResponse.json({ error: "Failed to update client" }, { status: 500 }));
  }

  return withCors(NextResponse.json({ ok: true }));
}
