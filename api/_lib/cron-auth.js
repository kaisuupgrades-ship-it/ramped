// api/_lib/cron-auth.js — shared cron-endpoint authentication helper.
//
// Vercel Cron auto-attaches `Authorization: Bearer ${CRON_SECRET}` to every
// scheduled invocation when CRON_SECRET is set as a project env var. This helper
// performs a timing-safe bearer-token compare. Endpoints that previously trusted
// `User-Agent: vercel-cron/...` are vulnerable — UA is client-controlled.
//
// Usage:
//   import { isCronAuthorized } from './_lib/cron-auth.js';
//   if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
//
// Env: CRON_SECRET — high-entropy string. Generate with: openssl rand -hex 32

const CRON_SECRET = process.env.CRON_SECRET;

export function isCronConfigured() {
  return !!CRON_SECRET && CRON_SECRET.length >= 16;
}

// Timing-safe equality. Avoids std `===` early-exit timing leak.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function isCronAuthorized(req) {
  if (!isCronConfigured()) return false; // fail closed — no secret, no entry
  const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  return safeEqual(m[1].trim(), CRON_SECRET);
}
