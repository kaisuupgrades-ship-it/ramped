// tests/lib/portal-token.js — generates HMAC-signed portal/roadmap tokens.
//
// Mirrors the algorithm in api/_lib/map-token.js so portal tests can fabricate
// tokens locally without round-tripping through /api/book or admin to mint one.
// Requires MAP_LINK_SECRET env var (same as production).

const crypto = require('crypto');

function signMapToken(id, ttlSeconds) {
  const secret = process.env.MAP_LINK_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('MAP_LINK_SECRET env var required for portal-token tests (>= 32 chars)');
  }
  ttlSeconds = ttlSeconds || (60 * 60 * 24 * 30); // default 30d
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const t = crypto.createHmac('sha256', secret).update(String(id) + ':' + String(exp)).digest('base64url');
  return { exp, t };
}

function portalUrl(baseUrl, bookingId, ttlSeconds) {
  const { exp, t } = signMapToken(bookingId, ttlSeconds || 60 * 60 * 24 * 90);
  return `${baseUrl}/portal?id=${bookingId}&exp=${exp}&t=${encodeURIComponent(t)}`;
}

function roadmapUrl(baseUrl, bookingId, ttlSeconds) {
  const { exp, t } = signMapToken(bookingId, ttlSeconds || 60 * 60 * 24 * 30);
  return `${baseUrl}/roadmap?id=${bookingId}&exp=${exp}&t=${encodeURIComponent(t)}`;
}

function mapUrl(baseUrl, bookingId, ttlSeconds) {
  const { exp, t } = signMapToken(bookingId, ttlSeconds || 60 * 60 * 24 * 30);
  return `${baseUrl}/api/get-map?id=${bookingId}&exp=${exp}&t=${encodeURIComponent(t)}`;
}

module.exports = { signMapToken, portalUrl, roadmapUrl, mapUrl };
