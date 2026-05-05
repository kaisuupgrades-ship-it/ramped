/**
 * agent_runs / agent_logs writers — used by the customer portal flows so each
 * agent execution leaves an auditable record (input summary, status, duration,
 * error). Mirrors api/_lib/logger.js.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

interface FetchResult { ok: boolean; status: number; data: unknown }

async function sbFetch(method: string, path: string, body?: unknown, prefer?: string): Promise<FetchResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { ok: false, status: 0, data: null };
  try {
    const headers: Record<string, string> = {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json",
    };
    if (prefer) headers["Prefer"] = prefer;
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
  } catch (err) {
    console.error("[logger] supabase fetch error:", (err as Error).message);
    return { ok: false, status: 0, data: null };
  }
}

export async function startRun(clientId: string, agentType: string, inputSummary: Record<string, unknown> = {}): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[logger] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — skipping startRun");
    return null;
  }
  try {
    const { ok, data } = await sbFetch(
      "POST", "/agent_runs",
      { client_id: clientId, agent_type: agentType, input_summary: inputSummary, status: "running" },
      "return=representation",
    );
    if (!ok || !Array.isArray(data) || !data[0]) {
      console.error("[logger] startRun insert failed");
      return null;
    }
    return (data[0] as { id: string }).id;
  } catch (err) {
    console.error("[logger] startRun error:", (err as Error).message);
    return null;
  }
}

export async function endRun(runId: string, status: "success" | "error", errorMessage: string | null = null, durationMs: number | null = null): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY || !runId) return;
  try {
    await sbFetch(
      "PATCH", `/agent_runs?id=eq.${encodeURIComponent(runId)}`,
      { status, error_message: errorMessage, duration_ms: durationMs, completed_at: new Date().toISOString() },
      "return=minimal",
    );
  } catch (err) {
    console.error("[logger] endRun error:", (err as Error).message);
  }
}

export async function log(clientId: string, runId: string | null, level: "info" | "warn" | "error", message: string, metadata: Record<string, unknown> = {}): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await sbFetch("POST", "/agent_logs", { client_id: clientId, run_id: runId, level, message, metadata }, "return=minimal");
  } catch (err) {
    console.error("[logger] log error:", (err as Error).message);
  }
}

export async function logError(clientId: string, runId: string | null, err: Error): Promise<void> {
  await log(clientId, runId, "error", err.message || String(err), { stack: err.stack || null, name: err.name || null });
}
