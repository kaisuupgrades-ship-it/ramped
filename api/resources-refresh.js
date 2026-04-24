// api/resources-refresh.js — POST /api/resources-refresh
// Called by Vercel cron (daily at 08:00 UTC) to fetch RSS feeds and upsert to Supabase

const RSS_SOURCES = [
  { name: 'Anthropic',        url: 'https://www.anthropic.com/rss.xml' },
  { name: 'OpenAI',           url: 'https://openai.com/news/rss.xml' },
  { name: 'DeepMind',         url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'The Batch',        url: 'https://www.deeplearning.ai/the-batch/feed/' },
  { name: 'MIT Tech Review',  url: 'https://www.technologyreview.com/feed/' },
];

// Parse a single tag value from XML string
function extractTag(xml, tag) {
  // Try CDATA first
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i');
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  // Plain tag
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(re);
  if (match) return match[1].trim();

  return '';
}

// Parse all <item> blocks from RSS/Atom feed XML
function parseItems(xml, sourceName) {
  const items = [];

  // Split on <item> tags
  const parts = xml.split(/<item[\s>]/i);
  // First part is preamble before first item
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];

    const title = extractTag(chunk, 'title');
    const link  = extractTag(chunk, 'link') || extractTag(chunk, 'guid');
    const pubDate = extractTag(chunk, 'pubDate') || extractTag(chunk, 'dc:date') || extractTag(chunk, 'published');
    const desc = extractTag(chunk, 'description') || extractTag(chunk, 'content:encoded') || extractTag(chunk, 'summary');

    if (!link || !title) continue;

    // Strip HTML tags from summary
    const summary = desc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim().slice(0, 280) || null;

    // Filter MIT Tech Review to AI-related content
    if (sourceName === 'MIT Tech Review') {
      const combined = (title + ' ' + summary).toLowerCase();
      const aiKeywords = ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'neural', 'deep learning', 'chatbot', 'robot', 'openai', 'anthropic', 'gemini', 'model'];
      if (!aiKeywords.some(kw => combined.includes(kw))) continue;
    }

    let publishedAt = null;
    if (pubDate) {
      const d = new Date(pubDate);
      if (!isNaN(d.getTime())) publishedAt = d.toISOString();
    }

    items.push({
      id: link,           // URL as stable ID
      title: title.slice(0, 400),
      url: link,
      source: sourceName,
      summary,
      published_at: publishedAt,
      fetched_at: new Date().toISOString(),
    });
  }

  return items;
}

async function fetchFeed(source) {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'RampedAI-RSS-Reader/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`Feed ${source.name} returned ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseItems(xml, source.name);
  } catch (err) {
    console.warn(`Failed to fetch ${source.name}:`, err.message);
    return [];
  }
}

async function upsertItems(items, supabaseUrl, supabaseKey) {
  if (!items.length) return 0;

  // Batch upsert via Supabase REST API — POST with Prefer: resolution=merge-duplicates
  const url = `${supabaseUrl}/rest/v1/ai_resources`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(items),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed (${res.status}): ${text}`);
  }

  return items.length;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify secret
  const secret = process.env.CRON_SECRET;
  const provided = req.headers['x-refresh-secret'];
  if (!secret || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  try {
    // Fetch all feeds in parallel
    const results = await Promise.all(RSS_SOURCES.map(fetchFeed));
    const allItems = results.flat();

    console.log(`Fetched ${allItems.length} items across ${RSS_SOURCES.length} feeds`);

    // Upsert in one batch
    const count = await upsertItems(allItems, supabaseUrl, supabaseKey);

    return res.status(200).json({
      ok: true,
      fetched: allItems.length,
      upserted: count,
      sources: RSS_SOURCES.map((s, i) => ({ name: s.name, count: results[i].length })),
    });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: err.message });
  }
}
