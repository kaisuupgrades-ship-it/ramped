import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { supabaseRest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin internal materials library.
 *
 * GET    /api/admin-materials                              → unified list (repo + uploads)
 * POST   /api/admin-materials                              → init upload, returns signed PUT URL
 *        body: { category, title, description, filename, mime, size_bytes }
 * PATCH  /api/admin-materials?id=…                         → edit metadata
 * DELETE /api/admin-materials?id=…                         → remove file + row
 * GET    /api/admin-materials?id=…&action=download         → short-lived signed download URL
 *
 * Two sources merged in the list:
 *   1. REPO files — read-only, sourced from /materials.json (committed in git)
 *   2. UPLOADS    — full CRUD, sourced from material_uploads (mig 008)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.MATERIALS_BUCKET || "materials";
const ALLOWED_CATEGORIES = new Set(["strategy", "audits", "ops", "design", "sales", "marketing", "other"]);
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = /^(application\/(pdf|json|zip|msword|vnd\.(openxmlformats-officedocument\.[a-z]+|ms-excel|ms-powerpoint))|image\/(png|jpe?g|gif|webp|svg\+xml)|text\/(plain|markdown|csv))$/i;

function pillFromMime(mime: string | null, filename: string | null): string {
  const m = (mime || "").toLowerCase();
  const ext = (filename || "").toLowerCase().split(".").pop() || "";
  if (m.includes("powerpoint") || ext === "pptx" || ext === "ppt") return "pptx";
  if (m.includes("pdf") || ext === "pdf") return "pdf";
  if (m.includes("wordprocess") || ext === "docx" || ext === "doc") return "docx";
  if (m.includes("spreadsheet") || ext === "xlsx" || ext === "xls") return "xlsx";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  if (ext === "md") return "markdown";
  if (m.startsWith("text/")) return "text";
  if (ext === "json") return "json";
  if (ext === "zip") return "zip";
  return "file";
}

function sanitize(name: string): string {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100);
}

interface RepoItem {
  source: "repo"; id: string; category: string; category_name: string;
  title: string; description: string | null; filename: string; path: string;
  type_pill: string; size_bytes: number | null; updated_at: string | null;
  editable: false; deletable: false;
}

interface ManifestEntry { title: string; path: string; description?: string; type?: string; size_kb?: number; updated?: string }
interface ManifestCategory { id?: string; name?: string; items?: ManifestEntry[] }
interface Manifest { categories?: ManifestCategory[]; updated_at?: string }

function loadRepoManifest(): { ok: boolean; items: RepoItem[]; error?: string } {
  try {
    const p = path.resolve(process.cwd(), "materials.json");
    const raw = fs.readFileSync(p, "utf8");
    const data = JSON.parse(raw) as Manifest;
    const items: RepoItem[] = [];
    for (const cat of data.categories || []) {
      for (const it of cat.items || []) {
        items.push({
          source: "repo",
          id: "repo:" + (it.path || it.title),
          category: cat.id || "other",
          category_name: cat.name || cat.id || "other",
          title: it.title,
          description: it.description || null,
          filename: (it.path || "").split("/").pop() || it.title,
          path: it.path,
          type_pill: it.type || pillFromMime(null, it.path),
          size_bytes: it.size_kb ? it.size_kb * 1024 : null,
          updated_at: it.updated || data.updated_at || null,
          editable: false, deletable: false,
        });
      }
    }
    return { ok: true, items };
  } catch (err) {
    console.warn("[admin-materials] could not read materials.json:", (err as Error).message);
    return { ok: false, items: [], error: (err as Error).message };
  }
}

interface UploadRow {
  id: string; category: string; title: string; description: string | null;
  filename: string; storage_path: string; mime: string; size_bytes: number;
  type_pill: string | null; uploaded_at: string; updated_at: string;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const action = searchParams.get("action");

