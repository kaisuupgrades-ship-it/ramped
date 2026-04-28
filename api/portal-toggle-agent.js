// api/portal-toggle-agent.js — customer pauses/resumes their own agent.
// POST /api/portal-toggle-agent?id=BOOKING_UUID&exp=…&t=…
// Body: { agentId, action: 'pause' | 'resume' }
//
// Validates the agent belongs to the same booking_id as the signed token.
// Only allowed transitions:
//   live    → paused (action: 'pause')
//   paused  → live   (action: 'resume')
// Other states (building, archived) are read-only from the customer side.

import { verifyMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { notifySlack } from './_lib/notify.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL     = process.env.SITE_URL || 'https://www.30dayramp.com';

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise(r => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); req.on('error', () => r({}));
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { id, exp, t } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id))    return res.status(400).json({ error: 'Invalid ID' });
  if (!isMapTokenConfigured())                return res.status(503).json({ error: 'Token signing not configured' });
  if (!verifyMapToken(id, exp, t))            return res.status(403).json({ error: 'Invalid or expired token' });
  if (!SUPABASE_URL || !SUPABASE_KEY)         return res.status(503).json({ error: 'DB not configured' });

  const body = await readJsonBody(req);
  const agentId = String(body.agentId || '');
  const action  = String(body.action || '').toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(agentId)) return res.status(400).json({ error: 'Invalid agentId' });
  if (action !== 'pause' && action !== 'resume') return res.status(400).json({ error: 'action must be pause or resume' });

  // Validate ownership (agent must belong to this booking)
  const lookupR = await fetch(
    `${SUPABASE_URL}/rest/v1/agents?id=eq.${encodeURIComponent(agentId)}&booking_id=eq.${encodeURIComponent(id)}&select=id,name,status`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const arr = lookupR.ok ? await lookupR.json() : [];
  const agent = arr[0];
  if (!agent) return res.status(404).json({ error: 'Agent not found for this booking' });

  // Validate transition
  const targetStatus = action === 'pause' ? 'paused' : 'live';
  if (agent.status === targetStatus) {
    return res.status(200).json({ ok: true, alreadyInState: true, status: agent.status });
  }
  if (action === 'pause' && agent.status !== 'live') {
    return res.status(409).json({ error: `Cannot pause agent in '${agent.status}' state. Contact Jon.` });
  }
  if (action === 'resume' && agent.status !== 'paused') {
    return res.status(409).json({ error: `Cannot resume agent in '${agent.status}' state. Contact Jon.` });
  }

  // Apply the change
  const u = await fetch(`${SUPABASE_URL}/rest/v1/agents?id=eq.${encodeURIComponent(agentId)}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status: targetStatus, updated_at: new Date().toISOString() }),
  });
  if (!u.ok) return res.status(500).json({ error: 'Update failed' });

  // Notify so admin sees customer-initiated changes
  notifySlack({
    text: `${action === 'pause' ? '⏸' : '▶'} Customer ${action}d agent: ${agent.name}`,
  }).catch(() => {});

  return res.status(200).json({ ok: true, status: targetStatus, agent: { id: agentId, name: agent.name } });
}
