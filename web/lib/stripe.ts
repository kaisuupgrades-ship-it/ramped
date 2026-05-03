/**
 * Stripe webhook signature verification — HMAC-SHA256 with timestamp tolerance.
 * Implements https://stripe.com/docs/webhooks/signatures without the SDK.
 *
 * Header format: t=<unix>,v1=<hmac>,v0=<hmac>
 */

import crypto from "node:crypto";

export function verifyStripeSignature({
  rawBody,
  signatureHeader,
  secret,
  toleranceSeconds = 300,
}: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds?: number;
}): boolean {
  if (!rawBody || !signatureHeader || !secret) return false;
  const parts = String(signatureHeader).split(",").map((s) => s.trim());
  const tsStr = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!tsStr || !v1.length) return false;
  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return false;
  const signedPayload = `${ts}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return v1.some((sig) => {
    if (sig.length !== expected.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}
