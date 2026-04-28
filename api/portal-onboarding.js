// api/portal-onboarding.js — customer onboarding form (post-payment).
//   GET  /api/portal-onboarding?id&exp&t       → returns onboarding_data + uploaded docs
//   POST /api/portal-onboarding?id&exp&t       → save onboarding_data fields
//        body: { brand_voice_notes, forbidden_phrases, escalation_triggers, signoff_style, integrations_notes, complete? }
//
// Auth: HMAC-signed portal token.

import { verifyMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { notifyOnboardingCompleted } from './_lib/notify.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL     = process.env.SITE_URL || 'https://www.30dayramp.com';
const FIELD_MAX = 4000;

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise(r => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); req.on('error', () => r({}));
  });
}

const ALLOWED_FIELDS = ['brand_voice_notes', 'forbidden_phrases', 'escalation_triggers', 'signoff_style', 'integrations_notes', 'sample_email_link'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, exp, t } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid ID' });
  if (!isMapTokenConfigured())             return res.status(503).json({ error: 'Token signing not configured' });
  if (!verifyMapToken(id, exp, t))         return res.status(403).json({ error: 'Invalid or expired token' });
  if (!SUPABASE_URL || !SUPABASE_KEY)      return res.status(503).json({ error: 'DB not configured' });

  if (req.method === 'GET') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=onboarding_data,onboarding_completed_at,payment_status,name`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const arr = r.ok ? await r.json() : [];
    const b = arr[0];
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    const dr = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_documents?booking_id=eq.${encodeURIComponent(id)}&select=id,category,filename,size_bytes,mime,uploaded_at&order=uploaded_at.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const docs = dr.ok ? await dr.json() : [];
    return res.status(200).json({
      onboarding_data: b.onboarding_data || {},
      onboarding_completed_at: b.onboarding_completed_at || null,
      payment_status: b.payment_status || null,
      documents: docs,
    });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const data = {};
    for (const k of ALLOWED_FIELDS) {
      if (typeof body[k] === 'string') data[k] = body[k].slice(0, FIELD_MAX);
    }
    const complete = !!body.complete;
    const patch = {
      onboarding_data: data,
      ...(complete ? { onboarding_completed_at: new Date().toISOString() } : {}),
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) return res.status(500).json({ error: 'DB write failed' });
    if (complete) {
      const arr = await r.json().catch(() => []);
      const b = arr?.[0];
      notifyOnboardingCompleted({ name: b?.name, email: b?.email, bookingId: id, siteUrl: SITE_URL }).catch(() => {});
    }
    return res.status(200).json({ ok: true, complete });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
