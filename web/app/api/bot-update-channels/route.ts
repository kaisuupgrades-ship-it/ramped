import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/bot-update-channels — admin-gated read/write of per-client channel config.
 *
 * GET  ?client_id=<uuid>            → { channel_config }
 * POST { client_id, channel_config } → { ok: true }
 *
 * The blob is consumed by /api/bot-provision and /api/bot-reprovision when
 * generating cloud-init. Updating it here does NOT push to a running VPS —
 * that's a future "Push Config" action; for now changes take effect on next
 * provision. Validation is intentionally permissive: we accept any object so
 * the admin UI can evolve channel shapes without a server bump.
 */

interface BotClientRow {
  id: string;
  channel_config: Record<string, unknown> | null;
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const clientId = req.nextUrl.searchParams.get("client_id")?.trim() ?? "";
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  const res = await supabaseRest<BotClientRow[]>(
    "GET",
    `/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}&select=id,channel_config`,
  );
  if (!res.ok || !Array.isArray(res.data) || !res.data[0]) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  return NextResponse.json({ channel_config: res.data[0].channel_config ?? {} });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { client_id?: unknown; channel_config?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  const channelConfig = body.channel_config;
  if (channelConfig === null || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
    return NextResponse.json({ error: "channel_config must be an object" }, { status: 400 });
  }

  // Verify the client exists before patching so we can return a clean 404.
  const lookup = await supabaseRest<BotClientRow[]>(
    "GET",
    `/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}&select=id`,
  );
  if (!lookup.ok || !Array.isArray(lookup.data) || !lookup.data[0]) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const patch = await supabaseRest(
    "PATCH",
    `/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}`,
    { channel_config: channelConfig },
  );
  if (!patch.ok) {
    return NextResponse.json({ error: "Failed to update channel config" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
