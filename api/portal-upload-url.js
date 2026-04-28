// api/portal-upload-url.js — issues a short-lived signed upload URL for Supabase Storage.
// POST /api/portal-upload-url?id&exp&t   body: { category, filename, mime, size }
// Returns: { uploadUrl, storagePath, fileId } — frontend PUTs the file directly to uploadUrl.
//
// Auth: HMAC-signed portal token. Side-effect: inserts a row in onboarding_documents
// pointing at storagePath (status 'pending' until the upload completes — caller can hit
// /api/portal-upload-confirm to mark it complete, or we can rely on a Supabase Storage
// trigger). For MVP we trust the client to PUT successfully and surface errors back.

import { verifyMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_ONBOARDING_BUCKET || 'onboarding';
const MAX_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_CATEGORIES = ['logo', 'brand_voice', 'sample_emails', 'integrations', 'other'];
const ALLOWED_MIME = /^(image\/(png|jpe?g|gif|webp|svg\+xml)|application\/(pdf|zip|json|msword|vnd\.openxmlformats-officedocument\.[a-z]+)|text\/.+)$/i;

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise(r => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); req.on('error', () => r({}));
  });
}

function sanitize(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
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
  const category = ALLOWED_CATEGORIES.includes(body.category) ? body.category : 'other';
  const filename = sanitize(body.filename);
  const mime = String(body.mime || 'application/octet-stream');
  const size = parseInt(body.size, 10) || 0;
  if (size > MAX_BYTES) return res.status(413).json({ error: `File exceeds ${MAX_BYTES} bytes` });
  if (!ALLOWED_MIME.test(mime)) return res.status(415).json({ error: `Mime ${mime} not allowed` });

  const fileUuid = crypto.randomUUID();
  const storagePath = `${id}/${fileUuid}-${filename}`;

  // Ask Supabase Storage for a signed upload URL (PUT)
  const su = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${encodeURIComponent(storagePath)}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!su.ok) {
    const text = await su.text().catch(() => '');
    return res.status(500).json({ error: 'Could not sign upload URL', detail: text.slice(0, 200) });
  }
  const sj = await su.json();
  const uploadUrl = sj.url ? `${SUPABASE_URL}/storage/v1${sj.url}` : null;
  if (!uploadUrl) return res.status(500).json({ error: 'No signed URL returned' });

  // Pre-record the doc row so admin can see it even before upload completes.
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_documents`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ booking_id: id, category, filename, storage_path: storagePath, size_bytes: size, mime }),
  });
  const insArr = ins.ok ? await ins.json() : [];
  const fileId = insArr?.[0]?.id || null;

  return res.status(200).json({ uploadUrl, storagePath, fileId, token: sj.token || null });
}
