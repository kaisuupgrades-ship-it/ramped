import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agent-logs?client_id=&status=&limit=
 *
 * Dashboard agent_runs feed for the last 24h. Returns runs (with logs for the
 * first 10) plus aggregate stats. Admin Bearer-token gated.
 */

interface Run { id: string; client_id: string; agent_type: string; status: string; duration_ms: number | null; error_message: string | null; started_at: string; completed_at: string | null; input_summary: unknown }
interface RunStats { status: string; duration_ms: number | null }
interface AgentLog { id: string; run_id: string | null; level: string; message: string; metadata: unknown; created_at: string }

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json({
      configured: false, runs: [],
      stats: { total: 0, success: 0, error: 0, avg_duration_ms: null },
    });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const clientId = searchParams.get("client_id")?.trim() || null;
  const statusFilter = searchParams.get("status")?.trim() || null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let runsPath = `/agent_runs?started_at=gte.${encodeURIComponent(since)}&order=started_at.desc&limit=${limit}`;
  if (clientId) runsPath += `&client_id=eq.${encodeURIComponent(clientId)}`;
  if (statusFilter) runsPath += `&status=eq.${encodeURIComponent(statusFilter)}`;
  runsPath += "&select=*";

  let statsPath = `/agent_runs?started_at=gte.${encodeURIComponent(since)}&select=status,duration_ms`;
  if (clientId) statsPath += `&client_id=eq.${encodeURIComponent(clientId)}`;

  const [runsRes, statsRes] = await Promise.all([
    supabaseRest<Run[]>("GET", runsPath),
    supabaseRest<RunStats[]>("GET", statsPath),
  ]);

  if (!runsRes.ok) return NextResponse.json({ error: "Database query failed" }, { status: 502 });

  const runs = Array.isArray(runsRes.data) ? runsRes.data : [];
  const statsRows = Array.isArray(statsRes.data) ? statsRes.data : [];

  const runsWithLogs = await Promise.all(
    runs.slice(0, 10).map(async (run) => {
      try {
        const lr = await supabaseRest<AgentLog[]>("GET",
          `/agent_logs?run_id=eq.${encodeURIComponent(run.id)}&order=created_at.asc&select=*`);
        return { ...run, logs: (lr.ok && Array.isArray(lr.data)) ? lr.data : [] };
      } catch {
        return { ...run, logs: [] as AgentLog[] };
      }
    }),
  );

  const fullRuns = [
    ...runsWithLogs,
    ...runs.slice(10).map((r) => ({ ...r, logs: [] as AgentLog[] })),
  ];

  const total = statsRows.length;
  const success = statsRows.filter((r) => r.status === "success").length;
  const errors = statsRows.filter((r) => r.status === "error").length;
  const durations = statsRows.map((r) => r.duration_ms).filter((d): d is number => d != null);
  const avg_duration_ms = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  return NextResponse.json({
    runs: fullRuns,
    stats: { total, success, error: errors, avg_duration_ms },
  });
}
