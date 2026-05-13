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

# 1. System deps — full set so the desktop Hermes installer has zero apt work
#    to do. Python 3.11 isn't in Ubuntu 22.04 main, so add deadsnakes first.
apt-get update -y
apt-get install -y software-properties-common ca-certificates gnupg ufw
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update -y
apt-get install -y \\
  ripgrep ffmpeg \\
  python3.11 python3.11-venv python3-pip \\
  git curl wget unzip build-essential

# 2. Node.js 20 via NodeSource (desktop app requires Node 20+).
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Create slug user with passwordless sudo so the Hermes installer never
#    gets blocked on a password prompt mid-run.
if ! id -u ${slug} >/dev/null 2>&1; then
  useradd -m -s /bin/bash ${slug}
fi
echo "${slug} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${slug}
chmod 440 /etc/sudoers.d/${slug}

# 4. uv (Python toolchain manager) installed system-wide so the Hermes
#    installer finds it on PATH regardless of which user invokes it.
curl -LsSf https://astral.sh/uv/install.sh | sh
mkdir -p /etc/profile.d
cat > /etc/profile.d/uv.sh <<'PROFILE'
export PATH="/root/.cargo/bin:/root/.local/bin:$PATH"
PROFILE
chmod 644 /etc/profile.d/uv.sh
# Make uv discoverable on the default PATH for non-login shells and the slug user.
if [ -f /root/.cargo/bin/uv ]; then cp /root/.cargo/bin/uv /usr/local/bin/uv; fi
if [ -f /root/.local/bin/uv ]; then cp /root/.local/bin/uv /usr/local/bin/uv; fi
if [ -f /root/.cargo/bin/uvx ]; then cp /root/.cargo/bin/uvx /usr/local/bin/uvx; fi
if [ -f /root/.local/bin/uvx ]; then cp /root/.local/bin/uvx /usr/local/bin/uvx; fi
chmod 755 /usr/local/bin/uv /usr/local/bin/uvx 2>/dev/null || true

# 5. Working dir + env
mkdir -p /opt/ramped-bot
cat > /opt/ramped-bot/.env <<EOF
SLUG=${slug}
API_SERVER_KEY=${apiServerKey}
RAMPED_API_URL=${apiUrl}
HERMES_PORT=8000
ONECLI_PORT=10255
EOF
chmod 600 /opt/ramped-bot/.env

# 6. Hermes Agent
# TODO: replace with real install once hermes-agent ships a release artifact.
mkdir -p /opt/ramped-bot/hermes

# 7. OneCLI (setup UI on :10255)
# TODO: replace with real install once OneCLI ships a release artifact.
mkdir -p /opt/ramped-bot/onecli

# Hand /opt/ramped-bot to the slug user so the installer can write into it.
chown -R ${slug}:${slug} /opt/ramped-bot

# 8. Firewall
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 10255/tcp
ufw --force enable

# 9. Detect public IP + phone home
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
