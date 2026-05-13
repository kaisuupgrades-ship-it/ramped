import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const IP_LIMIT_PER_HOUR = 10;
const CODE_LIMIT_PER_HOUR = 20;
const TOO_MANY_MSG = "Too many attempts. Contact support.";

// Electron app fetches this endpoint cross-origin (no normal browser Origin).
// Allow any origin for this single public claim endpoint.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

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
    return withCors(NextResponse.json({ error: "Database not configured" }, { status: 503 }));
  }

  let body: { code?: unknown };
  try { body = await req.json(); } catch { return withCors(NextResponse.json({ error: "Invalid JSON" }, { status: 400 })); }

  const rawCode = typeof body.code === "string" ? body.code : "";
  const code = rawCode.trim().toUpperCase().replace(/-/g, "");
  if (!code) return withCors(NextResponse.json({ error: "code is required" }, { status: 400 }));

  const ip = clientIp(req);
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  // 1. Log this attempt before doing anything else (so failures still count).
  await fetch(`${SUPABASE_URL}/rest/v1/ramped_bot_claim_attempts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ip, code }),
  }).catch(() => {});

  // 2. Opportunistic sweep of attempts older than 24h. Fire-and-forget.
  const sweepCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_claim_attempts?attempted_at=lt.${encodeURIComponent(sweepCutoff)}`,
    { method: "DELETE", headers },
  ).catch(() => {});

  // 3. Check rate limits — count IP attempts in last hour, then code attempts in last hour.
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const countHeaders = { ...headers, Prefer: "count=exact" };

  const ipCountRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_claim_attempts?select=id&ip=eq.${encodeURIComponent(ip)}&attempted_at=gt.${encodeURIComponent(windowStart)}`,
    { headers: { ...countHeaders, Range: "0-0" } },
  );
  const ipCount = parseContentRangeTotal(ipCountRes.headers.get("content-range"));
  if (ipCount > IP_LIMIT_PER_HOUR) {
    return withCors(NextResponse.json({ error: TOO_MANY_MSG }, { status: 429 }));
  }

  const codeCountRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_claim_attempts?select=id&code=eq.${encodeURIComponent(code)}&attempted_at=gt.${encodeURIComponent(windowStart)}`,
    { headers: { ...countHeaders, Range: "0-0" } },
  );
  const codeCount = parseContentRangeTotal(codeCountRes.headers.get("content-range"));
  if (codeCount > CODE_LIMIT_PER_HOUR) {
    return withCors(NextResponse.json({ error: TOO_MANY_MSG }, { status: 429 }));
  }

  // 4. Look up the code.
  const nowIso = new Date().toISOString();
  const selectCols = "id,client_id,code,expires_at,claimed_at,ramped_bot_clients(hermes_url,api_server_key,vps_status)";
  const lookupUrl = `${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes?select=${encodeURIComponent(selectCols)}&code=eq.${encodeURIComponent(code)}&claimed_at=is.null&expires_at=gt.${encodeURIComponent(nowIso)}`;
  const lookupRes = await fetch(lookupUrl, { headers });
  if (!lookupRes.ok) {
    return withCors(NextResponse.json({ error: "Lookup failed" }, { status: 500 }));
  }
  const rows = (await lookupRes.json()) as CodeRow[];
  const row = rows[0];
  if (!row || !row.ramped_bot_clients || row.ramped_bot_clients.vps_status !== "active") {
    return withCors(NextResponse.json({ error: "Code not found or expired" }, { status: 404 }));
  }

  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes?id=eq.${encodeURIComponent(row.id)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ claimed_at: new Date().toISOString(), claimed_by_ip: ip }),
    },
  );
  if (!updateRes.ok) {
    return withCors(NextResponse.json({ error: "Failed to claim code" }, { status: 500 }));
  }

  return withCors(NextResponse.json({
    url: row.ramped_bot_clients.hermes_url,
    token: row.ramped_bot_clients.api_server_key,
  }));
}

// PostgREST returns "0-0/N" (or "*/N" when empty) in Content-Range when
// Prefer: count=exact is set. Pull the N off the back.
function parseContentRangeTotal(header: string | null): number {
  if (!header) return 0;
  const slash = header.lastIndexOf("/");
  if (slash < 0) return 0;
  const total = header.slice(slash + 1);
  if (total === "*" || total === "") return 0;
  const n = parseInt(total, 10);
  return Number.isFinite(n) ? n : 0;
}
