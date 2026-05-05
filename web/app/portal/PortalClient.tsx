"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";

interface Booking {
  id: string;
  name: string | null;
  company: string | null;
  tier: string | null;
  status: string | null;
  payment_status: string | null;
  onboarding_completed_at: string | null;
}

interface Agent { id: string; name: string; channel: string; description: string; status: string }
interface Draft { id: string; subject: string; body: string; recipient: string; channel: string; created_at: string }
interface Run { id: string; agent_id: string; action: string; outcome: string; hours_saved: number | null; created_at: string }

interface PortalData {
  booking: Booking;
  payment_status: string | null;
  phase_eyebrow: string;
  phase: string;
  phase_step: number;
  day_of_thirty: number | null;
  welcome_sub: string;
  kickoff_date: string | null;
  golive_date: string | null;
  next_call: { when: string | null; what: string; meet_url: string | null };
  automation_map: { summary?: string; top_agents?: Array<{ name: string; description?: string }> } | null;
  agents: Agent[];
  activity: Run[];
  drafts: Draft[];
}

const PHASE_STEPS = [
  { step: 1, label: "Kickoff" },
  { step: 2, label: "Discovery" },
  { step: 3, label: "Build" },
  { step: 4, label: "QA" },
  { step: 5, label: "Live" },
];

const phaseColor = (status: string) => {
  switch (status) {
    case "live": return "good" as const;
    case "paused": return "neutral" as const;
    case "building": return "blue" as const;
    case "archived": return "neutral" as const;
    default: return "neutral" as const;
  }
};

interface Props { id: string; exp: string; t: string }

