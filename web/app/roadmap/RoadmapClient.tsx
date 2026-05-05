"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/core";
import { site } from "@/lib/site";

interface RoadmapAgent {
  name: string;
  description?: string;
  channel?: string;
  hours_saved_estimate?: number | string;
}

interface RoadmapData {
  id: string;
  name: string | null;
  company: string | null;
  industry: string | null;
  datetime: string | null;
  roadmap: {
    summary?: string;
    top_agents?: RoadmapAgent[];
    pain_points?: string[];
    quick_wins?: string[];
    strategic_recommendations?: string[];
    [k: string]: unknown;
  };
}

interface Props { id: string; exp: string; t: string }

export default function RoadmapClient({ id, exp, t }: Props) {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !exp || !t) { setError("missing-token"); setLoading(false); return; }
    fetch(`/api/get-roadmap?id=${encodeURIComponent(id)}&exp=${encodeURIComponent(exp)}&t=${encodeURIComponent(t)}`)
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
    return <section className="px-6 py-16"><div className="max-w-[820px] mx-auto"><p className="text-text-2">Loading roadmap…</p></div></section>;
  }

  if (error || !data) {
    const msg =
      error === "missing-token" ? "This page is reached via a signed link in your booking emails."
      : error === "forbidden" ? "This roadmap link has expired or been revoked."
      : error === "notfound" ? "Your roadmap hasn't been generated yet — it lands within a few hours of your discovery call."
      : "Something went wrong loading your roadmap.";
    return (
      <section className="px-6 py-16">
        <div className="max-w-[640px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Your automation roadmap</div>
          <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.1] m-0 mb-3">{error === "notfound" ? "Roadmap on the way" : "Couldn't load roadmap"}</h1>
          <p className="text-text-1 mb-4">{msg}</p>
          <p className="text-text-1">Reach out to <a href={`mailto:${site.email}`} className="text-blue-2 underline">{site.email}</a> if you need a fresh link.</p>
        </div>
      </section>
    );
  }

  const r = data.roadmap || {};
  const agents = Array.isArray(r.top_agents) ? r.top_agents : [];
  const painPoints = Array.isArray(r.pain_points) ? r.pain_points : [];
  const quickWins = Array.isArray(r.quick_wins) ? r.quick_wins : [];
  const strategic = Array.isArray(r.strategic_recommendations) ? r.strategic_recommendations : [];

  return (
    <section className="px-6 py-12">
      <div className="max-w-[820px] mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Your automation roadmap</div>
        <h1 className="text-[clamp(32px,4.5vw,48px)] tracking-tight font-bold leading-[1.05] m-0 mb-3">
          {data.company || data.name || "Your AI department, mapped."}
        </h1>
        {data.industry && <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-text-3 mb-6">{data.industry}</p>}

        {r.summary && (
          <Card className="mb-6 p-6">
            <p className="text-[15px] leading-relaxed text-text-1 m-0">{r.summary}</p>
          </Card>
        )}

        {agents.length > 0 && (
          <Card className="mb-6 p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-4">Top agents to build</div>
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
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-orange-2 mb-3">Quick wins (week 1)</div>
            <ul className="m-0 pl-5 space-y-2 text-[14px] text-text-1 leading-relaxed">
              {quickWins.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </Card>
        )}

        {painPoints.length > 0 && (
          <Card className="mb-6 p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-3">Pain points we addressed</div>
            <ul className="m-0 pl-5 space-y-2 text-[14px] text-text-1 leading-relaxed">
              {painPoints.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </Card>
        )}

        {strategic.length > 0 && (
          <Card className="mb-6 p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-3">Strategic recommendations</div>
            <ul className="m-0 pl-5 space-y-2 text-[14px] text-text-1 leading-relaxed">
              {strategic.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </Card>
        )}

        <p className="mt-8 text-[12px] text-text-3">
          Questions on the roadmap? Email <a href={`mailto:${site.email}`} className="text-blue-2 underline">{site.email}</a>.
        </p>
      </div>
    </section>
  );
}
