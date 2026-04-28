// api/admin-agents.js — admin CRUD for the per-customer agent list.
//   GET  /api/admin-agents?bookingId=…    → list this customer's agents + pending drafts + recent runs
//   POST /api/admin-agents                → upsert an agent (create or update)
//        body: { id?, bookingId, name, channel?, description?, status?, config? }
//   DELETE /api/admin-agents              → archive (soft-delete) an agent
//        body: { id }

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ALLOWED_STATUS = ['building', 'live', 'paused', 'archived'];

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise(r => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); req.on('error', () => r({}));
  });
}

export default async function handler(req, res) {
  setAdminCors(req, res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'DB not configured' });

  if (req.method === 'GET') {
    const bookingId = String(req.query.bookingId || '');
    if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return res.status(400).json({ error: 'Invalid bookingId' });
    const [aR, dR, rR] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/agents?booking_id=eq.${bookingId}&order=created_at.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
      fetch(`${SUPABASE_URL}/rest/v1/agent_drafts?booking_id=eq.${bookingId}&status=eq.pending&select=id,agent_id,subject,recipient,created_at&order=created_at.desc&limit=50`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
      fetch(`${SUPABASE_URL}/rest/v1/agent_runs?booking_id=eq.${bookingId}&select=id,agent_id,action,outcome,hours_saved,created_at&order=created_at.desc&limit=50`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
    ]);
    return res.status(200).json({
      agents: aR.ok ? await aR.json() : [],
      pending_drafts: dR.ok ? await dR.json() : [],
      recent_runs: rR.ok ? await rR.json() : [],
    });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const bookingId = String(body.bookingId || '');
    if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return res.status(400).json({ error: 'Invalid bookingId' });
    const status = ALLOWED_STATUS.includes(body.status) ? body.status : 'building';
    const row = {
      booking_id: bookingId,
      name: String(body.name || '').slice(0, 200),
      channel: body.channel ? String(body.channel).slice(0, 60) : null,
      description: body.description ? String(body.description).slice(0, 1000) : null,
      status,
      config: body.config && typeof body.config === 'object' ? body.config : {},
      updated_at: new Date().toISOString(),
    };
    if (!row.name) return res.status(400).json({ error: 'name required' });

    let r;
    if (body.id && /^[0-9a-f-]{36}$/i.test(body.id)) {
      r = await fetch(`${SUPABASE_URL}/rest/v1/agents?id=eq.${body.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
    } else {
      r = await fetch(`${SUPABASE_URL}/rest/v1/agents`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
    }
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: 'DB write failed', detail: t.slice(0, 300) });
    }
    const out = await r.json();
    return res.status(200).json({ ok: true, agent: out?.[0] || null });
  }

  if (req.method === 'DELETE') {
    const body = await readJsonBody(req);
    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid id' });
    await fetch(`${SUPABASE_URL}/rest/v1/agents?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'archived', updated_at: new Date().toISOString() }),
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
