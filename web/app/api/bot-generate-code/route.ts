import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const BASE32_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateSetupCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += BASE32_CHARSET[bytes[i] % BASE32_CHARSET.length];
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { client_id?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const nowIso = new Date().toISOString();
  await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes?client_id=eq.${encodeURIComponent(clientId)}&claimed_at=is.null`,
    { method: "PATCH", headers, body: JSON.stringify({ expires_at: nowIso }) },
  );

  const code = generateSetupCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const codeRes = await fetch(`${SUPABASE_URL}/rest/v1/ramped_bot_setup_codes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ client_id: clientId, code, expires_at: expiresAt }),
  });
  if (!codeRes.ok) {
    return NextResponse.json({ error: "Failed to create setup code" }, { status: 500 });
  }

  return NextResponse.json({ code });
}
