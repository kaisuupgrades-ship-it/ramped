import { NextResponse, type NextRequest } from "next/server";
import { checkPortalToken } from "@/lib/portal-auth";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/portal-approve-draft?id&exp&t  body: { draftId, decision, edited_body? }
 *
 * Validates draftId belongs to this booking before mutating. Allowed decisions:
 * 'approve', 'reject', 'edit' (edit requires edited_body).
 */
export async function POST(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  let body: { draftId?: string; decision?: string; edited_body?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const draftId = String(body.draftId || "");
  if (!/^[0-9a-f-]{36}$/i.test(draftId)) return NextResponse.json({ error: "Invalid draftId" }, { status: 400 });

  const decision = String(body.decision || "").toLowerCase();
  if (!["approve", "reject", "edit"].includes(decision)) return NextResponse.json({ error: "Invalid decision" }, { status: 400 });

  // Validate ownership + load
  const dr = await supabaseRest<{ id: string; status: string; body: string }[]>("GET",
    `/agent_drafts?id=eq.${draftId}&booking_id=eq.${id}&select=id,status,body`);
  const draft = (dr.ok && Array.isArray(dr.data)) ? dr.data[0] : null;
  if (!draft) return NextResponse.json({ error: "Draft not found for this booking" }, { status: 404 });
  if (draft.status !== "pending") return NextResponse.json({ error: `Draft already ${draft.status}` }, { status: 409 });

  const patch: Record<string, unknown> = {
    decided_at: new Date().toISOString(),
    decided_by: "customer",
  };
  if (decision === "approve") patch.status = "approved";
  if (decision === "reject") patch.status = "rejected";
  if (decision === "edit") {
    const editedBody = String(body.edited_body || "").slice(0, 16000);
    if (editedBody.length < 2) return NextResponse.json({ error: "edited_body required for edit" }, { status: 400 });
    patch.status = "edited";
    patch.body = editedBody;
  }

  const u = await supabaseRest("PATCH", `/agent_drafts?id=eq.${draftId}`, patch);
  if (!u.ok) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ ok: true, status: patch.status });
}
