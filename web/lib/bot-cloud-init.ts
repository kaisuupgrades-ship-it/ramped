/**
 * Cloud-init bash builder for Ramped Bot droplets.
 *
 * Used by /api/bot-provision and /api/bot-reprovision. Centralised here so
 * both routes stay in lockstep — previously the function was duplicated and
 * had to be hand-mirrored.
 *
 * The script:
 *   - installs OS deps + Node 20 + uv
 *   - creates a slug user with passwordless sudo
 *   - writes the control-plane env to /opt/ramped-bot/.env
 *   - writes the Hermes channel env to /home/<slug>/.hermes/.env (if any
 *     channel is enabled)
 *   - writes /home/<slug>/.hermes/config.yaml (if Slack is enabled)
 *   - installs `hermes gateway` as a system service (if any messaging channel
 *     is enabled — Slack, Discord, or Email)
 *   - opens the firewall and phones home with status
 */

const SITE_URL_DEFAULT = "https://www.30dayramp.com";

export interface ChannelConfig {
  slack?: {
    enabled?: boolean;
    bot_token?: string;
    app_token?: string;
    allowed_users?: string;
    home_channel?: string;
  };
  discord?: {
    enabled?: boolean;
    token?: string;
  };
  email?: {
    enabled?: boolean;
    imap_host?: string;
    smtp_host?: string;
    port?: string | number;
    username?: string;
    password?: string;
  };
  ai?: {
    enabled?: boolean;
    provider?: "anthropic" | "openai" | "openrouter" | string;
    api_key?: string;
    model?: string;
  };
  web_search?: {
    enabled?: boolean;
    backend?: "firecrawl" | "tavily" | "exa" | "none" | string;
    api_key?: string;
  };
  // Forward-compatible — unknown keys are ignored.
  [k: string]: unknown;
}

/**
 * Escape a string so it's safe inside a double-quoted .env value.
 * Escapes backslash, double-quote, dollar, and backtick.
 */
function escapeEnvValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`");
}

function envLine(key: string, value: string | number | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value);
  if (!s) return null;
  return `${key}="${escapeEnvValue(s)}"`;
}

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Build the body of /home/<slug>/.hermes/.env from a channel config.
 * Returns null if nothing to write.
 *
 * Exported so the Orgo provisioner (`lib/orgo-setup.ts`) can reuse the same
 * channel-config→env-var mapping without duplicating it.
 */
export function buildHermesEnv(config: ChannelConfig): string | null {
  const lines: string[] = [];

  if (config.slack?.enabled) {
    const s = config.slack;
    const add = (k: string, v: unknown) => {
      const line = envLine(k, typeof v === "string" ? v.trim() : v as never);
      if (line) lines.push(line);
    };
    add("SLACK_BOT_TOKEN", s.bot_token);
    add("SLACK_APP_TOKEN", s.app_token);
    add("SLACK_ALLOWED_USERS", s.allowed_users);
    add("SLACK_HOME_CHANNEL", s.home_channel);
  }

  if (config.discord?.enabled && nonEmpty(config.discord.token)) {
    const line = envLine("DISCORD_TOKEN", config.discord.token.trim());
    if (line) lines.push(line);
  }

  if (config.email?.enabled) {
    const e = config.email;
    const add = (k: string, v: unknown) => {
      const line = envLine(k, typeof v === "string" ? v.trim() : v as string | number | undefined);
      if (line) lines.push(line);
    };
    add("EMAIL_IMAP_HOST", e.imap_host);
    add("EMAIL_SMTP_HOST", e.smtp_host);
    add("EMAIL_PORT", e.port);
    add("EMAIL_USER", e.username);
    add("EMAIL_PASSWORD", e.password);
  }

  if (config.ai?.enabled && nonEmpty(config.ai.api_key)) {
    const provider = (config.ai.provider || "anthropic").toLowerCase();
    const key = config.ai.api_key.trim();
    if (provider === "anthropic") {
      const line = envLine("ANTHROPIC_API_KEY", key);
      if (line) lines.push(line);
    } else if (provider === "openai") {
      const line = envLine("OPENAI_API_KEY", key);
      if (line) lines.push(line);
    } else if (provider === "openrouter") {
      const line = envLine("OPENROUTER_API_KEY", key);
      if (line) lines.push(line);
    } else {
      // Unknown provider — write under the canonical key with the provider name
      // so an operator can debug from the file.
      const line = envLine(`${provider.toUpperCase()}_API_KEY`, key);
      if (line) lines.push(line);
    }
    if (nonEmpty(config.ai.model)) {
      const modelLine = envLine("HERMES_MODEL", config.ai.model.trim());
      if (modelLine) lines.push(modelLine);
    }
  }

  if (config.web_search?.enabled && nonEmpty(config.web_search.api_key)) {
    const backend = (config.web_search.backend || "").toLowerCase();
    const key = config.web_search.api_key.trim();
    if (backend === "firecrawl") {
      const line = envLine("FIRECRAWL_API_KEY", key);
      if (line) lines.push(line);
    } else if (backend === "tavily") {
      const line = envLine("TAVILY_API_KEY", key);
      if (line) lines.push(line);
    } else if (backend === "exa") {
      const line = envLine("EXA_API_KEY", key);
      if (line) lines.push(line);
    }
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : null;
}

function hasMessagingChannel(config: ChannelConfig): boolean {
  return Boolean(config.slack?.enabled || config.discord?.enabled || config.email?.enabled);
}

const HERMES_ENV_HEREDOC = "RAMPED_HERMES_ENV_X37";
const HERMES_YAML_HEREDOC = "RAMPED_HERMES_YAML_X37";

export function generateCloudInit(
  slug: string,
  apiServerKey: string,
  channelConfig: ChannelConfig = {},
): string {
  const apiUrl = (process.env.SITE_URL || SITE_URL_DEFAULT).replace(/\/$/, "");
  const hermesEnv = buildHermesEnv(channelConfig);
  const installGateway = hasMessagingChannel(channelConfig);
  const writeYaml = Boolean(channelConfig.slack?.enabled);

  const hermesEnvBlock = hermesEnv
    ? `