export default function PortalClient({ id, exp, t }: Props) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState<string | null>(null);

  const tokenQuery = `?id=${encodeURIComponent(id)}&exp=${encodeURIComponent(exp)}&t=${encodeURIComponent(t)}`;

  const reload = useCallback(async () => {
    if (!id || !exp || !t) { setError("missing-token"); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/portal-data${tokenQuery}`, { cache: "no-store" });
      if (r.status === 403) { setError("forbidden"); return; }
      if (!r.ok) { setError("server"); return; }
      const json = (await r.json()) as PortalData;
      setData(json);
      // Beacon: portal viewed (best-effort, non-blocking)
      fetch(`/api/portal-track${tokenQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "view", path: "/portal" }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      setError("network");
    } finally {
      setLoading(false);
    }
  }, [id, exp, t, tokenQuery]);

  useEffect(() => { reload(); }, [reload]);

  const decideDraft = async (draftId: string, decision: "approve" | "reject") => {
    setDraftBusy(draftId);
    try {
      const r = await fetch(`/api/portal-approve-draft${tokenQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, decision }),
      });
      if (r.ok) reload();
    } finally {
      setDraftBusy(null);
    }
  };

  const toggleAgent = async (agentId: string, action: "pause" | "resume") => {
    try {
      const r = await fetch(`/api/portal-toggle-agent${tokenQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action }),
      });
      if (r.ok) reload();
    } catch { /* ignore */ }
  };

  if (!id || !exp || !t || error === "missing-token") {
    return (
      <section className="px-6 py-16">
        <div className="max-w-[520px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Client portal</div>
          <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.1] m-0 mb-3">No access token</h1>
          <p className="text-text-1">Your portal is reached via a signed link in your booking email.</p>
          <p className="mt-4 text-text-1">Lost the link? Email <a href={`mailto:${site.email}`} className="text-blue-2 underline">{site.email}</a> and we&apos;ll send a fresh one.</p>
        </div>
      </section>
    );
  }

  if (error === "forbidden") {
    return (
      <section className="px-6 py-16">
        <div className="max-w-[520px] mx-auto">
          <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.1] m-0 mb-3">Link expired</h1>
          <p className="text-text-1">This portal link has expired or been revoked. Reach out to <a href={`mailto:${site.email}`} className="text-blue-2 underline">{site.email}</a> for a fresh one — they last 90 days.</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return <section className="px-6 py-16"><div className="max-w-[1100px] mx-auto"><p className="text-text-2">Loading portal…</p></div></section>;
  }

  if (error || !data) {
    return (
      <section className="px-6 py-16">
        <div className="max-w-[520px] mx-auto">
          <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.1] m-0 mb-3">Couldn&apos;t load portal</h1>
          <p className="text-text-1">Something went wrong. Try refreshing, or email <a href={`mailto:${site.email}`} className="text-blue-2 underline">{site.email}</a>.</p>
        </div>
      </section>
    );
  }

  const firstName = (data.booking.name || "").split(/\s+/)[0] || "there";
  const liveOrPausedAgents = data.agents.filter((a) => a.status === "live" || a.status === "paused");
  const totalHours = data.activity.reduce((s, r) => s + (Number(r.hours_saved) || 0), 0);
  const top = data.automation_map?.top_agents || [];

  return (
    <section className="px-6 py-12">
      <div className="max-w-[1100px] mx-auto">
        {/* Welcome banner */}
        <div className="mb-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">{data.phase_eyebrow}</div>
          <h1 className="text-[clamp(28px,4.5vw,44px)] tracking-tight font-bold leading-[1.1] m-0 mb-3">
            Welcome back, {firstName}.
          </h1>
          <p className="text-text-1 text-[15px] leading-relaxed max-w-[720px]">{data.welcome_sub}</p>
        </div>

        {/* Phase timeline */}
        <Card className="mb-6 p-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-4">Your 30-day arc</div>
          <div className="grid grid-cols-5 gap-2">
            {PHASE_STEPS.map((p) => {
              const done = data.phase_step > p.step;
              const current = data.phase_step === p.step;
              return (
                <div key={p.step} className="flex flex-col items-center gap-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-mono font-semibold border ${current ? "bg-orange/15 text-orange-2 border-orange/50" : done ? "bg-blue/15 text-blue-2 border-blue/40" : "bg-bg-3 text-text-3 border-line"}`}>
                    {done ? "✓" : p.step}
                  </div>
                  <div className={`text-[12px] font-medium text-center ${current ? "text-orange-2" : done ? "text-text-1" : "text-text-3"}`}>{p.label}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Two-col: Next call + key dates */}
        <div className="grid md:grid-cols-2 gap-5 mb-6">
          <Card className="p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-3">Next call</div>
            <div className="text-text-0 text-[16px] font-semibold mb-1">{data.next_call.when || "TBD"}</div>
            <div className="text-text-2 text-[13.5px] mb-4">{data.next_call.what}</div>
            {data.next_call.meet_url && (
              <Button href={data.next_call.meet_url} external variant="primary" size="sm">▶ Join Google Meet</Button>
            )}
          </Card>
          <Card className="p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-3">Key dates</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[12px] text-text-3 mb-1">Kickoff</div>
                <div className="text-text-0 font-medium">{data.kickoff_date || "—"}</div>
              </div>
              <div>
                <div className="text-[12px] text-text-3 mb-1">Go-live target</div>
                <div className="text-text-0 font-medium">{data.golive_date || "—"}</div>
              </div>
            </div>
            {data.day_of_thirty != null && (
              <div className="mt-4 pt-4 border-t border-line">
                <div className="text-[12px] text-text-3">Day {data.day_of_thirty} of 30</div>
              </div>
            )}
          </Card>
        </div>

        {/* Pending drafts */}
        {data.drafts.length > 0 && (
          <Card className="mb-6 p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="m-0 text-lg font-semibold">Pending approvals</h2>
              <span className="text-[12px] text-text-3 font-mono">{data.drafts.length} drafts waiting</span>
            </div>
            <div className="space-y-4">
              {data.drafts.map((d) => (
                <div key={d.id} className="border border-line-2 rounded-xl p-5 bg-bg-2">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <div className="font-semibold text-text-0">{d.subject || "(no subject)"}</div>
                    <span className="text-[11px] font-mono text-text-3 whitespace-nowrap">{d.channel}</span>
                  </div>
                  <div className="text-[12px] text-text-3 mb-3">→ {d.recipient}</div>
                  <pre className="whitespace-pre-wrap text-[13.5px] text-text-1 leading-relaxed bg-bg-3 border border-line rounded-lg p-3 m-0 mb-4 font-sans max-h-[200px] overflow-auto">{d.body}</pre>
                  <div className="flex gap-2">
                    <Button onClick={() => decideDraft(d.id, "approve")} variant="primary" size="sm" disabled={draftBusy === d.id}>Approve & send</Button>
                    <Button onClick={() => decideDraft(d.id, "reject")} variant="secondary" size="sm" disabled={draftBusy === d.id}>Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Agents */}
        {liveOrPausedAgents.length > 0 && (
          <Card className="mb-6 p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="m-0 text-lg font-semibold">Your agents</h2>
              {totalHours > 0 && <span className="text-[12px] text-text-3 font-mono">{totalHours.toFixed(1)}h saved</span>}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {liveOrPausedAgents.map((a) => (
                <div key={a.id} className="border border-line rounded-xl p-4 bg-bg-2">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <div className="font-semibold text-text-0">{a.name}</div>
                    <Badge variant={phaseColor(a.status)}>{a.status}</Badge>
                  </div>
                  {a.description && <div className="text-[13px] text-text-2 mb-3">{a.description}</div>}
                  <div className="text-[11px] font-mono text-text-3 mb-3">{a.channel}</div>
                  {a.status === "live" && (
                    <Button onClick={() => toggleAgent(a.id, "pause")} variant="ghost" size="sm">Pause</Button>
                  )}
                  {a.status === "paused" && (
                    <Button onClick={() => toggleAgent(a.id, "resume")} variant="primary" size="sm">Resume</Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Roadmap top agents (shown pre-build) */}
        {top.length > 0 && liveOrPausedAgents.length === 0 && (
          <Card className="mb-6 p-6">
            <h2 className="m-0 mb-4 text-lg font-semibold">Your AI department roadmap</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {top.map((a, i) => (
                <div key={i} className="border border-line rounded-xl p-4 bg-bg-2">
                  <div className="font-semibold text-text-0 mb-1">{a.name}</div>
                  {a.description && <div className="text-[13px] text-text-2">{a.description}</div>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recent activity */}
        {data.activity.length > 0 && (
          <Card className="mb-6 p-6">
            <h2 className="m-0 mb-4 text-lg font-semibold">Recent activity</h2>
            <div className="space-y-2">
              {data.activity.map((r) => (
                <div key={r.id} className="flex items-baseline justify-between gap-3 text-[13.5px] py-2 border-b border-line last:border-0">
                  <div>
                    <span className="text-text-0">{r.action}</span>
                    {r.outcome && <span className="text-text-3 ml-2">→ {r.outcome}</span>}
                  </div>
                  <div className="text-[12px] text-text-3 font-mono whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <p className="mt-8 text-[12px] text-text-3">
          Questions? Email <a href={`mailto:${site.email}`} className="text-blue-2 underline">{site.email}</a> — replies go straight to Jon.
        </p>
      </div>
    </section>
  );
}
