import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { setupOrgoComputer } from "@/lib/orgo-setup";
import type { ChannelConfig } from "@/lib/bot-cloud-init";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Kept for backward compatibility with older deploys; no longer used for
// provisioning (we ship via Orgo now). See ORGO_API_KEY below.
const DO_API_TOKEN = process.env.DO_API_TOKEN;
void DO_API_TOKEN;
const ORGO_API_KEY = process.env.ORGO_API_KEY;
const ORGO_WORKSPACE_ID = process.env.ORGO_WORKSPACE_ID;
const ORGO_BASE_URL = "https://www.orgo.ai/api";

const BASE32_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateSetupCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += BASE32_CHARSET[bytes[i] % BASE32_CHARSET.length];
  }
  return out;
}

interface OrgoComputer {
  id: string;
  name?: string;
  status?: string;
  url?: string | null;
  connection_url?: string | null;
  hostname?: string | null;
  fly_instance_id?: string | null;
}

async function pollUntilRunning(computerId: string): Promise<OrgoComputer> {
  // Up to ~60s at 2s intervals. Status progresses creating → starting → running.
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${ORGO_BASE_URL}/computers/${encodeURIComponent(computerId)}`, {
      headers: { Authorization: `Bearer ${ORGO_API_KEY!}` },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as OrgoComputer;
    if (data.status === "running") return data;
    if (data.status === "error") throw new Error("Orgo computer entered error state");
  }
  throw new Error("Orgo computer did not reach running within 60s");
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { name?: unknown; slug?: unknown; booking_id?: unknown; email?: unknown; channel_config?: unknown };
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
  const initialChannelConfig: ChannelConfig =
    body.channel_config && typeof body.channel_config === "object" && !Array.isArray(body.channel_config)
      ? (body.channel_config as ChannelConfig)
      : {};

  const apiServerKey = randomBytes(32).toString("hex");
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  // Initial status: "provisioning" if Orgo creds are present, else "pending".
  const initialStatus = ORGO_API_KEY && ORGO_WORKSPACE_ID ? "provisioning" : "pending";
  const payload: Record<string, unknown> = {
    name,
    slug,
    vps_status: initialStatus,
    api_server_key: apiServerKey,
    channel_config: initialChannelConfig,
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

  // Best-effort Orgo computer creation. If it fails, the client row stays so
  // the admin can retry with /api/bot-reprovision — failing the whole request
  // would orphan the setup code we just minted.
  let computerId: string | null = null;
  let provisionError: string | null = null;
  if (ORGO_API_KEY && ORGO_WORKSPACE_ID) {
    try {
      const createRes = await fetch(`${ORGO_BASE_URL}/computers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ORGO_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: ORGO_WORKSPACE_ID,
          name: slug,
          os: "linux",
          ram: 4,
          cpu: 1,
        }),
      });
      if (!createRes.ok) {
        const text = await createRes.text().catch(() => "");
        provisionError = `Orgo ${createRes.status}: ${text.slice(0, 200)}`;
      } else {
        const created = (await createRes.json()) as OrgoComputer;
        computerId = created.id ?? null;
      }
    } catch (err) {
      provisionError = err instanceof Error ? err.message : "Orgo create call failed";
    }

    if (computerId) {
      // Poll until running, then patch the client row with public URL + noVNC URL.
      // If polling fails, we still keep the computer id on the row so revoke can
      // clean it up.
      let publicUrl: string | null = null;
      let novncUrl: string | null = null;
      try {
        const ready = await pollUntilRunning(computerId);
        publicUrl = ready.url ?? null;
        novncUrl = ready.connection_url ?? null;
      } catch (err) {
        provisionError = err instanceof Error ? err.message : "Orgo polling failed";
      }

      const patch: Record<string, unknown> = { droplet_id: computerId };
      if (publicUrl) {
        patch.droplet_ip = publicUrl;
        patch.hermes_url = publicUrl;
      }
      if (novncUrl) patch.novnc_url = novncUrl;
      await fetch(
        `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(client.id as string)}`,
        { method: "PATCH", headers, body: JSON.stringify(patch) },
      ).catch(() => undefined);
      Object.assign(client as Record<string, unknown>, patch);

      // Fire-and-forget setup. Setup mutates supervisor + installs Hermes; if
      // it fails, the admin sees vps_status stuck at "provisioning" and can
      // hit /api/bot-reprovision. We don't await — provisioning takes minutes
      // and would blow past Vercel's serverless timeout.
      if (publicUrl && SUPABASE_ANON_KEY) {
        setupOrgoComputer(computerId, {
          slug,
          apiServerKey,
          supabaseUrl: SUPABASE_URL,
          supabaseAnonKey: SUPABASE_ANON_KEY,
          channelConfig: initialChannelConfig as Record<string, unknown>,
        }).catch((err) => {
          console.error(`[bot-provision] Orgo setup failed for ${computerId}:`, err);
        });
      } else if (!SUPABASE_ANON_KEY) {
        provisionError = (provisionError ? provisionError + "; " : "") +
          "NEXT_PUBLIC_SUPABASE_ANON_KEY not set — setup skipped";
      }
    }
  } else {
    provisionError = "ORGO_API_KEY/ORGO_WORKSPACE_ID not set — computer not created";
  }

  return NextResponse.json({
    client,
    code,
    droplet_id: computerId,
    provision_error: provisionError,
    vnc_password: apiServerKey.slice(0, 8),
  });
}
