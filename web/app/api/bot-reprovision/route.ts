import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { setupOrgoComputer } from "@/lib/orgo-setup";
import type { ChannelConfig } from "@/lib/bot-cloud-init";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Pro: allow up to 5 min for Orgo setup

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Kept for backward compatibility with older deploys; no longer used.
const DO_API_TOKEN = process.env.DO_API_TOKEN;
void DO_API_TOKEN;
const ORGO_API_KEY = process.env.ORGO_API_KEY;
const ORGO_WORKSPACE_ID = process.env.ORGO_WORKSPACE_ID;
const ORGO_BASE_URL = "https://www.orgo.ai/api";

interface BotClientRow {
  id: string;
  slug: string;
  droplet_id: string | null;
  api_server_key: string | null;
  vps_status: string | null;
  channel_config: ChannelConfig | null;
}

interface OrgoComputer {
  id: string;
  name?: string;
  status?: string;
  url?: string | null;
  connection_url?: string | null;
}

async function pollUntilRunning(computerId: string): Promise<OrgoComputer> {
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
  if (!ORGO_API_KEY || !ORGO_WORKSPACE_ID) {
    return NextResponse.json({ error: "ORGO_API_KEY/ORGO_WORKSPACE_ID not configured" }, { status: 503 });
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
  if (!client.api_server_key) {
    return NextResponse.json({ error: "Client missing api_server_key" }, { status: 500 });
  }

  // If a stale Orgo computer is recorded, delete it first so we don't leak
  // billing. 404 means it's already gone, which is fine.
  if (client.droplet_id) {
    const delRes = await fetch(
      `${ORGO_BASE_URL}/computers/${encodeURIComponent(client.droplet_id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${ORGO_API_KEY}` } },
    );
    if (!delRes.ok && delRes.status !== 404) {
      console.error(`[bot-reprovision] Orgo delete failed for ${client.droplet_id}: ${delRes.status}`);
    }
  }

  const createRes = await fetch(`${ORGO_BASE_URL}/computers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ORGO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspace_id: ORGO_WORKSPACE_ID,
      name: client.slug,
      os: "linux",
      ram: 4,
      cpu: 1,
    }),
  });

  let computerId: string;
  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    // NAME_TAKEN means the delete silently failed (e.g. metal provider returned
    // 401). Recover by reusing the existing computer rather than hard-failing.
    // Orgo computers are listed under GET /api/projects/{workspaceId}.desktops
    if (createRes.status === 409 && text.includes("NAME_TAKEN")) {
      console.warn(`[bot-reprovision] NAME_TAKEN for "${client.slug}" — recovering existing computer`);
      const listRes = await fetch(
        `${ORGO_BASE_URL}/projects/${encodeURIComponent(ORGO_WORKSPACE_ID!)}`,
        { headers: { Authorization: `Bearer ${ORGO_API_KEY!}` } },
      );
      if (listRes.ok) {
        const project = (await listRes.json()) as { desktops?: OrgoComputer[] };
        const existing = project.desktops?.find((c) => c.name === client.slug);
        if (existing?.id) {
          computerId = existing.id;
          console.log(`[bot-reprovision] Reusing existing computer ${computerId}`);
        } else {
          return NextResponse.json(
            { error: `NAME_TAKEN but no computer named "${client.slug}" found in workspace` },
            { status: 502 },
          );
        }
      } else {
        const listErr = await listRes.text().catch(() => "");
        return NextResponse.json(
          { error: `NAME_TAKEN; project list failed ${listRes.status}: ${listErr.slice(0, 200)}` },
          { status: 502 },
        );
      }
    } else {
      return NextResponse.json(
        { error: `Orgo ${createRes.status}: ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
  } else {
    const created = (await createRes.json()) as OrgoComputer;
    if (!created.id) {
      return NextResponse.json({ error: "Orgo returned no computer id" }, { status: 502 });
    }
    computerId = created.id;
  }

  // Mark the row with the new computer id immediately so revoke can clean up
  // even if polling/setup fails further down.
  await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        droplet_id: computerId,
        droplet_ip: null,
        hermes_url: null,
        novnc_url: null,
        vps_status: "provisioning",
      }),
    },
  );

  let ready: OrgoComputer;
  try {
    ready = await pollUntilRunning(computerId);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        droplet_id: computerId,
        error: err instanceof Error ? err.message : "Orgo polling failed",
      },
      { status: 504 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (ready.url) {
    patch.droplet_ip = ready.url;
    patch.hermes_url = ready.url;
  }
  if (ready.connection_url) patch.novnc_url = ready.connection_url;
  if (Object.keys(patch).length > 0) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}`,
      { method: "PATCH", headers, body: JSON.stringify(patch) },
    ).catch(() => undefined);
  }

  // Await setup — fire-and-forget was silently killed by Vercel once the
  // HTTP response was sent. maxDuration=300 keeps the function alive.
  let setupError: string | null = null;
  if (ready.url && SUPABASE_ANON_KEY) {
    try {
      await setupOrgoComputer(computerId, {
        slug: client.slug,
        apiServerKey: client.api_server_key,
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY,
        channelConfig: (client.channel_config ?? {}) as Record<string, unknown>,
      });
    } catch (err) {
      setupError = err instanceof Error ? err.message : String(err);
      console.error(`[bot-reprovision] Orgo setup failed for ${computerId}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    droplet_id: computerId,
    url: ready.url ?? null,
    connection_url: ready.connection_url ?? null,
    vnc_password: client.api_server_key.slice(0, 8),
    setup_skipped: !SUPABASE_ANON_KEY,
    setup_error: setupError,
  });
}
