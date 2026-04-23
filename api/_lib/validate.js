// api/_lib/validate.js — Shared input validation & output escaping helpers.
// Centralises defences against: HTML injection in email templates, past-time
// bookings, garbage emails, over-long free-text, and per-IP flood.

// ── HTML escape ──────────────────────────────────────────────────────────────
// Use for every piece of user-supplied content interpolated into HTML (emails,
// admin UI, etc.). Returns '' for nullish.
export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Email validation ─────────────────────────────────────────────────────────
// Conservative regex + reject common "throwaway" TLDs that exist only to fail
// delivery (example.invalid, .test, .example per RFC 2606, plus "localhost").
const EMAIL_RE = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i;
const BAD_TLDS = new Set(['invalid', 'test', 'example', 'localhost', 'local']);
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  if (!EMAIL_RE.test(trimmed)) return false;
  const tld = trimmed.split('.').pop().toLowerCase();
  if (BAD_TLDS.has(tld)) return false;
  const domain = trimmed.split('@')[1].toLowerCase();
  if (domain === 'example.com' || domain === 'example.org' || domain === 'example.net') return false;
  return true;
}

// ── Future-time validation ───────────────────────────────────────────────────
// Require bookings to be at least `minLeadMs` in the future (default 15 min).
export function isFuture(datetime, minLeadMs = 15 * 60_000) {
  const t = new Date(datetime).getTime();
  if (!Number.isFinite(t)) return false;
  return t > Date.now() + minLeadMs;
}

// ── Truncate free-text ───────────────────────────────────────────────────────
export function truncate(s, max = 2000) {
  if (s === null || s === undefined) return '';
  const str = String(s);
  return str.length > max ? str.slice(0, max) : str;
}

// ── Per-IP rate limit (in-memory, best-effort) ───────────────────────────────
// Not durable across serverless cold starts, but blocks same-instance floods.
// For production multi-region, pair with an edge rate-limit rule or KV store.
const buckets = new Map(); // ip → { count, resetAt }
export function checkRateLimit(ip, { max = 5, windowMs = 60_000 } = {}) {
  if (!ip) return { ok: true, remaining: max };
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(ip, b);
  }
  b.count += 1;
  // Opportunistic cleanup — prevents unbounded growth
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }
  return { ok: b.count <= max, remaining: Math.max(0, max - b.count), resetAt: b.resetAt };
}

export function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
}
