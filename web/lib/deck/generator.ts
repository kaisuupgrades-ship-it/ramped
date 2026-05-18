/**
 * Orchestrator — wires scraper + extractor + renderer + Supabase Storage
 * into a single "generate the deck for this booking" call.
 *
 * Idempotent: re-running on the same booking creates a new prospect_decks
 * row (so we keep a history of regenerations). The latest row wins in the
 * admin UI.
 *
 * Designed to be called either:
 *   - inline from POST /api/book (fire-and-forget, never blocks the user)
 *   - manually from POST /api/admin/decks/generate?bookingId=... (admin
 *     can re-run when the template changes or the first attempt was thin)
 */

import { supabaseRest } from "@/lib/supabase";
import { scrapeCompany, scoreConfidence, normalizeCompanyUrl, deriveUrlFromEmail } from "./scraper";
import { extractResearch, type BookingContext } from "./extractor";
import { renderProspectDeck, TEMPLATE_VERSION } from "./renderer";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = "prospect-decks";

interface BookingForGenerator {
  id: string;
  datetime: string;
  name: string;
  email: string;
  company: string;
  company_url: string | null;
  notes: string | null;
  tier: string | null;
  timezone: string | null;
}

interface GenerateResult {
  ok: boolean;
  deck_id?: string;
  storage_path?: string;
  status: "ready" | "failed";
  error?: string;
}

/** Resolve the URL we'll scrape, with source tag. */
function resolveCompanyUrl(b: BookingForGenerator): { url: string | null; source: "form" | "email_domain" | null } {
  const fromForm = normalizeCompanyUrl(b.company_url);
  if (fromForm) return { url: fromForm, source: "form" };
  const fromEmail = deriveUrlFromEmail(b.email);
  if (fromEmail) return { url: fromEmail, source: "email_domain" };
  return { url: null, source: null };
}

function formatCallDate(iso: string, tz?: string | null): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      timeZone: tz || "America/Denver",
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
}

async function fetchBooking(bookingId: string): Promise<BookingForGenerator | null> {
  const { ok, data } = await supabaseRest<BookingForGenerator[]>(
    "GET",
    `/bookings?id=eq.${bookingId}&select=id,datetime,name,email,company,company_url,notes,tier,timezone&limit=1`,
  );
  if (!ok || !data || data.length === 0) return null;
  return data[0];
}

async function insertDeckRow(payload: Record<string, unknown>): Promise<string | null> {
  const { ok, data } = await supabaseRest<Array<{ id: string }>>(
    "POST",
    "/prospect_decks",
    payload,
  );
  if (!ok || !data || data.length === 0) return null;
  return data[0].id;
}

async function updateDeckRow(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { ok } = await supabaseRest("PATCH", `/prospect_decks?id=eq.${id}`, patch);
  return ok;
}

