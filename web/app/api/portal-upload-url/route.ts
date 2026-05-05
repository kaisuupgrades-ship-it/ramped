import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { checkPortalToken } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/portal-upload-url?id&exp&t  body: { category, filename, mime, size }
 *
 * Issues a short-lived signed PUT URL into Supabase Storage and pre-records
 * the doc row so admin sees it even if the upload doesn't finish. Frontend
 * then uploads the file directly to the signed URL.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_ONBOARDING_BUCKET || "onboarding";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_CATEGORIES = ["logo", "brand_voice", "sample_emails", "integrations", "other"];
const ALLOWED_MIME = /^(image\/(png|jpe?g|gif|webp|svg\+xml)|application\/(pdf|zip|json|msword|vnd\.openxmlformats-officedocument\.[a-z]+)|text\/.+)$/i;

function sanitize(name: string): string {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

export async function POST(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  let body: { category?: string; filename?: string; mime?: string; size?: number | string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const category = ALLOWED_CATEGORIES.includes(body.category as string) ? body.category as string : "other";
  const filename = sanitize(String(body.filename || ""));
  const mime = String(body.mime || "application/octet-stream");
  const size = parseInt(String(body.size || 0), 10) || 0;

  if (size > MAX_BYTES) return NextResponse.json({ error: `File exceeds ${MAX_BYTES} bytes` }, { status: 413 });
  if (!ALLOWED_MIME.test(mime)) return NextResponse.json({ error: `Mime ${mime} not allowed` }, { status: 415 });

  const fileUuid = crypto.randomUUID();
  const storagePath = `${id}/${fileUuid}-${filename}`;

  const su = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${encodeURIComponent(storagePath)}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY as string, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!su.ok) {
    const text = await su.text().catch(() => "");
    return NextResponse.json({ error: "Could not sign upload URL", detail: text.slice(0, 200) }, { status: 500 });
  }
  const sj = await su.json() as { url?: string; token?: string };
  const uploadUrl = sj.url ? `${SUPABASE_URL}/storage/v1${sj.url}` : null;
  if (!uploadUrl) return NextResponse.json({ error: "No signed URL returned" }, { status: 500 });

  // Pre-record so admin can see the in-flight upload
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_documents`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY as string, Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: JSON.stringify({ booking_id: id, category, filename, storage_path: storagePath, size_bytes: size, mime }),
  });
  const insArr = ins.ok ? await ins.json() as Array<{ id: string }> : [];
  const fileId = insArr[0]?.id || null;

  return NextResponse.json({ uploadUrl, storagePath, fileId, token: sj.token || null });
}
