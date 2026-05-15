/**
 * Orgo computer setup — installs deps + Hermes + supervisor inside a freshly
 * created Orgo computer. Called by /api/bot-provision and /api/bot-reprovision
 * after the computer reports status="running".
 *
 * Each numbered step is a separate POST /computers/{id}/bash call so failures
 * are easy to localise; if a step returns a non-zero exit code we throw.
 */

import { buildHermesEnv, type ChannelConfig } from "@/lib/bot-cloud-init";

const ORGO_BASE_URL = "https://www.orgo.ai/api";

interface BashResponse {
  output?: string;
  exit_code?: number;
}

export interface OrgoSetupConfig {
  slug: string;
  apiServerKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  channelConfig?: Record<string, unknown>;
}

async function runBash(computerId: string, command: string, step: string): Promise<void> {
  const apiKey = process.env.ORGO_API_KEY;
  if (!apiKey) throw new Error("ORGO_API_KEY not set");

  const res = await fetch(`${ORGO_BASE_URL}/computers/${encodeURIComponent(computerId)}/bash`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Orgo bash API returns HTTP 500 with timeout message when command > 30s.
    // The command IS still running on the VPS — treat as expected and continue.
    if (res.status === 500 && text.includes("time out")) {
      console.warn(`[orgo-setup] ${step}: timed out (still running on VPS), continuing`);
      return;
    }
    throw new Error(`Orgo bash [${step}] HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as BashResponse;
  if (typeof data.exit_code === "number" && data.exit_code !== 0) {
    const out = (data.output ?? "").slice(0, 2000);
    throw new Error(`Orgo bash [${step}] exit ${data.exit_code}: ${out}`);
  }
}

/**
 * Heredoc-style here-string escaping isn't needed because the body is enclosed
 * by a quoted heredoc on the remote side. But the heredoc marker we choose has
 * to be a token that cannot occur in user-supplied values — pick a long random
 * sentinel.
 */
const ENV_HEREDOC = "RAMPED_ORGO_ENV_X94K";
const SUP_HEREDOC = "RAMPED_ORGO_SUP_X94K";

/**
 * Escape a string for safe inclusion inside a double-quoted .env value.
 * Mirrors the helper in bot-cloud-init.ts.
 */
function escapeEnvValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`");
}

function buildEnvFileBody(config: OrgoSetupConfig): string {
  const channelEnv = buildHermesEnv((config.channelConfig ?? {}) as ChannelConfig) ?? "";
  const lines = [
    `ANTHROPIC_API_KEY=""`,
    `RAMPED_SLUG="${escapeEnvValue(config.slug)}"`,
    `RAMPED_API_KEY="${escapeEnvValue(config.apiServerKey)}"`,
    `RAMPED_API_URL="${escapeEnvValue(config.supabaseUrl)}"`,
    `SUPABASE_ANON_KEY="${escapeEnvValue(config.supabaseAnonKey)}"`,
  ];
  let body = lines.join("\n") + "\n";
  if (channelEnv) body += channelEnv;
  return body;
}

export async function setupOrgoComputer(computerId: string, config: OrgoSetupConfig): Promise<void> {
  // 1. Bootstrap: NodeSource + all apt deps in one shot so there is only
  //    ONE apt-get lock acquisition. This typically takes >30 s, so Orgo
  //    returns 500/"time out" -- runBash treats that as non-fatal and continues
  //    while the command keeps running on the VPS. Steps 2-3 are curl-only
  //    and don't touch apt, so there is no dpkg lock race.
  await runBash(
    computerId,
    // Orgo VMs have clock skew (~6 days behind) — bypass validity check with -o flags.
    "apt-get -o Acquire::Check-Valid-Until=false -o Acquire::Check-Date=false update -y && " +
      "DEBIAN_FRONTEND=noninteractive apt-get install -y supervisor",
    "apt-bootstrap",
  );

  // 2. uv (Python toolchain manager used by Hermes) -- curl-only, no apt
  await runBash(
    computerId,
    // astral installer puts uv at ~/.cargo/bin/uv on some distros, ~/.local/bin/uv on others — try both
    "curl -LsSf https://astral.sh/uv/install.sh | sh && " +
      "(cp /root/.cargo/bin/uv /usr/local/bin/uv 2>/dev/null || cp /root/.local/bin/uv /usr/local/bin/uv 2>/dev/null) && " +
      "chmod 755 /usr/local/bin/uv && uv --version",
    "uv-install",
  );

  // 3. Hermes
  await runBash(
    computerId,
    // Set PATH so uv is available to hermes install.sh; find hermes wherever it lands
    "export PATH=\"/usr/local/bin:/root/.local/bin:/root/.cargo/bin:$PATH\" HOME=/root && " +
      "curl -LsSf https://hermes.computer/install.sh | sh && " +
      "(cp /root/.local/bin/hermes /usr/local/bin/hermes 2>/dev/null || " +
        "cp /root/.cargo/bin/hermes /usr/local/bin/hermes 2>/dev/null || " +
        "find /root -name hermes -type f 2>/dev/null | head -1 | xargs -I{} cp {} /usr/local/bin/hermes 2>/dev/null || true) && " +
      "chmod 755 /usr/local/bin/hermes && hermes --version",
    "hermes-install",
  );

  // 4. /root/.hermes/.env — control-plane + channel config
  const envBody = buildEnvFileBody(config);
  const envCmd =
    `mkdir -p /root/.hermes && cat > /root/.hermes/.env <<'${ENV_HEREDOC}'\n` +
    envBody +
    `${ENV_HEREDOC}\n` +
    `chmod 600 /root/.hermes/.env`;
  await runBash(computerId, envCmd, "env-file");

  // 5. supervisor config to keep `hermes gateway run` alive across reboots
  const supBody = `[program:hermes]
command=/usr/local/bin/hermes gateway run
directory=/root
user=root
autostart=true
autorestart=true
stderr_logfile=/var/log/hermes.err.log
stdout_logfile=/var/log/hermes.out.log
environment=HOME="/root",PATH="/usr/local/bin:/usr/bin:/bin"
`;
  const supCmd =
    `cat > /etc/supervisor/conf.d/hermes.conf <<'${SUP_HEREDOC}'\n` +
    supBody +
    `${SUP_HEREDOC}`;
  await runBash(computerId, supCmd, "supervisor-conf");

  // 6. Start supervisor + hermes. supervisord may already be running on the
  //    Orgo image; we ignore the "already started" error from the daemon start.
  await runBash(
    computerId,
    // Wait up to 60s for hermes binary (hermes-install may have timed out but still running in bg)
    "for i in $(seq 1 6); do [ -x /usr/local/bin/hermes ] && break; echo \"waiting for hermes binary $i/6\"; sleep 10; done && " +
      "(supervisord -c /etc/supervisor/supervisord.conf || true) && " +
      "supervisorctl reread && supervisorctl update && supervisorctl start hermes",
    "supervisor-start",
  );

  // 7. Phone home to /api/bot-heartbeat so vps_status flips
  //    "provisioning" → "awaiting_oauth" without waiting for an admin to click
  //    "Check Status". Wait 15s for Hermes to fully start, then POST.
  //    Best-effort: `|| true` so a transient curl failure doesn't fail setup.
  const heartbeatCmd =
    `sleep 15 && curl -fsSL -X POST -H "Authorization: Bearer ${escapeEnvValue(config.apiServerKey)}" https://www.30dayramp.com/api/bot-heartbeat || true`;
  await runBash(computerId, heartbeatCmd, "heartbeat");
}
