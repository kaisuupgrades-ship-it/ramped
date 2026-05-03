/**
 * Vercel Cron auto-attaches `Authorization: Bearer ${CRON_SECRET}` to scheduled
 * invocations when CRON_SECRET is set as a project env var. Anything else (a
 * manual GET, an attacker probing the endpoint) gets rejected.
 *
 * Fail-closed: if CRON_SECRET isn't set, NO request is authorized — even one
 * with a matching empty string. Generate with: openssl rand -hex 32
 */

const CRON_SECRET = process.env.CRON_SECRET;

export function isCronConfigured(): boolean {
  return !!CRON_SECRET && CRON_SECRET.length >= 16;
}

function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function isCronAuthorized(req: Request): boolean {
  if (!isCronConfigured()) return false;
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  return safeEqual(m[1].trim(), CRON_SECRET as string);
}
