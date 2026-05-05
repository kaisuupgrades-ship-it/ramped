import { NextResponse, type NextRequest } from "next/server";
import { checkPortalToken } from "@/lib/portal-auth";
import { supabaseRest } from "@/lib/supabase";
import { notifySlack } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/portal-toggle-agent?id&exp&t  body: { agentId, action: 'pause' | 'resume' }
 *
 * Allowed transitions: live → paused, paused → live. Building / archived are
 * read-only from the customer side.
 */
export async function POST(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  let body: { agentId?: string; action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const agentId = String(body.agentId || "");
  const action = String(body.action || "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(agentId)) return NextResponse.json({ error: "Invalid agentId" }, { status: 400 });
  if (action !== "pause" && action !== "resume") return NextResponse.json({ error: "action must be pause or resume" }, { status: 400 });

  const lookup = await supabaseRest<{ id: string; name: string; status: string }[]>("GET",
    `/agents?id=eq.${encodeURIComponent(agentId)}&booking_id=eq.${encodeURIComponent(id)}&select=id,name,status`);
  const agent = (lookup.ok && Array.isArray(lookup.data)) ? lookup.data[0] : null;
  if (!agent) return NextResponse.json({ error: "Agent not found for this booking" }, { status: 404 });

  const targetStatus = action === "pause" ? "paused" : "live";
  if (agent.status === targetStatus) {
    return NextResponse.json({ ok: true, alreadyInState: true, status: agent.status });
  }
  if (action === "pause" && agent.status !== "live") {
    return NextResponse.json({ error: `Cannot pause agent in '${agent.status}' state. Contact Jon.` }, { status: 409 });
  }
  if (action === "resume" && agent.status !== "paused") {
    return NextResponse.json({ error: `Cannot resume agent in '${agent.status}' state. Contact Jon.` }, { status: 409 });
  }

  const u = await supabaseRest("PATCH", `/agents?id=eq.${encodeURIComponent(agentId)}`, {
    status: targetStatus, updated_at: new Date().toISOString(),
  });
  if (!u.ok) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  notifySlack({ text: `${action === "pause" ? "⏸" : "▶"} Customer ${action}d agent: ${agent.name}` }).catch(() => {});

  return NextResponse.json({ ok: true, status: targetStatus, agent: { id: agentId, name: agent.name } });
}
