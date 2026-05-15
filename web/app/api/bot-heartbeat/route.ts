import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ORGO_API_KEY = process.env.ORGO_API_KEY;
const ORGO_BASE_URL = "https://www.orgo.ai/api";

// Pre-Orgo this endpoint was called by a cloud-init script on the droplet to
// self-report its IP. With Orgo there's no in-VM phone-home — Orgo is the
// source of truth — so we check Orgo's API for the computer status and patch
// the client row. Auth remains api_server_key bearer so the existing callers
// (admin UI polling, in-bot heartbeats) keep working without admin creds.
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
  droplet_id: string | null;
  droplet_ip: string | null;
  hermes_url: string | null;
  novnc_url: string | null;
}

interface OrgoComputer {
  id: string;
  status?: string;
  url?: string | null;
  connection_url?: string | null;
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
  if (!ORGO_API_KEY) {
    return withCors(NextResponse.json({ error: "ORGO_API_KEY not configured" }, { status: 503 }));
  }

  const apiServerKey = bearerToken(req);
  if (!apiServerKey || !/^[a-f0-9]{16,128}$/i.test(apiServerKey)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?select=id,vps_status,droplet_id,droplet_ip,hermes_url,novnc_url&api_server_key=eq.${encodeURIComponent(apiServerKey)}`,
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
  if (!client.droplet_id) {
    return withCors(NextResponse.json({ error: "Client has no computer" }, { status: 409 }));
  }

  const orgoRes = await fetch(
    `${ORGO_BASE_URL}/computers/${encodeURIComponent(client.droplet_id)}`,
    { headers: { Authorization: `Bearer ${ORGO_API_KEY}` } },
  );
  if (!orgoRes.ok) {
    if (orgoRes.status === 404) {
      return withCors(NextResponse.json({ error: "Orgo computer not found", healthy: false }, { status: 404 }));
    }
    return withCors(NextResponse.json({ error: "Orgo lookup failed", healthy: false }, { status: 502 }));
  }
  const computer = (await orgoRes.json()) as OrgoComputer;
  const healthy = computer.status === "running" && Boolean(computer.url);

  const patch: Record<string, unknown> = {
    last_active_at: new Date().toISOString(),
  };
  if (healthy && client.vps_status === "provisioning") {
    patch.vps_status = "awaiting_oauth";
  }
  if (computer.url && computer.url !== client.hermes_url) {
    patch.droplet_ip = computer.url;
    patch.hermes_url = computer.url;
  }
  if (computer.connection_url && computer.connection_url !== client.novnc_url) {
    patch.novnc_url = computer.connection_url;
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

  return withCors(NextResponse.json({
    ok: true,
    healthy,
    status: computer.status ?? null,
    url: computer.url ?? null,
    connection_url: computer.connection_url ?? null,
  }));
}
