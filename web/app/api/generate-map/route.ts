import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Disabled — public access removed. All roadmaps are generated via the
 * post-booking questionnaire flow (/api/questionnaire). Kept as 410 so any
 * stale clients pointing here get a clear "gone" signal instead of 404.
 */
export async function GET() {
  return NextResponse.json({ error: "This endpoint is no longer available." }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "This endpoint is no longer available." }, { status: 410 });
}
