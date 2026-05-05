import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const revalidate = 300; // ISR: re-fetch from Supabase every 5 min

/** Public read of curated AI-ops resources, ordered newest first. */
export async function GET(_req: NextRequest) {
  // Table is named ai_resources (not resources). Was returning empty for the
  // entire V2 lifetime because the path was wrong.
  const r = await supabaseRest<unknown[]>(
    "GET",
    "/ai_resources?select=id,title,url,source,summary,published_at&order=published_at.desc&limit=60",
  );
  if (!r.ok || !Array.isArray(r.data)) return NextResponse.json([]);
  return NextResponse.json(r.data);
}
