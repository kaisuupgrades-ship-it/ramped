import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ORGO_API_KEY = process.env.ORGO_API_KEY;
const ORGO_BASE_URL = "https://www.orgo.ai/api";

// Mirrors bot-heartbeat's Orgo logic, but auth'd via admin bearer + client_id
// query param (admin UI "Check Status" button). DigitalOcean was retired —
// droplet_id now holds an Orgo computer ID like "pablo-estates-r24788", so
// the old api.digitalocean.com call returned 404.
interface BotClientRow {
  id: string;
  slug: string;
  droplet_id: string | null;
  droplet_ip: string | null;
  vps_status: string | null;
  hermes_url: string | null;
  novnc_url: string | null;
}

interface OrgoComputer {
  id: string;
  status?: string;
  url?: string | null;
  connection_url?: string | null;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  if (!ORGO_API_KEY) {
    return NextResponse.json({ error: "ORGO_API_KEY not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  const clientRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}&select=id,slug,droplet_id,droplet_ip,vps_status,hermes_url,novnc_url`,
    { headers: sbHeaders },
  );
  if (!clientRes.ok) {
    const text = await clientRes.text().catch(() => "");
    console.error(`[bot-poll-droplet] SELECT failed ${clientRes.status}: ${text.slice(0, 500)}`);
    return NextResponse.json(
      { error: `Failed to load client (Supabase ${clientRes.status}): ${text.slice(0, 200)}` },
      { status: 500 },
    );
  }
  const rows = (await clientRes.json()) as BotClientRow[];
  const client = rows[0];
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (!client.droplet_id) {
    return NextResponse.json({
      status: client.vps_status,
      ip: client.droplet_ip,
      hermes_url: client.hermes_url,
      novnc_url: client.novnc_url,
      message: "No droplet_id on record",
    });
  }

  const orgoRes = await fetch(
    `${ORGO_BASE_URL}/computers/${encodeURIComponent(client.droplet_id)}`,
    { headers: { Authorization: `Bearer ${ORGO_API_KEY}` } },
  );
  if (!orgoRes.ok) {
    const text = await orgoRes.text().catch(() => "");
    const status = orgoRes.status === 404 ? 404 : 502;
    return NextResponse.json(
      { error: `Orgo ${orgoRes.status}: ${text.slice(0, 200)}`, healthy: false },
      { status },
    );
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
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      headers: { ...sbHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!patchRes.ok) {
    const text = await patchRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Failed to update client: ${text.slice(0, 200)}` },
      { status: 500 },
    );
  }

  const nextHermesUrl = (patch.hermes_url as string | undefined) ?? client.hermes_url;
  const nextNovncUrl = (patch.novnc_url as string | undefined) ?? client.novnc_url;
  const nextVpsStatus = (patch.vps_status as string | undefined) ?? client.vps_status;

  return NextResponse.json({
    ok: true,
    healthy,
    status: computer.status ?? null,
    ip: nextHermesUrl,
    hermes_url: nextHermesUrl,
    novnc_url: nextNovncUrl,
    vps_status: nextVpsStatus,
  });
}
