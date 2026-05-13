import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

interface SetupCodeRow {
  code: string;
}

function parseContentRangeTotal(header: string | null): number {
  if (!header) return 0;
  const slash = header.lastIndexOf("/");
  if (slash < 0) return 0;
  const total = header.slice(slash + 1);
  if (total === "*" || total === "") return 0;
  const n = parseInt(total, 10);
  return Number.isFinite(n) ? n : 0;
}

async function deleteAndCount(url: string, headers: Record<string, string>): Promise<number> {
  const r = await fetch(url, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=representation,count=exact" },
  });
  if (!r.ok) return 0;
  const fromHeader = parseContentRangeTotal(r.headers.get("content-range"));
  if (fromHeader > 0) return fromHeader;
  try {
    const body = (await r.json()) as unknown[];
    return Array.isArray(body) ? body.length : 0;
  } catch {
    return 0;
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { client_id?: unknown; ip?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const ip = typeof body.ip === "string" ? body.ip.trim() : "";
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  const codesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes?select=code&client_id=eq.${encodeURIComponent(clientId)}`,
    { headers },
  );
  if (!codesRes.ok) return NextResponse.json({ error: "Failed to look up codes" }, { status: 500 });
  const codes = ((await codesRes.json()) as SetupCodeRow[]).map((r) => r.code).filter(Boolean);

  let cleared = 0;
  if (codes.length > 0) {
    // PostgREST `in.(a,b,c)` filter — values comma-separated, no quotes needed for
    // our codes (uppercase base32, no commas/parens).
    const inList = codes.map((c) => encodeURIComponent(c)).join(",");
    cleared += await deleteAndCount(
      `${SUPABASE_URL}/rest/v1/ramped_bot_claim_attempts?code=in.(${inList})`,
      headers,
    );
  }

  if (ip) {
    cleared += await deleteAndCount(
      `${SUPABASE_URL}/rest/v1/ramped_bot_claim_attempts?ip=eq.${encodeURIComponent(ip)}`,
      headers,
    );
  }

  return NextResponse.json({ cleared });
}
