import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { generateCloudInit, type ChannelConfig } from "@/lib/bot-cloud-init";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DO_API_TOKEN = process.env.DO_API_TOKEN;

interface BotClientRow {
  id: string;
  slug: string;
  droplet_id: string | null;
  api_server_key: string | null;
  vps_status: string | null;
  channel_config: ChannelConfig | null;
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  if (!DO_API_TOKEN) {
    return NextResponse.json({ error: "DO_API_TOKEN not configured" }, { status: 503 });
  }

  let body: { client_id?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  const clientRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}&select=id,slug,droplet_id,api_server_key,vps_status,channel_config`,
    { headers },
  );
  if (!clientRes.ok) return NextResponse.json({ error: "Failed to load client" }, { status: 500 });
  const rows = (await clientRes.json()) as BotClientRow[];
  const client = rows[0];
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (client.droplet_id) {
    return NextResponse.json({ error: "Client already has a droplet" }, { status: 400 });
  }
  if (!client.api_server_key) {
    return NextResponse.json({ error: "Client missing api_server_key" }, { status: 500 });
  }

  const userData = generateCloudInit(client.slug, client.api_server_key, client.channel_config ?? {});
  const doRes = await fetch("https://api.digitalocean.com/v2/droplets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DO_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `ramped-bot-${client.slug}`,
      region: "nyc3",
      size: "s-2vcpu-2gb",
      image: "ubuntu-22-04-x64",
      user_data: userData,
      tags: ["ramped-bot", `slug:${client.slug}`],
      monitoring: true,
      ipv6: false,
      backups: false,
    }),
  });
  if (!doRes.ok) {
    const text = await doRes.text().catch(() => "");
    return NextResponse.json(
      { error: `DigitalOcean ${doRes.status}: ${text.slice(0, 200)}` },
      { status: 502 },
    );
  }
  const doData = (await doRes.json()) as { droplet?: { id?: number } };
  const dropletId = doData.droplet?.id ?? null;
  if (!dropletId) {
    return NextResponse.json({ error: "DigitalOcean returned no droplet id" }, { status: 502 });
  }

  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ droplet_id: String(dropletId), vps_status: "provisioning" }),
    },
  );
  if (!patchRes.ok) {
    return NextResponse.json(
      { error: "Droplet created but failed to update client row", droplet_id: dropletId },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, droplet_id: dropletId });
}
