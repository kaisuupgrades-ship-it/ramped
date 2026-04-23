// api/_lib/logger.js — Shared agent run + log module
// Use the same Supabase REST pattern as api/book.js (raw fetch, no SDK dep needed)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(method, path, body, prefer) {
  try {
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    };
    if (prefer) headers['Prefer'] = prefer;
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
  } catch (err) {
    console.error('[logger] supabase fetch error:', err.message);
    return { ok: false, status: 0, data: null };
  }
}

/**
 * startRun — insert a new agent_runs row
 * @param {string} clientId
 * @param {string} agentType
 * @param {object} inputSummary  — arbitrary metadata about the run's input
 * @returns {string|null} run UUID or null on failure
 */
export async function startRun(clientId, agentType, inputSummary = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[logger] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — skipping startRun');
    return null;
  }
  try {
    const { ok, data } = await sbFetch(
      'POST',
      '/agent_runs',
      { client_id: clientId, agent_type: agentType, input_summary: inputSummary, status: 'running' },
      'return=representation'
    );
    if (!ok || !data || !data[0]) {
      console.error('[logger] startRun insert failed');
      return null;
    }
    return data[0].id;
  } catch (err) {
    console.error('[logger] startRun error:', err.message);
    return null;
  }
}

/**
 * endRun — update an agent_runs row when the run completes
 * @param {string} runId
 * @param {'success'|'error'} status
 * @param {string|null} errorMessage
 * @param {number|null} durationMs
 */
export async function endRun(runId, status, errorMessage = null, durationMs = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !runId) return;
  try {
    await sbFetch(
      'PATCH',
      `/agent_runs?id=eq.${encodeURIComponent(runId)}`,
      {
        status,
        error_message: errorMessage || null,
        duration_ms: durationMs || null,
        completed_at: new Date().toISOString(),
      },
      'return=minimal'
    );
  } catch (err) {
    console.error('[logger] endRun error:', err.message);
  }
}

/**
 * log — insert a row into agent_logs
 * @param {string} clientId
 * @param {string|null} runId
 * @param {'info'|'warn'|'error'} level
 * @param {string} message
 * @param {object} metadata
 */
export async function log(clientId, runId, level, message, metadata = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await sbFetch(
      'POST',
      '/agent_logs',
      { client_id: clientId, run_id: runId || null, level, message, metadata },
      'return=minimal'
    );
  } catch (err) {
    console.error('[logger] log error:', err.message);
  }
}

/**
 * logError — convenience wrapper for logging an Error object
 * @param {string} clientId
 * @param {string|null} runId
 * @param {Error} err
 */
export async function logError(clientId, runId, err) {
  await log(clientId, runId, 'error', err.message || String(err), {
    stack: err.stack || null,
    name: err.name || null,
  });
}
