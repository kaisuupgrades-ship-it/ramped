/**
 * GET /api/admin/decks/download?deck_id=<uuid>
 *
 * Admin-only. Looks up the deck row, generates a short-lived (5 min) signed
 * Supabase Storage URL, and 302s the client to it. Keeps the storage path
 * server-side — never exposed to the browser.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { supabaseRest } from "@/lib/supabase";
import { signDeckDownloadUrl } from "@/lib/deck/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DeckRow {
  id: string;
  deck_storage_path: string | null;
  deck_filename: string | null;
  status: string;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("deck_id");
  if (!id) return NextResponse.json({ error: "deck_id required" }, { status: 400 });

  const { ok, data } = await supabaseRest<DeckRow[]>(
    "GET",
    `/prospect_decks?id=eq.${id}&select=id,deck_storage_path,deck_filename,status&limit=1`,
  );
  if (!ok || !data || data.length === 0) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  const d = data[0];
  if (d.status !== "ready" || !d.deck_storage_path) {
    return NextResponse.json({ error: `Deck not ready (status=${d.status})` }, { status: 409 });
  }
  const signed = await signDeckDownloadUrl(d.deck_storage_path, 300);
  if (!signed) {
    return NextResponse.json({ error: "Could not sign download URL" }, { status: 500 });
  }
  // Hint the filename via the Storage API's download= param so browser downloads
  // with the human-readable name instead of the bucket key.
  const finalUrl = d.deck_filename
    ? `${signed}${signed.includes("?") ? "&" : "?"}download=${encodeURIComponent(d.deck_filename)}`
    : signed;
  return NextResponse.redirect(finalUrl);
}
