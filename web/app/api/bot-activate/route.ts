import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ORGO_API_KEY = process.env.ORGO_API_KEY;
const ORGO_BASE_URL = "https://www.orgo.ai/api";

// Restarts the hermes supervisor program (so it picks up the new OpenAI
// credential written during the OAuth flow) and flips vps_status to "active".
// Admin bearer + client_id in JSON body.
interface BotClientRow {
  id: string;
  droplet_id: string | null;
  vps_status: string | null;
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  if (!ORGO_API_KEY) {
    return NextResponse.json({ error: "ORGO_API_KEY not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { client_id?: string } | null;
  const clientId = body?.client_id;
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  const clientRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}&select=id,droplet_id,vps_status`,
    { headers: sbHeaders },
  );
  if (!clientRes.ok) {
    const text = await clientRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Failed to load client (Supabase ${clientRes.status}): ${text.slice(0, 200)}` },
      { status: 500 },
    );
  }
  const rows = (await clientRes.json()) as BotClientRow[];
  const client = rows[0];
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!client.droplet_id) {
    return NextResponse.json({ error: "Client has no Orgo droplet_id" }, { status: 400 });
  }

  // Restart hermes so it picks up the newly-written ~/.hermes/auth.json from
  // the OpenAI device flow. Supervisor brings it back up automatically.
  const orgoRes = await fetch(
    `${ORGO_BASE_URL}/computers/${encodeURIComponent(client.droplet_id)}/bash`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ORGO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command: "supervisorctl restart hermes 2>&1" }),
    },
  );

  if (!orgoRes.ok) {
    const text = await orgoRes.text().catch(() => "");
    if (!(orgoRes.status === 500 && text.includes("time out"))) {
      return NextResponse.json(
        { error: `Orgo ${orgoRes.status}: ${text.slice(0, 300)}` },
        { status: 502 },
      );
    }
    // 30s timeout while restart was in flight — supervisorctl is idempotent
    // and the restart likely completed; proceed to flip vps_status.
  }

  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      headers: { ...sbHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        vps_status: "active",
        last_active_at: new Date().toISOString(),
      }),
    },
  );
  if (!patchRes.ok) {
    const text = await patchRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Failed to update client: ${text.slice(0, 200)}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, vps_status: "active" });
}
