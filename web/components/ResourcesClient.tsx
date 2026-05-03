"use client";

import * as React from "react";
import { Card } from "@/components/ui/core";

interface ResourceItem {
  id?: string;
  title: string;
  url: string;
  source?: string;
  summary?: string;
  published_at?: string;
}

const SOURCE_FILTERS = ["All", "Anthropic", "OpenAI", "DeepMind", "The Batch", "MIT Tech Review"] as const;

const SOURCE_STYLES: Record<string, { bg: string; border: string; fg: string }> = {
  "Anthropic":      { bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.40)", fg: "var(--color-orange-2)" },
  "OpenAI":         { bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.40)", fg: "var(--color-good)" },
  "DeepMind":       { bg: "rgba(96,165,250,0.10)", border: "rgba(96,165,250,0.40)", fg: "var(--color-blue-2)" },
  "The Batch":      { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.40)", fg: "var(--color-purple)" },
  "MIT Tech Review": { bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.35)", fg: "var(--color-bad)" },
  default:          { bg: "rgba(255,255,255,0.04)", border: "var(--color-line-2)", fg: "var(--color-text-1)" },
};

function decodeEntities(s: string): string {
  if (typeof window === "undefined") return s;
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value;
}

function fmtRel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 2) return "1d ago";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function ResourcesClient() {
  const [items, setItems] = React.useState<ResourceItem[] | null>(null);
  const [filter, setFilter] = React.useState<string>("All");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/resources")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => {
        if (cancelled) return;
        const list: ResourceItem[] = Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : []);
        setItems(list);
      })
      .catch(() => { if (!cancelled) setError("Couldn't load the latest updates. Refresh in a minute."); });
    return () => { cancelled = true; };
  }, []);

  const filtered = items
    ? (filter === "All" ? items : items.filter((r) => (r.source || "").toLowerCase() === filter.toLowerCase()))
    : null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-7">
        {SOURCE_FILTERS.map((src) => {
          const active = filter === src;
          return (
            <button
              key={src}
              type="button"
              onClick={() => setFilter(src)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
                active
                  ? "bg-orange/10 border-orange/40 text-orange-2"
                  : "bg-bg-2 border-line-2 text-text-1 hover:text-text-0 hover:border-line-2"
              }`}
            >
              {src}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="text-center text-text-2 py-12">{error}</div>
      ) : filtered === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-bg-2/50 border border-line rounded-2xl p-6 animate-pulse">
              <div className="h-3 w-16 bg-bg-3 rounded mb-3" />
              <div className="h-4 w-3/4 bg-bg-3 rounded mb-2" />
              <div className="h-3 w-full bg-bg-3 rounded mb-1" />
              <div className="h-3 w-2/3 bg-bg-3 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-text-2 py-12">No items yet — check back soon.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r, i) => {
            const style = SOURCE_STYLES[r.source ?? "default"] ?? SOURCE_STYLES.default;
            return (
              <a
                key={r.id ?? r.url ?? i}
                href={r.url || "#"}
                target="_blank"
                rel="noopener"
                className="block bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-2xl p-5 hover:border-line-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                    style={{ background: style.bg, borderColor: style.border, color: style.fg }}
                  >
                    {r.source ?? "Update"}
                  </span>
                  <span className="text-[11px] font-mono text-text-3">{fmtRel(r.published_at)}</span>
                </div>
                <h3 className="m-0 mb-2 text-[15.5px] font-semibold leading-snug text-text-0">{decodeEntities(r.title || "Untitled")}</h3>
                {r.summary && <p className="m-0 text-[13.5px] text-text-2 leading-relaxed line-clamp-3">{decodeEntities(r.summary)}</p>}
                <div className="mt-3 text-[12.5px] text-blue-2 font-semibold">Read →</div>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
