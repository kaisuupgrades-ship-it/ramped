/**
 * Scrape a company website to feed the deck-research pipeline.
 *
 * Strategy:
 *   1. Fetch the homepage (timeout 10s, polite UA)
 *   2. Parse out structured signals: meta description, og:* tags, h1/h2 text,
 *      visible body text (deduped), any /about, /services, /pricing links
 *   3. Follow up to 2 of those secondary links (about > services > pricing)
 *      so the extractor sees more than just hero copy
 *   4. Return a compact ScrapeResult with text + confidence hints
 *
 * Why DIY instead of cheerio: keeps the dep surface small. Site copy is mostly
 * HTML — a few hundred lines of regex + a tag-stripper covers 95% of B2B sites
 * without pulling in a parser. Misses heavy SPA/React-rendered sites — those
 * fall to "low confidence" which is the right user-facing signal.
 */

const UA = "Mozilla/5.0 (compatible; RampedAI-Prospect-Research/1.0; +https://www.30dayramp.com)";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 600_000;        // ~600 KB cap — bigger pages get truncated
const MAX_PAGES = 3;              // homepage + up to 2 secondary

export interface ScrapePage {
  url: string;
  status: number;
  title?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  headings: string[];
  bodyText: string;
}

export interface ScrapeResult {
  rootUrl: string;
  finalUrl: string;             // after redirects
  pages: ScrapePage[];
  errors: string[];
  hostsResolved: boolean;       // false if root URL didn't even respond
}

/** Polite fetch with timeout. Never throws — returns null on any failure. */
async function timedFetch(url: string): Promise<{ status: number; text: string; finalUrl: string } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    // Read at most MAX_BYTES — guard against absurdly large pages
    const reader = r.body?.getReader();
    if (!reader) {
      const text = await r.text();
      return { status: r.status, text: text.slice(0, MAX_BYTES), finalUrl: r.url };
    }
    let received = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.length;
      chunks.push(value);
      if (received > MAX_BYTES) break;
    }
    const text = new TextDecoder().decode(concat(chunks));
    return { status: r.status, text, finalUrl: r.url };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

/** Pull text content out of HTML while stripping scripts/styles/nav noise. */
function extractText(html: string): { headings: string[]; body: string; title?: string; meta?: string; ogTitle?: string; ogDesc?: string } {
  // strip non-content blocks
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  const title = (cleaned.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "").trim() || undefined;
  const meta = (cleaned.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] || "").trim() || undefined;
  const ogTitle = (cleaned.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] || "").trim() || undefined;
  const ogDesc = (cleaned.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] || "").trim() || undefined;

  // headings — h1/h2/h3, in order, deduped
  const headings: string[] = [];
  const seen = new Set<string>();
  const hMatch = [...cleaned.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  for (const m of hMatch) {
    const t = stripTags(m[2]).trim();
    if (!t || t.length > 200) continue;
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    headings.push(t);
    if (headings.length >= 40) break;
  }

  // body — strip all tags, collapse whitespace, dedupe lines
  const bodyRaw = stripTags(cleaned);
  const lines = bodyRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const dedup: string[] = [];
  const lineSeen = new Set<string>();
  for (const l of lines) {
    if (lineSeen.has(l)) continue;
    lineSeen.add(l);
    dedup.push(l);
  }
  const body = dedup.join("\n").slice(0, 12_000);  // hard cap on what we send to Claude

  return { headings, body, title, meta, ogTitle, ogDesc };
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ");
}

/** Find About/Services/Pricing-type links pointing to the same origin. */
function findSecondaryLinks(html: string, rootOrigin: string): string[] {
  const want = /(about|services?|what-we-do|pricing|approach|process|methodology|coaching|team|founder|story)/i;
  const links: string[] = [];
  const seen = new Set<string>();
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)];
  for (const m of matches) {
    let href = m[1].trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    // resolve relative
    try {
      const abs = new URL(href, rootOrigin).toString();
      const u = new URL(abs);
      if (u.origin !== rootOrigin) continue;       // only same origin
      if (!want.test(u.pathname + u.search)) continue;
      if (seen.has(u.toString())) continue;
      seen.add(u.toString());
      links.push(u.toString());
      if (links.length >= 6) break;
    } catch {
      continue;
    }
  }
  return links;
}

