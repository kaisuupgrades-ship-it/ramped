import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DO_API_TOKEN = process.env.DO_API_TOKEN;
const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";

interface BotClientRow {
  id: string;
  slug: string;
  droplet_id: string | null;
  api_server_key: string | null;
  vps_status: string | null;
}

// Mirrors bot-provision.generateCloudInit — kept in sync by hand. If you edit
// one, edit the other.
function generateCloudInit(slug: string, apiServerKey: string): string {
  const apiUrl = SITE_URL.replace(/\/$/, "");
  return `#!/bin/bash
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

# 1. System deps
apt-get update -y
apt-get install -y curl unzip ca-certificates gnupg ufw

# Node 20.x via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 2. Working dir + env
mkdir -p /opt/ramped-bot
cat > /opt/ramped-bot/.env <<EOF
SLUG=${slug}
API_SERVER_KEY=${apiServerKey}
RAMPED_API_URL=${apiUrl}
HERMES_PORT=8000
ONECLI_PORT=10255
EOF
chmod 600 /opt/ramped-bot/.env

# 3. Hermes Agent
# TODO: replace with real install once hermes-agent ships a release artifact.
mkdir -p /opt/ramped-bot/hermes

# 4. OneCLI (setup UI on :10255)
# TODO: replace with real install once OneCLI ships a release artifact.
mkdir -p /opt/ramped-bot/onecli

# 5. Firewall
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 10255/tcp
ufw --force enable

# 6. Detect public IP + phone home
PUBLIC_IP=$(curl -fsSL https://ipv4.icanhazip.com || curl -fsSL https://api.ipify.org || echo "")
curl -fsSL -X POST "${apiUrl}/api/bot-heartbeat" \\
  -H "Authorization: Bearer ${apiServerKey}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"slug\\":\\"${slug}\\",\\"ip\\":\\"$PUBLIC_IP\\",\\"status\\":\\"awaiting_oauth\\"}" \\
  || true
`;
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
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}&select=id,slug,droplet_id,api_server_key,vps_status`,
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

  const userData = generateCloudInit(client.slug, client.api_server_key);
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
