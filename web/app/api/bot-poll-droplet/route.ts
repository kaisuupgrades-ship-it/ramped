import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DO_API_TOKEN = process.env.DO_API_TOKEN;

interface BotClientRow {
  id: string;
  slug: string;
  droplet_id: string | null;
  droplet_ip: string | null;
  vps_status: string | null;
  hermes_url: string | null;
}

interface DODroplet {
  id: number;
  status: string;
  networks?: {
    v4?: Array<{ ip_address: string; type: string }>;
  };
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  if (!DO_API_TOKEN) {
    return NextResponse.json({ error: "DO_API_TOKEN not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  const clientRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}&select=id,slug,droplet_id,droplet_ip,vps_status,hermes_url`,
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
      message: "No droplet_id on record",
    });
  }

  const doRes = await fetch(
    `https://api.digitalocean.com/v2/droplets/${encodeURIComponent(client.droplet_id)}`,
    { headers: { Authorization: `Bearer ${DO_API_TOKEN}` } },
  );
  if (!doRes.ok) {
    const text = await doRes.text().catch(() => "");
    return NextResponse.json(
      { error: `DigitalOcean ${doRes.status}: ${text.slice(0, 200)}` },
      { status: 502 },
    );
  }
  const { droplet } = (await doRes.json()) as { droplet: DODroplet };

  const publicIp = droplet.networks?.v4?.find((n) => n.type === "public")?.ip_address ?? null;

  if (publicIp && publicIp !== client.droplet_ip) {
    const hermesUrl = `http://${publicIp}:10255`;
    const patchHeaders = {
      ...sbHeaders,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}`,
      {
        method: "PATCH",
        headers: patchHeaders,
        body: JSON.stringify({ droplet_ip: publicIp, hermes_url: hermesUrl }),
      },
    );
    if (!patchRes.ok) {
      const text = await patchRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Failed to update client: ${text.slice(0, 200)}` },
        { status: 500 },
      );
    }
    return NextResponse.json({
      status: droplet.status,
      ip: publicIp,
      hermes_url: hermesUrl,
      vps_status: client.vps_status,
    });
  }

  return NextResponse.json({
    status: droplet.status,
    ip: publicIp ?? client.droplet_ip,
    hermes_url: client.hermes_url,
    vps_status: client.vps_status,
  });
}
