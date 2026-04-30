// api/_lib/audit-log.js — forensic trail for admin mutations (audit M2-6).
//
// Best-effort: every destructive admin endpoint calls logAdminAction() AFTER
// completing the mutation. If logging fails we never block the response — we
// just console.warn the failure. The schema is in migration 010.
//
// Usage:
//   import { logAdminAction } from './_lib/audit-log.js';
//   await logAdminAction(req, {
//     action: 'booking.delete',
//     target_table: 'bookings',
//     target_id: bookingId,
//     payload: { reason },
//     result_status: 200,
//   });
//
// What gets logged:
//   - action verb + target table + target id
//   - hashed actor (sha256 of admin token + IP_HASH_SALT)
//   - hashed actor IP (sha256 of remote IP + IP_HASH_SALT)
//   - arbitrary payload (before/after diff, reason, etc.)
//   - HTTP status returned
//   - created_at (server-side)
//
// We never store raw bearer tokens or raw IPs.

import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const IP_SALT      = process.env.IP_HASH_SALT || 'ramped-default-salt-rotate-me';

function hashWithSalt(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value) + ':' + IP_SALT).digest('hex').slice(0, 32);
}

function extractActorHash(req) {
  // Use the authorization header value (if present) as the actor identity.
  // Hashed with salt — never store raw token.
  const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? hashWithSalt(m[1].trim()) : null;
}

function extractIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || null;
}

export async function logAdminAction(req, fields) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  const row = {
    action:        String(fields.action || 'unknown').slice(0, 80),
    target_table:  fields.target_table ? String(fields.target_table).slice(0, 80) : null,
    target_id:     fields.target_id ? String(fields.target_id).slice(0, 120) : null,
    actor_hash:    extractActorHash(req),
    actor_ip_hash: hashWithSalt(extractIp(req)),
    payload:       (fields.payload && typeof fields.payload === 'object') ? fields.payload : {},
    result_status: typeof fields.result_status === 'number' ? fields.result_status : null,
  };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_audit_log`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!r.ok && r.status !== 201) {
      const text = await r.text().catch(() => '');
      // Tolerate the table not existing yet (pre-migration 010) — log a warning,
      // don't block the response.
      if (r.status === 404 || r.status === 400) {
        console.warn('[audit-log] admin_audit_log table not found — run db/migrations/010_admin_audit_log.sql to enable. (status', r.status + ')');
      } else {
        console.warn('[audit-log] insert failed:', r.status, text.slice(0, 200));
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[audit-log] error:', err.message);
    return false;
  }
}
