import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET    /api/admin-agents?bookingId=… → agents + pending drafts + recent runs
 * POST   /api/admin-agents             → upsert agent
 *        body: { id?, bookingId, name, channel?, description?, status?, config? }
 * DELETE /api/admin-agents             → archive (soft-delete) agent
 *        body: { id }
 */

const ALLOWED_STATUS = ["building", "live", "paused", "archived"];

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });

  const [agents, pendingDrafts, recentRuns] = await Promise.all([
    supabaseRest<unknown[]>("GET", `/agents?booking_id=eq.${bookingId}&order=created_at.asc`),
    supabaseRest<unknown[]>("GET", `/agent_drafts?booking_id=eq.${bookingId}&status=eq.pending&select=id,agent_id,subject,recipient,created_at&order=created_at.desc&limit=50`),
    supabaseRest<unknown[]>("GET", `/agent_runs?booking_id=eq.${bookingId}&select=id,agent_id,action,outcome,hours_saved,created_at&order=created_at.desc&limit=50`),
  ]);

  return NextResponse.json({
    agents: (agents.ok && Array.isArray(agents.data)) ? agents.data : [],
    pending_drafts: (pendingDrafts.ok && Array.isArray(pendingDrafts.data)) ? pendingDrafts.data : [],
    recent_runs: (recentRuns.ok && Array.isArray(recentRuns.data)) ? recentRuns.data : [],
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: {
    id?: string; bookingId?: string; name?: string; channel?: string;
    description?: string; status?: string; config?: Record<string, unknown>;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const bookingId = String(body.bookingId || "");
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });

  const status = ALLOWED_STATUS.includes(body.status || "") ? body.status as string : "building";
  const name = String(body.name || "").slice(0, 200);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const row: Record<string, unknown> = {
    booking_id: bookingId,
    name,
    channel: body.channel ? String(body.channel).slice(0, 60) : null,
    description: body.description ? String(body.description).slice(0, 1000) : null,
    status,
    config: (body.config && typeof body.config === "object") ? body.config : {},
    updated_at: new Date().toISOString(),
  };

  const isUpdate = body.id && /^[0-9a-f-]{36}$/i.test(body.id);
  const r = isUpdate
    ? await supabaseRest<Array<{ id: string }>>("PATCH", `/agents?id=eq.${body.id}`, row)
    : await supabaseRest<Array<{ id: string }>>("POST", "/agents", row);

  if (!r.ok) return NextResponse.json({ error: "DB write failed" }, { status: 500 });

  const agent = (Array.isArray(r.data) && r.data[0]) ? r.data[0] : null;
  logAdminAction(req, {
    action: isUpdate ? "agent.update" : "agent.create",
    target_table: "agents",
    target_id: agent?.id || body.id || undefined,
    payload: { booking_id: bookingId, name, status, channel: row.channel as string | null },
    result_status: 200,
  }).catch(() => {});
  return NextResponse.json({ ok: true, agent });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: { id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const id = String(body.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await supabaseRest("PATCH", `/agents?id=eq.${id}`, { status: "archived", updated_at: new Date().toISOString() });
  logAdminAction(req, { action: "agent.archive", target_table: "agents", target_id: id, result_status: 200 }).catch(() => {});
  return NextResponse.json({ ok: true });
}
