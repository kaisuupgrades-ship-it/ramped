// api/_lib/map-token.js — HMAC-signed expiring tokens for public-by-link resources
// Used by /api/get-map and /api/get-roadmap so prospect/customer URLs aren't bare UUIDs.
//
// URL shape:  /map/{id}?exp=<unixSeconds>&t=<base64urlHmac>
// Verifier:   verifyMapToken(id, exp, t)  → returns true if HMAC matches and exp is in the future.
// Signer:     signMapToken(id, ttlSeconds=2592000) → returns { exp, t } for embedding in emails.
//
// Required env: MAP_LINK_SECRET (32+ random bytes hex). If missing the verifier returns false
// (fail closed) and the signer throws.

import crypto from 'crypto';

const SECRET = process.env.MAP_LINK_SECRET;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — long enough that emailed links work but not forever

function constantTimeEqualB64(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (_) {
    return false;
  }
}

export function isMapTokenConfigured() {
  return !!SECRET && SECRET.length >= 32;
}

export function signMapToken(id, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!isMapTokenConfigured()) {
    throw new Error('MAP_LINK_SECRET not configured');
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const t = crypto
    .createHmac('sha256', SECRET)
    .update(String(id) + ':' + String(exp))
    .digest('base64url');
  return { exp, t };
}

export function verifyMapToken(id, exp, t) {
  if (!isMapTokenConfigured()) return false;
  if (!id || !exp || !t) return false;
  const expNum = parseInt(String(exp), 10);
  if (!Number.isFinite(expNum)) return false;
  if (expNum < Math.floor(Date.now() / 1000)) return false; // expired
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(String(id) + ':' + String(expNum))
    .digest('base64url');
  return constantTimeEqualB64(expected, String(t));
}
