// api/admin-materials.js — admin internal materials library.
//
// CRUD for the /admin → Materials tab. Combines two sources in one feed:
//   1. REPO files — read-only, sourced from /materials.json (committed in git)
//   2. UPLOADS    — full CRUD, sourced from material_uploads (mig 008)
//                   File bytes live in Supabase Storage bucket `materials`
//                   (private — accessed via short-lived signed URLs).
//
// Routes:
//   GET    /api/admin-materials                   → unified list (repo + uploads)
//   POST   /api/admin-materials                   → init an upload, returns signed PUT URL
//                                                   body: { category, title, description, filename, mime, size_bytes }
//   PATCH  /api/admin-materials?id=…              → edit metadata (title, description, category)
//   DELETE /api/admin-materials?id=…              → remove file from storage + delete row
//   GET    /api/admin-materials?id=…&action=download → returns short-lived signed download URL
//
// All routes gated by isAuthorized() (admin Bearer token). The materials bucket
// must exist in Supabase Storage (see migration 008's operator notes).

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET       = process.env.MATERIALS_BUCKET || 'materials';

const ALLOWED_CATEGORIES = new Set(['strategy', 'audits', 'ops', 'design', 'other']);
const MAX_BYTES          = 25 * 1024 * 1024;  // 25 MB
const ALLOWED_MIME = /^(application\/(pdf|json|zip|msword|vnd\.(openxmlformats-officedocument\.[a-z]+|ms-excel|ms-powerpoint))|image\/(png|jpe?g|gif|webp|svg\+xml)|text\/(plain|markdown|csv))$/i;

// ── Type-pill inference (drives the colored badge in the UI) ───────────────
function pillFromMime(mime, filename) {
  const m = (mime || '').toLowerCase();
  const ext = (filename || '').toLowerCase().split('.').pop();
  if (m.includes('powerpoint') || ext === 'pptx' || ext === 'ppt')           return 'pptx';
  if (m.includes('pdf')        || ext === 'pdf')                              return 'pdf';
  if (m.includes('wordprocess')|| ext === 'docx' || ext === 'doc')            return 'docx';
  if (m.includes('spreadsheet')|| ext === 'xlsx' || ext === 'xls')            return 'xlsx';
  if (m.startsWith('image/')   || ['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  if (ext === 'md')                                                            return 'markdown';
  if (m.startsWith('text/'))                                                   return 'text';
  if (ext === 'json')                                                          return 'json';
  if (ext === 'zip')                                                           return 'zip';
  return 'file';
}

// ── Supabase REST helper ────────────────────────────────────────────────────
async function sb(method, path, body, prefer) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, data: text ? JSON.parse(text) : null };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise(r => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); req.on('error', () => r({}));
  });
}

function sanitize(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100);
}

// Read /materials.json from disk (committed in repo) and shape into the same
// envelope as upload rows so the UI can render them uniformly.
function loadRepoManifest() {
  try {
    // process.cwd() in Vercel functions points to the project root.
    const p = path.resolve(process.cwd(), 'materials.json');
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    const items = [];
    for (const cat of (data.categories || [])) {
      for (const it of (cat.items || [])) {
        items.push({
          source:      'repo',
          id:          'repo:' + (it.path || it.title),
          category:    cat.id || 'other',
          category_name: cat.name || cat.id,
          title:       it.title,
          description: it.description || null,
          filename:    (it.path || '').split('/').pop() || it.title,
          path:        it.path,                          // direct static URL
          type_pill:   it.type || pillFromMime(null, it.path),
          size_bytes:  it.size_kb ? it.size_kb * 1024 : null,
          updated_at:  it.updated || data.updated_at || null,
          editable:    false,                            // repo files are read-only
          deletable:   false,
        });
      }
    }
    return { ok: true, items };
  } catch (err) {
    console.warn('[admin-materials] could not read materials.json:', err.message);
    return { ok: false, items: [], error: err.message };
  }
}

