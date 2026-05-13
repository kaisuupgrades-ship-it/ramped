import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

interface BotClient {
  id: string;
  hermes_url: string | null;
}

async function probe(hermesUrl: string): Promise<"online" | "offline"> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const r = await fetch(`${hermesUrl.replace(/\/$/, "")}/v1/health`, { signal: ctrl.signal });
    return r.ok ? "online" : "offline";
  } catch {
    return "offline";
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?select=id,hermes_url&hermes_url=not.is.null`,
    { headers },
  );
  if (!r.ok) return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
  const clients = (await r.json()) as BotClient[];

  const results = await Promise.all(
    clients.map(async (c) => [c.id, c.hermes_url ? await probe(c.hermes_url) : "offline"] as const),
  );
  const statuses: Record<string, "online" | "offline"> = {};
  for (const [id, status] of results) statuses[id] = status;

  return NextResponse.json({ statuses });
}
