"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/core";
import { site } from "@/lib/site";

interface MapAgent { name: string; description?: string; channel?: string; hours_saved_estimate?: number | string }

interface MapData {
  id: string;
  created_at: string;
  company: string | null;
  name: string | null;
  industry: string | null;
  status: string | null;
  map_data: {
    summary?: string;
    top_agents?: MapAgent[];
    pain_points?: string[];
    quick_wins?: string[];
    [k: string]: unknown;
  } | null;
}

interface Props { id: string; exp: string; t: string }

export default function MapClient({ id, exp, t }: Props) {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError("missing-id"); setLoading(false); return; }
    fetch(`/api/get-map?id=${encodeURIComponent(id)}&exp=${encodeURIComponent(exp)}&t=${encodeURIComponent(t)}`)
      .then(async (r) => {
        if (r.status === 403) { setError("forbidden"); return; }
        if (r.status === 404) { setError("notfound"); return; }
        if (!r.ok) { setError("server"); return; }
        setData(await r.json());
      })
      .catch(() => setError("network"))
      .finally(() => setLoading(false));
  }, [id, exp, t]);

  if (loading) {
    return <section className="px-6 py-16"><div className="max-w-[820px] mx-auto"><p className="text-text-2">Loading map…</p></div></section>;
  }

  if (error || !data) {
    const msg =
      error === "forbidden" ? "This map link has expired or been revoked."
      : error === "notfound" ? "We couldn't find that map. Email us if you think this is a mistake."
      : error === "missing-id" ? "Missing map ID."
      : "Something went wrong loading the map.";
    return (
      <section className="px-6 py-16">
        <div className="max-w-[640px] mx-auto">
          <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.1] m-0 mb-3">Couldn&apos;t load map</h1>
          <p className="text-text-1 mb-4">{msg}</p>
          <p className="text-text-1">Reach out to <a href={`mailto:${site.email}`} className="text-blue-2 underline">{site.email}</a> if you need help.</p>
        </div>
      </section>
    );
  }

  const m = data.map_data || {};
  const agents = Array.isArray(m.top_agents) ? m.top_agents : [];
  const painPoints = Array.isArray(m.pain_points) ? m.pain_points : [];
  const quickWins = Array.isArray(m.quick_wins) ? m.quick_wins : [];

  return (
    <section className="px-6 py-12">
      <div className="max-w-[820px] mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Your automation map</div>
        <h1 className="text-[clamp(32px,4.5vw,48px)] tracking-tight font-bold leading-[1.05] m-0 mb-3">
          {data.company || data.name || "Your AI department, mapped."}
        </h1>
        {data.industry && <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-text-3 mb-6">{data.industry}</p>}

        {m.summary && (
          <Card className="mb-6 p-6">
            <p className="text-[15px] leading-relaxed text-text-1 m-0">{m.summary}</p>
          </Card>
        )}

        {agents.length > 0 && (
          <Card className="mb-6 p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-4">Agents recommended for your stack</div>
            <div className="space-y-4">
              {agents.map((a, i) => (
                <div key={i} className="border-l-2 border-blue/40 pl-4">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <div className="font-semibold text-text-0 text-[16px]">{a.name}</div>
                    {a.hours_saved_estimate && (
                      <div className="text-[12px] text-blue-2 font-mono whitespace-nowrap">~{a.hours_saved_estimate}h/mo saved</div>
                    )}
                  </div>
                  {a.channel && <div className="text-[12px] text-text-3 font-mono mb-1">{a.channel}</div>}
                  {a.description && <p className="text-[14px] text-text-1 leading-relaxed m-0">{a.description}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {quickWins.length > 0 && (
          <Card className="mb-6 p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-orange-2 mb-3">Quick wins</div>
            <ul className="m-0 pl-5 space-y-2 text-[14px] text-text-1 leading-relaxed">
              {quickWins.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </Card>
        )}

        {painPoints.length > 0 && (
          <Card className="mb-6 p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-3">Pain points addressed</div>
            <ul className="m-0 pl-5 space-y-2 text-[14px] text-text-1 leading-relaxed">
              {painPoints.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </Card>
        )}

        <p className="mt-8 text-[12px] text-text-3">
          Want this turned into a 30-day build? <a href="/book" className="text-blue-2 underline">Book a discovery call</a>.
        </p>
      </div>
    </section>
  );
}