# 6a. Hermes channel env (per-client config from admin Channels tab)
mkdir -p /home/${slug}/.hermes
cat > /home/${slug}/.hermes/.env <<'${HERMES_ENV_HEREDOC}'
${hermesEnv}${HERMES_ENV_HEREDOC}
chmod 600 /home/${slug}/.hermes/.env
chown -R ${slug}:${slug} /home/${slug}/.hermes
`
    : "";

  const hermesYamlBlock = writeYaml
    ? `
# 6b. Hermes config.yaml — Slack platform settings for the gateway
mkdir -p /home/${slug}/.hermes
cat > /home/${slug}/.hermes/config.yaml <<'${HERMES_YAML_HEREDOC}'
group_sessions_per_user: true
unauthorized_dm_behavior: pair
platforms:
  slack:
    reply_to_mode: first
    extra:
      reply_in_thread: true
${HERMES_YAML_HEREDOC}
chown ${slug}:${slug} /home/${slug}/.hermes/config.yaml
`
    : "";

  // Gateway install runs as the slug user so the systemd unit it creates lives
  // under that user's namespace. Best-effort — if hermes isn't installed yet
  // (this script runs before the desktop installer in some flows) we don't
  // want cloud-init to abort the whole boot.
  const gatewayInstallBlock = installGateway
    ? `
# 6c. Install Hermes gateway as a system service (Slack/Discord/Email enabled)
sudo -u ${slug} -H bash -lc 'command -v hermes >/dev/null 2>&1 && hermes gateway install' || true
`
    : "";

  // First 8 chars of api_server_key are the VNC password — narrow enough to type
  // into the noVNC auth prompt, wide enough to be unguessable (~33 bits from
  // hex). Stored on the droplet in /home/<slug>/.vnc/passwd via x11vnc.
  const vncPassword = apiServerKey.slice(0, 8);

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
  git curl wget unzip build-essential \\
  xvfb x11vnc openbox novnc websockify
# Chromium so the noVNC desktop has a usable browser. Falls back to the
# non-suffixed package name; if both fail we don't block boot.
apt-get install -y chromium-browser || apt-get install -y chromium || true

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

# 3a. VNC password (first 8 chars of api_server_key) for x11vnc.
mkdir -p /home/${slug}/.vnc
x11vnc -storepasswd '${vncPassword}' /home/${slug}/.vnc/passwd
chown -R ${slug}:${slug} /home/${slug}/.vnc
chmod 600 /home/${slug}/.vnc/passwd

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

# 5. Working dir + control-plane env
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
${hermesEnvBlock}${hermesYamlBlock}${gatewayInstallBlock}
# 7. OneCLI (setup UI on :10255)
# TODO: replace with real install once OneCLI ships a release artifact.
mkdir -p /opt/ramped-bot/onecli

# Hand /opt/ramped-bot to the slug user so the installer can write into it.
chown -R ${slug}:${slug} /opt/ramped-bot

# 7a. Virtual desktop + noVNC stack — Xvfb -> Openbox -> x11vnc -> websockify.
#     Four separate systemd units so each component restarts independently.
cat > /etc/systemd/system/ramped-xvfb.service <<'XVFB_UNIT'
[Unit]
Description=Virtual Display for Ramped Bot
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb :1 -screen 0 1280x800x24
Restart=always

[Install]
WantedBy=multi-user.target
XVFB_UNIT

cat > /etc/systemd/system/ramped-openbox.service <<'OPENBOX_UNIT'
[Unit]
Description=Openbox Window Manager
After=ramped-xvfb.service

[Service]
User=${slug}
Environment=DISPLAY=:1
ExecStart=/usr/bin/openbox-session
Restart=always

[Install]
WantedBy=multi-user.target
OPENBOX_UNIT

cat > /etc/systemd/system/ramped-vnc.service <<'VNC_UNIT'
[Unit]
Description=VNC Server for Ramped Bot
After=ramped-openbox.service

[Service]
User=${slug}
ExecStart=/usr/bin/x11vnc -display :1 -rfbauth /home/${slug}/.vnc/passwd -rfbport 5901 -forever -shared -noxdamage
Restart=always

[Install]
WantedBy=multi-user.target
VNC_UNIT

cat > /etc/systemd/system/ramped-novnc.service <<'NOVNC_UNIT'
[Unit]
Description=noVNC Web Interface for Ramped Bot
After=ramped-vnc.service

[Service]
ExecStart=/usr/bin/websockify --web /usr/share/novnc 6080 localhost:5901
Restart=always

[Install]
WantedBy=multi-user.target
NOVNC_UNIT

systemctl daemon-reload
systemctl enable ramped-xvfb ramped-openbox ramped-vnc ramped-novnc
systemctl start ramped-xvfb ramped-openbox ramped-vnc ramped-novnc

# 8. Firewall — SSH, HTTP (LE challenge), OneCLI, noVNC. Hermes :8000 stays
#    loopback until OneCLI binds it behind a reverse proxy.
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 10255/tcp
ufw allow 6080/tcp
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