// ── Main handler ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setAdminCors(req, res, 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS')             return res.status(200).end();
  if (!isAuthorized(req))                   return res.status(401).json({ error: 'Unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_KEY)       return res.status(503).json({ error: 'DB not configured' });

  const { id, action } = req.query;

  // ── DOWNLOAD: short-lived signed URL for an upload ────────────────────────
  if (req.method === 'GET' && id && action === 'download') {
    if (!/^[0-9a-f-]{36}$/i.test(String(id))) return res.status(400).json({ error: 'Invalid id' });
    const { ok, data } = await sb('GET', `/material_uploads?id=eq.${encodeURIComponent(id)}&select=storage_path,filename`);
    if (!ok || !data?.[0])                    return res.status(404).json({ error: 'Not found' });
    const { storage_path, filename } = data[0];
    const sr = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${encodeURIComponent(storage_path)}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 300 }),  // 5 min
    });
    if (!sr.ok)                                return res.status(500).json({ error: 'Could not sign download URL' });
    const sj = await sr.json();
    const url = sj.signedURL ? `${SUPABASE_URL}/storage/v1${sj.signedURL}` : (sj.url ? `${SUPABASE_URL}/storage/v1${sj.url}` : null);
    if (!url)                                  return res.status(500).json({ error: 'No signed URL returned' });
    return res.status(200).json({ url, filename, expiresIn: 300 });
  }

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const repo = loadRepoManifest();
    // Query uploads, but tolerate the table not existing yet (pre-migration 008).
    // PostgREST returns 404 (relation does not exist) or 400 in some cases when the
    // table is missing; we degrade to "repo items only" so the tab is useful immediately
    // after deploy, even before the operator runs the SQL migration.
    const upR  = await sb('GET', `/material_uploads?select=*&order=uploaded_at.desc&limit=500`);
    let uploads = [];
    let uploadsWarn = null;
    if (upR.ok) {
      uploads = (upR.data || []).map(u => ({
        source:      'upload',
        id:          u.id,
        category:    u.category,
        title:       u.title,
        description: u.description,
        filename:    u.filename,
        type_pill:   u.type_pill || pillFromMime(u.mime, u.filename),
        mime:        u.mime,
        size_bytes:  u.size_bytes,
        uploaded_at: u.uploaded_at,
        updated_at:  u.updated_at,
        editable:    true,
        deletable:   true,
      }));
    } else if (upR.status === 404 || upR.status === 400) {
      // Almost certainly: table material_uploads does not exist yet.
      uploadsWarn = 'material_uploads table not found — run db/migrations/008_admin_materials.sql to enable uploads.';
      console.warn('[admin-materials]', uploadsWarn, 'Supabase status:', upR.status);
    } else {
      // A genuine DB error (auth, connection, etc.) — surface it.
      return res.status(500).json({ error: 'DB read failed', detail: upR.status });
    }
    return res.status(200).json({
      ok: true,
      bucket: BUCKET,
      repo_ok: repo.ok,
      repo_count: repo.items.length,
      upload_count: uploads.length,
      uploads_warning: uploadsWarn,
      items: [...repo.items, ...uploads],
    });
  }

  // ── INIT UPLOAD: pre-create row + return a signed PUT URL ─────────────────
  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const category = ALLOWED_CATEGORIES.has(body.category) ? body.category : 'other';
    const title    = String(body.title || '').trim().slice(0, 200);
    const description = body.description ? String(body.description).trim().slice(0, 1000) : null;
    const filename = sanitize(body.filename);
    const mime     = String(body.mime || 'application/octet-stream');
    const sizeBytes= parseInt(body.size_bytes, 10) || 0;
    if (!title)                                return res.status(400).json({ error: 'title required' });
    if (!filename || filename === 'file')      return res.status(400).json({ error: 'filename required' });
    if (sizeBytes > MAX_BYTES)                 return res.status(413).json({ error: `File exceeds ${MAX_BYTES} bytes (25 MB)` });
    if (!ALLOWED_MIME.test(mime))              return res.status(415).json({ error: `Mime type ${mime} not allowed` });

    const fileUuid    = crypto.randomUUID();
    const storagePath = `${category}/${fileUuid}-${filename}`;

    // Ask Supabase Storage for a signed upload URL (PUT)
    const su = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${encodeURIComponent(storagePath)}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 600 }),
    });
    if (!su.ok) {
      const text = await su.text().catch(() => '');
      const hint = text.includes('not found') || su.status === 404
        ? `Bucket "${BUCKET}" missing — create it in Supabase Storage (private). See migration 008 operator notes.`
        : `Storage signed URL failed (${su.status})`;
      return res.status(503).json({ error: hint, detail: text.slice(0, 200) });
    }
    const sj = await su.json();
    const uploadUrl = sj.url ? `${SUPABASE_URL}/storage/v1${sj.url}` : null;
    if (!uploadUrl)                            return res.status(500).json({ error: 'No signed URL returned' });

    // Pre-record the row so the admin sees it even if the upload aborts.
    const ins = await sb('POST', '/material_uploads', {
      category, title, description, filename, storage_path: storagePath,
      mime, size_bytes: sizeBytes, type_pill: pillFromMime(mime, filename),
    }, 'return=representation');
    if (!ins.ok || !ins.data?.[0])             return res.status(500).json({ error: 'DB insert failed', detail: ins.status });

    return res.status(200).json({
      ok: true, id: ins.data[0].id, uploadUrl, storagePath, token: sj.token || null,
    });
  }

  // ── PATCH metadata ────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    if (!id || !/^[0-9a-f-]{36}$/i.test(String(id))) return res.status(400).json({ error: 'Invalid id' });
    const body = await readJsonBody(req);
    const patch = {};
    if (typeof body.title       === 'string') patch.title       = body.title.trim().slice(0, 200);
    if (typeof body.description === 'string') patch.description = body.description.trim().slice(0, 1000) || null;
    if (typeof body.category    === 'string' && ALLOWED_CATEGORIES.has(body.category)) patch.category = body.category;
    if (Object.keys(patch).length === 0)       return res.status(400).json({ error: 'No editable fields' });
    const r = await sb('PATCH', `/material_uploads?id=eq.${encodeURIComponent(id)}`, patch, 'return=representation');
    if (!r.ok)                                 return res.status(500).json({ error: 'Update failed', detail: r.status });
    if (!r.data?.[0])                          return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ ok: true, item: r.data[0] });
  }

  // ── DELETE: remove storage object then row ────────────────────────────────
  if (req.method === 'DELETE') {
    if (!id || !/^[0-9a-f-]{36}$/i.test(String(id))) return res.status(400).json({ error: 'Invalid id' });
    // Look up the storage path first
    const { ok, data } = await sb('GET', `/material_uploads?id=eq.${encodeURIComponent(id)}&select=storage_path`);
    if (!ok || !data?.[0])                     return res.status(404).json({ error: 'Not found' });
    const storage_path = data[0].storage_path;
    // Delete the storage object (best-effort — even if storage is gone we still
    // want to clean up the orphan row)
    try {
      await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(storage_path)}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
    } catch (err) {
      console.warn('[admin-materials] storage delete failed (continuing):', err.message);
    }
    // Now delete the row
    const dr = await fetch(`${SUPABASE_URL}/rest/v1/material_uploads?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=minimal' },
    });
    if (!dr.ok)                                return res.status(500).json({ error: 'DB delete failed', detail: dr.status });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
