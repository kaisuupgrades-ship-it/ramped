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

  let body: { name?: unknown; slug?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase alphanumeric with hyphens" }, { status: 400 });
  }

  const apiServerKey = randomBytes(32).toString("hex");
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const clientRes = await fetch(`${SUPABASE_URL}/rest/v1/ramped_bot_clients`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      slug,
      vps_status: "awaiting_oauth",
      api_server_key: apiServerKey,
    }),
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

  return NextResponse.json({ client, code });
}
