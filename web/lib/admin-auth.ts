/**
 * Admin endpoint helpers — bearer-token auth against ADMIN_TOKEN env var.
 *
 * Same contract as legacy api/_lib/admin-auth.js: timing-safe compare, Bearer
 * header only (no `?token=` query fallback — tokens in URLs leak via logs,
 * Referer, screenshots, screen-sharing).
 */

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export function isAdminConfigured(): boolean {
  return !!ADMIN_TOKEN && ADMIN_TOKEN.length >= 16;
}

function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function extractBearer(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export function isAdminAuthorized(req: Request): boolean {
  if (!isAdminConfigured()) return false;
  const presented = extractBearer(req);
  if (!presented) return false;
  return safeEqual(presented, ADMIN_TOKEN as string);
}
