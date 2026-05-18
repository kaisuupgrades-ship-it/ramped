/**
 * POST /api/admin/decks/review  body: { deck_id }
 *
 * Admin-only. Marks the deck as reviewed (sets reviewed_at = now). Used by
 * the "Mark reviewed" button in the admin UI so Jon can track which decks
 * he's already prepped vs which still need a look.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { deck_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.deck_id) return NextResponse.json({ error: "deck_id required" }, { status: 400 });

  const { ok } = await supabaseRest(
    "PATCH",
    `/prospect_decks?id=eq.${body.deck_id}`,
    { reviewed_at: new Date().toISOString() },
  );
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
