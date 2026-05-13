import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DO_API_TOKEN = process.env.DO_API_TOKEN;
const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";

const BASE32_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateSetupCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += BASE32_CHARSET[bytes[i] % BASE32_CHARSET.length];
  }
  return out;
}

// Cloud-init bash script that runs once on first boot of a fresh droplet.
// Installs deps, pulls Hermes Agent + OneCLI, opens ports, then calls home.
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
# Expected layout: /opt/ramped-bot/hermes/ with a systemd unit listening on :8000.
mkdir -p /opt/ramped-bot/hermes
# curl -fsSL https://github.com/<org>/hermes-agent/releases/latest/download/hermes-agent-linux-x64.tar.gz \\
#   | tar -xz -C /opt/ramped-bot/hermes

# 7. OneCLI (setup UI on :10255)
# TODO: replace with real install once OneCLI ships a release artifact.
mkdir -p /opt/ramped-bot/onecli
# curl -fsSL https://github.com/<org>/onecli/releases/latest/download/onecli-linux-x64.tar.gz \\
#   | tar -xz -C /opt/ramped-bot/onecli

# Hand /opt/ramped-bot to the slug user so the installer can write into it.
chown -R ${slug}:${slug} /opt/ramped-bot

# 8. Firewall — SSH, HTTP (LE challenge), OneCLI. Hermes :8000 stays loopback
#    until OneCLI binds it behind a reverse proxy.
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

  let body: { name?: unknown; slug?: unknown; booking_id?: unknown; email?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase alphanumeric with hyphens" }, { status: 400 });
  }

  const bookingId = typeof body.booking_id === "string" && /^[0-9a-f-]{36}$/i.test(body.booking_id)
    ? body.booking_id
    : null;
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().slice(0, 320) : null;

  const apiServerKey = randomBytes(32).toString("hex");
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  // Initial status: "provisioning" if we'll spin up a droplet, else "pending"
  // so the admin knows to provision manually (or fix DO_API_TOKEN).
  const initialStatus = DO_API_TOKEN ? "provisioning" : "pending";
  const payload: Record<string, unknown> = {
    name,
    slug,
    vps_status: initialStatus,
    api_server_key: apiServerKey,
  };
  if (bookingId) payload.booking_id = bookingId;
  if (email) payload.email = email;

  const clientRes = await fetch(`${SUPABASE_URL}/rest/v1/ramped_bot_clients`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!clientRes.ok) {
    const text = await clientRes.text();
    const conflict = clientRes.status === 409 || /duplicate|unique/i.test(text);
    return NextResponse.json(
      { error: conflict ? "Slug already exists" : "Failed to create client" },
      { status: conflict ? 409 : 500 },
    );
  }
  const clientRows = (await clientRes.json()) as Array<Record<string, unknown>>;
  const client = clientRows[0];

  const code = generateSetupCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const codeRes = await fetch(`${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ client_id: client.id, code, expires_at: expiresAt }),
  });
  if (!codeRes.ok) {
    return NextResponse.json({ error: "Failed to create setup code" }, { status: 500 });
  }

  // Best-effort DO droplet creation. If it fails, the client record stays
  // (status "provisioning") so the admin can retry — failing the whole request
  // would orphan the setup code we just minted.
  let dropletId: number | null = null;
  let provisionError: string | null = null;
  if (DO_API_TOKEN) {
    try {
      const userData = generateCloudInit(slug, apiServerKey);
      const doRes = await fetch("https://api.digitalocean.com/v2/droplets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DO_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `ramped-bot-${slug}`,
          region: "nyc3",
          size: "s-2vcpu-2gb",
          image: "ubuntu-22-04-x64",
          user_data: userData,
          tags: ["ramped-bot", `slug:${slug}`],
          monitoring: true,
          ipv6: false,
          backups: false,
        }),
      });
      if (doRes.ok) {
        const doData = (await doRes.json()) as { droplet?: { id?: number } };
        dropletId = doData.droplet?.id ?? null;
      } else {
        const text = await doRes.text().catch(() => "");
        provisionError = `DigitalOcean ${doRes.status}: ${text.slice(0, 200)}`;
      }
    } catch (err) {
      provisionError = err instanceof Error ? err.message : "DigitalOcean call failed";
    }

    if (dropletId) {
      // Patch the client with the droplet_id so the admin panel can poll.
      // droplet_id column is TEXT (see migrations/011), so we stringify.
      await fetch(
        `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(client.id as string)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ droplet_id: String(dropletId) }),
        },
      ).catch(() => undefined);
      (client as Record<string, unknown>).droplet_id = String(dropletId);
    }
  } else {
    provisionError = "DO_API_TOKEN not set — droplet not created";
  }

  return NextResponse.json({ client, code, droplet_id: dropletId, provision_error: provisionError });
}
