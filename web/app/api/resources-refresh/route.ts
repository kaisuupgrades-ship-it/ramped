import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/resources-refresh
 *
 * Cron-driven RSS scraper. Pulls 5 AI-news feeds, parses items, and upserts
 * into ai_resources via PostgREST `Prefer: resolution=merge-duplicates`. The
 * URL is the unique key.
 *
 * Auth: header `x-refresh-secret: $CRON_SECRET` (matches legacy contract; we
 * accept the same shape so existing cron triggers don't need updating).
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

interface RssSource { name: string; url: string }
const RSS_SOURCES: RssSource[] = [
  { name: "Anthropic", url: "https://www.anthropic.com/rss.xml" },
  { name: "OpenAI", url: "https://openai.com/news/rss.xml" },
  { name: "DeepMind", url: "https://deepmind.google/blog/rss.xml" },
  { name: "The Batch", url: "https://www.deeplearning.ai/the-batch/feed/" },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" },
];

interface ResourceItem {
  id: string; title: string; url: string; source: string;
  summary: string | null; published_at: string | null; fetched_at: string;
}

function extractTag(xml: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, "i");
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(re);
  return match ? match[1].trim() : "";
}

function parseItems(xml: string, sourceName: string): ResourceItem[] {
  const items: ResourceItem[] = [];
  const parts = xml.split(/<item[\s>]/i);
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const title = extractTag(chunk, "title");
    const link = extractTag(chunk, "link") || extractTag(chunk, "guid");
    const pubDate = extractTag(chunk, "pubDate") || extractTag(chunk, "dc:date") || extractTag(chunk, "published");
    const desc = extractTag(chunk, "description") || extractTag(chunk, "content:encoded") || extractTag(chunk, "summary");

    if (!link || !title) continue;

    const summaryText = desc.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim().slice(0, 280);
    const summary = summaryText || null;

    if (sourceName === "MIT Tech Review") {
      const combined = (title + " " + (summary || "")).toLowerCase();
      const aiKeywords = ["ai", "artificial intelligence", "machine learning", "llm", "gpt", "neural", "deep learning", "chatbot", "robot", "openai", "anthropic", "gemini", "model"];
      if (!aiKeywords.some((kw) => combined.includes(kw))) continue;
    }

    let publishedAt: string | null = null;
    if (pubDate) {
      const d = new Date(pubDate);
      if (!isNaN(d.getTime())) publishedAt = d.toISOString();
    }

    items.push({
      id: link, title: title.slice(0, 400), url: link, source: sourceName,
      summary, published_at: publishedAt, fetched_at: new Date().toISOString(),
    });
  }
  return items;
}

async function fetchFeed(source: RssSource): Promise<ResourceItem[]> {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "RampedAI-RSS-Reader/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`Feed ${source.name} returned ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseItems(xml, source.name);
  } catch (err) {
    console.warn(`Failed to fetch ${source.name}:`, (err as Error).message);
    return [];
  }
}

async function upsertItems(items: ResourceItem[]): Promise<number> {
  if (!items.length) return 0;
  const url = `${SUPABASE_URL}/rest/v1/ai_resources`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY as string, Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed (${res.status}): ${text}`);
  }
  return items.length;
}

export async function POST(req: NextRequest) {
  const provided = req.headers.get("x-refresh-secret");
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });

  try {
    const results = await Promise.all(RSS_SOURCES.map(fetchFeed));
    const allItems = results.flat();
    console.log(`Fetched ${allItems.length} items across ${RSS_SOURCES.length} feeds`);
    const count = await upsertItems(allItems);
    return NextResponse.json({
      ok: true, fetched: allItems.length, upserted: count,
      sources: RSS_SOURCES.map((s, i) => ({ name: s.name, count: results[i].length })),
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
