// api/_lib/validate.js - Shared input validation & output escaping helpers.

export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

export function isFuture(datetime, minLeadMs = 15 * 60_000) {
  const t = new Date(datetime).getTime();
  if (!Number.isFinite(t)) return false;
  return t > Date.now() + minLeadMs;
}

export function isWithinBookingWindow(datetime, maxAheadDays = 90) {
  const t = new Date(datetime).getTime();
  if (!Number.isFinite(t)) return false;
  const maxMs = maxAheadDays * 24 * 60 * 60 * 1000;
  return t <= Date.now() + maxMs;
}

export function isBusinessHours(datetime, tz = 'America/Chicago') {
  const d = new Date(datetime);
  if (!Number.isFinite(d.getTime())) return { ok: false, reason: 'Invalid date.' };
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const wd = parts.find(p => p.type === 'weekday')?.value;
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value, 10);
  const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(wd);
  if (!isWeekday) return { ok: false, reason: 'Please choose a weekday.' };
  if (!(hour >= 8 && hour < 18)) {
    return { ok: false, reason: 'Please choose a time between 8am and 6pm Central.' };
  }
  return { ok: true };
}

export function truncate(s, max = 2000) {
  if (s === null || s === undefined) return '';
  const str = String(s);
  return str.length > max ? str.slice(0, max) : str;
}

const buckets = new Map();
export function checkRateLimit(ip, { max = 5, windowMs = 60_000 } = {}) {
  if (!ip) return { ok: true, remaining: max };
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(ip, b);
  }
  b.count += 1;
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

