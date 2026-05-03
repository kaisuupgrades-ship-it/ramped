import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const revalidate = 300; // ISR: re-fetch from Supabase every 5 min

/** Public read of curated AI-ops resources, ordered newest first. */
export async function GET(_req: NextRequest) {
  const r = await supabaseRest<unknown[]>(
    "GET",
    "/resources?select=id,title,url,source,summary,published_at&order=published_at.desc&limit=60",
  );
  if (!r.ok || !Array.isArray(r.data)) return NextResponse.json([]);
  return NextResponse.json(r.data);
}