/** Upload buffer to Storage via the Supabase Storage API. Returns the storage path or null. */
async function uploadDeck(bookingId: string, filename: string, buf: Buffer): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const path = `${bookingId}/${Date.now()}_${filename}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "x-upsert": "false",
    },
    // Wrap the Buffer in a Blob so it satisfies fetch's BodyInit type from
    // TS's web typings (Node Buffer + raw Uint8Array don't match even though
    // they work fine at runtime). The cast is required because TS's strict
    // ArrayBufferLike vs ArrayBuffer distinction trips Buffer/Uint8Array.
    body: new Blob([buf as unknown as BlobPart]),
  });
  if (!r.ok) {
    console.warn("[deck] storage upload failed", r.status, await r.text().catch(() => ""));
    return null;
  }
  return path;
}

/**
 * Main entry — generate the deck for one booking, end to end.
 *
 * Writes the prospect_decks row as it progresses through stages so the
 * admin UI shows live status. Catches every step's failure separately so
 * we know which stage broke without re-running everything.
 */
export async function generateDeckForBooking(bookingId: string): Promise<GenerateResult> {
  const log: Array<{ step: string; at: string; ok: boolean; detail?: unknown }> = [];
  const noteStep = (step: string, ok: boolean, detail?: unknown) => {
    log.push({ step, at: new Date().toISOString(), ok, ...(detail ? { detail } : {}) });
  };

  // 1. Load booking
  const booking = await fetchBooking(bookingId);
  if (!booking) {
    return { ok: false, status: "failed", error: `Booking ${bookingId} not found` };
  }
  noteStep("loaded_booking", true);

  // 2. Resolve URL
  const { url, source } = resolveCompanyUrl(booking);
  noteStep("resolved_url", !!url, { url, source });

  // 3. Insert pending row
  const deckId = await insertDeckRow({
    booking_id: bookingId,
    status: "researching",
    company_url: url,
    company_url_source: source,
    template_version: TEMPLATE_VERSION,
    generation_log: log,
  });
  if (!deckId) {
    return { ok: false, status: "failed", error: "Could not insert prospect_decks row" };
  }

  try {
    // 4. Scrape (only if we have a URL)
    let scrape;
    if (url) {
      scrape = await scrapeCompany(url);
      noteStep("scraped", scrape.hostsResolved, {
        pages: scrape.pages.length,
        errors: scrape.errors.length ? scrape.errors : undefined,
      });
    } else {
      scrape = { rootUrl: "", finalUrl: "", pages: [], errors: ["no_url_resolved"], hostsResolved: false };
      noteStep("scrape_skipped", false, { reason: "no_url" });
    }

    // 5. Confidence score before extraction (Jon knows what to expect)
    const confidence = scoreConfidence(scrape);
    noteStep("scored_confidence", true, { confidence });

    // 6. Extract structured research via Claude
    const ctx: BookingContext = {
      name: booking.name,
      email: booking.email,
      company: booking.company,
      notes: booking.notes ?? null,
      tier: booking.tier ?? null,
      datetime: booking.datetime,
    };
    const { research, extractor_log } = await extractResearch(scrape, ctx);
    noteStep("extracted", true, { extractor: extractor_log });

    await updateDeckRow(deckId, {
      status: "generating",
      research,
      research_confidence: confidence,
      generation_log: log,
    });

    // 7. Render the deck
    const callDate = formatCallDate(booking.datetime, booking.timezone);
    const buf = await renderProspectDeck({
      prospectName: booking.name,
      companyName: booking.company,
      callDate,
      research,
    });
    noteStep("rendered", true, { bytes: buf.length });

    // 8. Upload to storage
    const filename = `Ramped-${safeFilename(booking.company)}-${safeFilename(booking.name)}.pptx`;
    const storagePath = await uploadDeck(bookingId, filename, buf);
    if (!storagePath) {
      noteStep("uploaded", false);
      await updateDeckRow(deckId, {
        status: "failed",
        error_message: "Storage upload failed",
        generation_log: log,
      });
      return { ok: false, status: "failed", error: "Storage upload failed", deck_id: deckId };
    }
    noteStep("uploaded", true, { path: storagePath });

    // 9. Mark ready
    await updateDeckRow(deckId, {
      status: "ready",
      deck_storage_path: storagePath,
      deck_filename: filename,
      generation_log: log,
      error_message: null,
    });

    return { ok: true, status: "ready", deck_id: deckId, storage_path: storagePath };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    noteStep("pipeline_threw", false, { error: msg });
    await updateDeckRow(deckId, {
      status: "failed",
      error_message: msg,
      generation_log: log,
    });
    return { ok: false, status: "failed", error: msg, deck_id: deckId };
  }
}

/**
 * Generate a short-lived signed URL for the admin to download the deck.
 * Used by the admin UI's download button. Returns null if the deck isn't
 * stored or signing fails.
 */
export async function signDeckDownloadUrl(storagePath: string, expiresSec = 300): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY || !storagePath) return null;
  const r = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresSec }),
    },
  );
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as { signedURL?: string; signedUrl?: string } | null;
  const rel = j?.signedURL || j?.signedUrl;
  if (!rel) return null;
  return `${SUPABASE_URL}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}`;
}
