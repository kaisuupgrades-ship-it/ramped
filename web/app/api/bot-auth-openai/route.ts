import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ORGO_API_KEY = process.env.ORGO_API_KEY;
const ORGO_BASE_URL = "https://www.orgo.ai/api";

// Triggers `hermes auth add openai-codex` on the client's Orgo VPS and returns
// the device-flow URL the operator needs to open in a browser to complete the
// OpenAI OAuth. Admin bearer + client_id query param (same shape as
// /api/bot-poll-droplet).
interface BotClientRow {
  id: string;
  droplet_id: string | null;
}

interface BashResponse {
  output?: string;
  exit_code?: number;
}

// Matches https://auth.openai.com/..., https://chat.openai.com/auth/...,
// or any openai.com URL the device flow may print.
const AUTH_URL_RE = /https?:\/\/[a-z0-9.-]*openai\.com\/[^\s'"<>]+/i;

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  if (!ORGO_API_KEY) {
    return NextResponse.json({ error: "ORGO_API_KEY not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  const clientRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ramped_bot_clients?id=eq.${encodeURIComponent(clientId)}&select=id,droplet_id`,
    { headers: sbHeaders },
  );
  if (!clientRes.ok) {
    const text = await clientRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Failed to load client (Supabase ${clientRes.status}): ${text.slice(0, 200)}` },
      { status: 500 },
    );
  }
  const rows = (await clientRes.json()) as BotClientRow[];
  const client = rows[0];
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!client.droplet_id) {
    return NextResponse.json({ error: "Client has no Orgo droplet_id" }, { status: 400 });
  }

  // `hermes auth add openai-codex` prints the device-flow URL to stdout within
  // a few seconds, then blocks waiting for the user to complete the flow. The
  // Orgo bash API caps at 30s — we treat 500/"time out" as expected, parse
  // whatever output we captured for the auth URL.
  const command = "hermes auth add openai-codex 2>&1";
  let output = "";
  try {
    const orgoRes = await fetch(
      `${ORGO_BASE_URL}/computers/${encodeURIComponent(client.droplet_id)}/bash`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ORGO_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
      },
    );

    const text = await orgoRes.text().catch(() => "");
    if (!orgoRes.ok) {
      if (orgoRes.status === 500 && text.includes("time out")) {
        // Best-effort: response body on timeout sometimes still contains the
        // partial command output JSON. Try to pull it out; otherwise fall back
        // to the raw text and let regex hunt.
        output = extractOutput(text) ?? text;
      } else {
        return NextResponse.json(
          { error: `Orgo ${orgoRes.status}: ${text.slice(0, 300)}` },
          { status: 502 },
        );
      }
    } else {
      const data = JSON.parse(text) as BashResponse;
      output = data.output ?? "";
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Orgo request failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 },
    );
  }

  const match = output.match(AUTH_URL_RE);
  if (!match) {
    return NextResponse.json(
      {
        error: "Could not parse auth URL from hermes output",
        output: output.slice(0, 1000),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, auth_url: match[0] });
}

function extractOutput(text: string): string | null {
  try {
    const j = JSON.parse(text) as { output?: string };
    return typeof j.output === "string" ? j.output : null;
  } catch {
    return null;
  }
}