  // DOWNLOAD signed URL
  if (id && action === "download") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const r = await supabaseRest<{ storage_path: string; filename: string }[]>("GET",
      `/material_uploads?id=eq.${encodeURIComponent(id)}&select=storage_path,filename`);
    const row = (r.ok && Array.isArray(r.data)) ? r.data[0] : null;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sr = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${encodeURIComponent(row.storage_path)}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 300 }),
    });
    if (!sr.ok) return NextResponse.json({ error: "Could not sign download URL" }, { status: 500 });
    const sj = await sr.json() as { signedURL?: string; url?: string };
    const url = sj.signedURL ? `${SUPABASE_URL}/storage/v1${sj.signedURL}` : (sj.url ? `${SUPABASE_URL}/storage/v1${sj.url}` : null);
    if (!url) return NextResponse.json({ error: "No signed URL returned" }, { status: 500 });
    return NextResponse.json({ url, filename: row.filename, expiresIn: 300 });
  }

  // LIST
  const repo = loadRepoManifest();
  const upR = await supabaseRest<UploadRow[]>("GET", "/material_uploads?select=*&order=uploaded_at.desc&limit=500");
  let uploads: Array<RepoItem | (Omit<UploadRow, never> & { source: "upload"; type_pill: string; editable: true; deletable: true })> = [];
  let uploadsWarn: string | null = null;
  if (upR.ok && Array.isArray(upR.data)) {
    uploads = upR.data.map((u) => ({
      source: "upload" as const,
      id: u.id, category: u.category, title: u.title, description: u.description,
      filename: u.filename, storage_path: u.storage_path,
      type_pill: u.type_pill || pillFromMime(u.mime, u.filename),
      mime: u.mime, size_bytes: u.size_bytes,
      uploaded_at: u.uploaded_at, updated_at: u.updated_at,
      editable: true, deletable: true,
    }));
  } else if (upR.status === 404 || upR.status === 400) {
    uploadsWarn = "material_uploads table not found — run db/migrations/008_admin_materials.sql to enable uploads.";
    console.warn("[admin-materials]", uploadsWarn, "Supabase status:", upR.status);
  } else {
    return NextResponse.json({ error: "DB read failed", detail: upR.status }, { status: 500 });
  }

  return NextResponse.json({
    ok: true, bucket: BUCKET,
    repo_ok: repo.ok, repo_count: repo.items.length,
    upload_count: uploads.length, uploads_warning: uploadsWarn,
    items: [...repo.items, ...uploads],
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  let body: { category?: string; title?: string; description?: string; filename?: string; mime?: string; size_bytes?: number | string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const category = ALLOWED_CATEGORIES.has(body.category as string) ? body.category as string : "other";
  const title = String(body.title || "").trim().slice(0, 200);
  const description = body.description ? String(body.description).trim().slice(0, 1000) : null;
  const filename = sanitize(String(body.filename || ""));
  const mime = String(body.mime || "application/octet-stream");
  const sizeBytes = parseInt(String(body.size_bytes || 0), 10) || 0;

  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!filename || filename === "file") return NextResponse.json({ error: "filename required" }, { status: 400 });
  if (sizeBytes > MAX_BYTES) return NextResponse.json({ error: `File exceeds ${MAX_BYTES} bytes (25 MB)` }, { status: 413 });
  if (!ALLOWED_MIME.test(mime)) return NextResponse.json({ error: `Mime type ${mime} not allowed` }, { status: 415 });

  const fileUuid = crypto.randomUUID();
  const storagePath = `${category}/${fileUuid}-${filename}`;

  const su = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${encodeURIComponent(storagePath)}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!su.ok) {
    const text = await su.text().catch(() => "");
    const hint = text.includes("not found") || su.status === 404
      ? `Bucket "${BUCKET}" missing — create it in Supabase Storage (private). See migration 008 operator notes.`
      : `Storage signed URL failed (${su.status})`;
    return NextResponse.json({ error: hint, detail: text.slice(0, 200) }, { status: 503 });
  }
  const sj = await su.json() as { url?: string; token?: string };
  const uploadUrl = sj.url ? `${SUPABASE_URL}/storage/v1${sj.url}` : null;
  if (!uploadUrl) return NextResponse.json({ error: "No signed URL returned" }, { status: 500 });

  const ins = await supabaseRest<Array<{ id: string }>>("POST", "/material_uploads", {
    category, title, description, filename, storage_path: storagePath,
    mime, size_bytes: sizeBytes, type_pill: pillFromMime(mime, filename),
  });
  if (!ins.ok || !Array.isArray(ins.data) || !ins.data[0]) {
    return NextResponse.json({ error: "DB insert failed", detail: ins.status }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: ins.data[0].id, uploadUrl, storagePath, token: sj.token || null });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: { title?: string; description?: string; category?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 200);
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 1000) || null;
  if (typeof body.category === "string" && ALLOWED_CATEGORIES.has(body.category)) patch.category = body.category;

  if (!Object.keys(patch).length) return NextResponse.json({ error: "No editable fields" }, { status: 400 });

  const r = await supabaseRest<UploadRow[]>("PATCH", `/material_uploads?id=eq.${encodeURIComponent(id)}`, patch);
  if (!r.ok) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  if (!Array.isArray(r.data) || !r.data[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, item: r.data[0] });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const lookup = await supabaseRest<{ storage_path: string }[]>("GET",
    `/material_uploads?id=eq.${encodeURIComponent(id)}&select=storage_path`);
  const row = (lookup.ok && Array.isArray(lookup.data)) ? lookup.data[0] : null;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Best-effort storage delete; orphan-row cleanup proceeds regardless
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(row.storage_path)}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
  } catch (err) {
    console.warn("[admin-materials] storage delete failed (continuing):", (err as Error).message);
  }

  const dr = await supabaseRest("DELETE", `/material_uploads?id=eq.${encodeURIComponent(id)}`);
  if (!dr.ok) return NextResponse.json({ error: "DB delete failed", detail: dr.status }, { status: 500 });
  return NextResponse.json({ ok: true });
}
