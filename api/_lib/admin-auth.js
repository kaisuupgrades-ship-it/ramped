// api/_lib/admin-auth.js — Admin endpoint helpers.
// Centralises CORS allowlist + token verification so every admin endpoint
// enforces the same rules.

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Explicit allowlist only — regex matching *.vercel.app would allow any
// preview deployment from any Vercel account to hit admin APIs.
const ALLOWED_ORIGINS = [
  'https://30dayramp.com',
  'https://www.30dayramp.com',
  'https://ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app',
  'http://localhost:3000',
];

export function setAdminCors(req, res, methods) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  // NOTE: Authorization must be in allowed headers so the browser can send it on
  // cross-origin fetches.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Timing-safe string compare — prevents lexical timing attacks on the token.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// Prefer Authorization: Bearer <token> header. Fall back to ?token= for
// legacy bookmarks, but the admin UI no longer uses the query param.
export function extractToken(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (auth && typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  // Backwards-compat fallback — marked deprecated in the admin UI.
  const qt = req.query && req.query.token;
  return qt ? String(qt) : '';
}

// Returns true iff the request carries a valid admin token.
// Does NOT send an error response — callers decide the status/body.
export function isAuthorized(req) {
  if (!ADMIN_TOKEN) return false;
  const presented = extractToken(req);
  if (!presented) return false;
  return safeEqual(presented, ADMIN_TOKEN);
}