/** Normalize input — accept "portocol.com", "www.portocol.com", "https://www.portocol.com/", etc. */
export function normalizeCompanyUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  // strip leading @ (people sometimes type "@portocol.com")
  s = s.replace(/^@+/, "");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    // strip path/query for the scrape root
    return u.origin + "/";
  } catch {
    return null;
  }
}

/** Derive a likely company URL from an email address. Returns null for free providers. */
export function deriveUrlFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const m = String(email).trim().toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!m) return null;
  const domain = m[1];
  // free / generic providers — don't pretend they're the company URL
  const free = new Set([
    "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "icloud.com", "me.com", "aol.com", "msn.com", "live.com", "protonmail.com",
    "proton.me", "fastmail.com", "yandex.com", "zoho.com",
  ]);
  if (free.has(domain)) return null;
  return `https://${domain}/`;
}

/**
 * Main entry. Scrapes homepage + up to 2 secondary pages and returns a
 * structured result. Errors are accumulated, not thrown — caller decides
 * how to interpret a partial result.
 */
export async function scrapeCompany(rawUrl: string): Promise<ScrapeResult> {
  const normalized = normalizeCompanyUrl(rawUrl);
  const result: ScrapeResult = {
    rootUrl: rawUrl,
    finalUrl: normalized || rawUrl,
    pages: [],
    errors: [],
    hostsResolved: false,
  };
  if (!normalized) {
    result.errors.push(`URL could not be normalized: "${rawUrl}"`);
    return result;
  }

  // 1. Homepage
  const home = await timedFetch(normalized);
  if (!home) {
    result.errors.push(`Homepage fetch failed (timeout or network): ${normalized}`);
    return result;
  }
  result.hostsResolved = true;
  result.finalUrl = home.finalUrl;
  if (home.status >= 400) {
    result.errors.push(`Homepage returned HTTP ${home.status}`);
    // still try to extract from whatever HTML came back
  }
  const homeText = extractText(home.text);
  result.pages.push({
    url: home.finalUrl,
    status: home.status,
    title: homeText.title,
    metaDescription: homeText.meta,
    ogTitle: homeText.ogTitle,
    ogDescription: homeText.ogDesc,
    headings: homeText.headings,
    bodyText: homeText.body,
  });

  // 2. Secondary pages
  let rootOrigin: string;
  try {
    rootOrigin = new URL(home.finalUrl).origin;
  } catch {
    return result;
  }
  const secondaries = findSecondaryLinks(home.text, rootOrigin).slice(0, MAX_PAGES - 1);
  for (const link of secondaries) {
    const p = await timedFetch(link);
    if (!p) {
      result.errors.push(`Secondary fetch failed: ${link}`);
      continue;
    }
    if (p.status >= 400) continue;
    const parsed = extractText(p.text);
    result.pages.push({
      url: p.finalUrl,
      status: p.status,
      title: parsed.title,
      metaDescription: parsed.meta,
      ogTitle: parsed.ogTitle,
      ogDescription: parsed.ogDesc,
      headings: parsed.headings,
      bodyText: parsed.body,
    });
  }

  return result;
}

/**
 * Confidence heuristic based on how much usable signal came out of the scrape.
 * Used by the admin UI to flag low-confidence decks for review.
 */
export function scoreConfidence(scrape: ScrapeResult): "high" | "medium" | "low" {
  if (!scrape.hostsResolved) return "low";
  const totalBody = scrape.pages.reduce((s, p) => s + (p.bodyText?.length || 0), 0);
  const totalHeads = scrape.pages.reduce((s, p) => s + (p.headings?.length || 0), 0);
  if (totalBody >= 4000 && totalHeads >= 6 && scrape.pages.length >= 2) return "high";
  if (totalBody >= 1500 && totalHeads >= 3) return "medium";
  return "low";
}
