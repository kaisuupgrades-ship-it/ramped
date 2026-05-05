/**
 * HMAC-signed expiring tokens for public-by-link resources (customer portal,
 * roadmap pages). URL shape: /portal?id={uuid}&exp={unixSec}&t={base64urlHmac}
 *
 * MAP_LINK_SECRET must be 32+ random bytes hex. Without it, signer throws and
 * verifier returns false — fail closed.
 */

import crypto from "node:crypto";

const SECRET = process.env.MAP_LINK_SECRET;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function constantTimeEqualB64(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function isMapTokenConfigured(): boolean {
  return !!SECRET && SECRET.length >= 32;
}

export function signMapToken(id: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): { exp: number; t: string } {
  if (!isMapTokenConfigured()) throw new Error("MAP_LINK_SECRET not configured");
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const t = crypto.createHmac("sha256", SECRET as string).update(`${id}:${exp}`).digest("base64url");
  return { exp, t };
}

export function verifyMapToken(id: string, exp: string | number, t: string): boolean {
  if (!isMapTokenConfigured()) return false;
  if (!id || !exp || !t) return false;
  const expNum = typeof exp === "number" ? exp : parseInt(String(exp), 10);
  if (!Number.isFinite(expNum)) return false;
  if (expNum < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac("sha256", SECRET as string).update(`${id}:${expNum}`).digest("base64url");
  return constantTimeEqualB64(expected, String(t));
}
