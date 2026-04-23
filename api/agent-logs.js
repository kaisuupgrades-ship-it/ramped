// api/agent-logs.js — Dashboard API for agent run + log data
// GET /api/agent-logs
//   ?client_id=<id>   optional filter
//   ?status=error     optional filter on agent_runs.status
//   ?limit=50         default 50
//
// Returns { runs: [...], stats: { total, success, error, avg_duration_ms } }
// Protected with Bearer token auth (same pattern as admin-auth.js)

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

export default async function handler(req, res) {
  setAdminCors(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({
      configured: false,
      runs: [],
      stats: { total: 0, success: 0, error: 0, avg_duration_ms: null },
    });
  }

  const limit     = Math.min(parseInt(req.query.limit  || '50', 10), 200);
  const clientId  = req.query.client_id ? String(req.query.client_id).trim() : null;
  const statusFilter = req.query.status ? String(req.query.status).trim() : null;

  // Window: last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Build run query
  let runsPath = `/agent_runs?started_at=gte.${encodeURIComponent(since)}&order=started_at.desc&limit=${limit}`;
  if (clientId)     runsPath += `&client_id=eq.${encodeURIComponent(clientId)}`;
  if (statusFilter) runsPath += `&status=eq.${encodeURIComponent(statusFilter)}`;
  runsPath += '&select=*';

  // Build stats query (all runs in 24h window, regardless of limit)
  let statsPath = `/agent_runs?started_at=gte.${encodeURIComponent(since)}&select=status,duration_ms`;
  if (clientId) statsPath += `&client_id=eq.${encodeURIComponent(clientId)}`;

  const [runsRes, statsRes] = await Promise.all([
    sbFetch(runsPath),
    sbFetch(statsPath),
  ]);

  if (!runsRes.ok) {
    console.error('[agent-logs] runs query failed:', runsRes.status, runsRes.data);
    return res.status(502).json({ error: 'Database query failed' });
  }

  const runs      = runsRes.data  || [];
  const statsRows = statsRes.data || [];

  // For each run, fetch its logs (parallel, up to 10 runs to avoid fan-out)
  const runsWithLogs = await Promise.all(
    runs.slice(0, 10).map(async (run) => {
      try {
        const { ok, data } = await sbFetch(
          `/agent_logs?run_id=eq.${encodeURIComponent(run.id)}&order=created_at.asc&select=*`
        );
        return { ...run, logs: ok ? (data || []) : [] };
      } catch {
        return { ...run, logs: [] };
      }
    })
  );

  // For runs beyond the first 10, attach empty logs
  const fullRuns = [
    ...runsWithLogs,
    ...runs.slice(10).map(r => ({ ...r, logs: [] })),
  ];

  // Compute stats
  const total   = statsRows.length;
  const success = statsRows.filter(r => r.status === 'success').length;
  const errors  = statsRows.filter(r => r.status === 'error').length;
  const durations = statsRows.map(r => r.duration_ms).filter(d => d != null);
  const avg_duration_ms = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  return res.status(200).json({
    runs: fullRuns,
    stats: { total, success, error: errors, avg_duration_ms },
  });
}
