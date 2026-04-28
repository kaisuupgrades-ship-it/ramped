// api/portal-approve-draft.js — customer approves / rejects / edits a queued draft.
// POST /api/portal-approve-draft?id&exp&t  body: { draftId, decision: 'approve'|'reject'|'edit', edited_body? }
//
// Auth: HMAC-signed portal token. Validates draftId belongs to this booking before mutating.

import { verifyMapToken, isMapTokenConfigured } from './_lib/map-token.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
  const draftId = String(body.draftId || '');
  if (!/^[0-9a-f-]{36}$/i.test(draftId)) return res.status(400).json({ error: 'Invalid draftId' });

  const decision = String(body.decision || '').toLowerCase();
  if (!['approve', 'reject', 'edit'].includes(decision)) return res.status(400).json({ error: 'Invalid decision' });

  // Validate ownership + load draft
  const dr = await fetch(`${SUPABASE_URL}/rest/v1/agent_drafts?id=eq.${draftId}&booking_id=eq.${id}&select=id,status,body`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const arr = dr.ok ? await dr.json() : [];
  const draft = arr[0];
  if (!draft) return res.status(404).json({ error: 'Draft not found for this booking' });
  if (draft.status !== 'pending') return res.status(409).json({ error: `Draft already ${draft.status}` });

  const patch = { decided_at: new Date().toISOString(), decided_by: 'customer' };
  if (decision === 'approve') patch.status = 'approved';
  if (decision === 'reject')  patch.status = 'rejected';
  if (decision === 'edit') {
    const editedBody = String(body.edited_body || '').slice(0, 16000);
    if (editedBody.length < 2) return res.status(400).json({ error: 'edited_body required for edit' });
    patch.status = 'edited';
    patch.body = editedBody;
  }

  const u = await fetch(`${SUPABASE_URL}/rest/v1/agent_drafts?id=eq.${draftId}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!u.ok) return res.status(500).json({ error: 'Update failed' });
  return res.status(200).json({ ok: true, status: patch.status });
}
