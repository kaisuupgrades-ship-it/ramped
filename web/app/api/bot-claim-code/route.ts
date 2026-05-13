import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

interface CodeRow {
  id: string;
  client_id: string;
  code: string;
  expires_at: string;
  claimed_at: string | null;
  ramped_bot_clients?: {
    hermes_url: string | null;
    api_server_key: string | null;
    vps_status: string | null;
  } | null;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { code?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const rawCode = typeof body.code === "string" ? body.code : "";
  const code = rawCode.trim().toUpperCase().replace(/-/g, "");
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  const nowIso = new Date().toISOString();
  const selectCols = "id,client_id,code,expires_at,claimed_at,ramped_bot_clients(hermes_url,api_server_key,vps_status)";
  const lookupUrl = `${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes?select=${encodeURIComponent(selectCols)}&code=eq.${encodeURIComponent(code)}&claimed_at=is.null&expires_at=gt.${encodeURIComponent(nowIso)}`;
  const lookupRes = await fetch(lookupUrl, { headers });
  if (!lookupRes.ok) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  const rows = (await lookupRes.json()) as CodeRow[];
  const row = rows[0];
  if (!row || !row.ramped_bot_clients || row.ramped_bot_clients.vps_status !== "active") {
    return NextResponse.json({ error: "Code not found or expired" }, { status: 404 });
  }

  const ip = clientIp(req);
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes?id=eq.${encodeURIComponent(row.id)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ claimed_at: new Date().toISOString(), claimed_by_ip: ip }),
    },
  );
  if (!updateRes.ok) {
    return NextResponse.json({ error: "Failed to claim code" }, { status: 500 });
  }

  return NextResponse.json({
    url: row.ramped_bot_clients.hermes_url,
    token: row.ramped_bot_clients.api_server_key,
  });
}
