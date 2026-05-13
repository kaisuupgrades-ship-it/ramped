"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Input, Field } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";

interface Booking {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  datetime: string | null;
  timezone: string | null;
  tier: string | null;
  billing: string | null;
  status: string | null;
  payment_status: string | null;
  notes: string | null;
  meet_link: string | null;
  phase: string;
  phase_eyebrow: string;
  day_of_thirty: number | null;
  portal_url: string | null;
  created_at?: string;
}

interface Lead { id: string; email: string; created_at: string; source?: string | null }

interface BotClient {
  id: string;
  name: string;
  slug: string;
  droplet_id: string | null;
  droplet_ip: string | null;
  vps_status: string | null;
  hermes_url: string | null;
  api_server_key: string | null;
  created_at: string | null;
  last_active_at: string | null;
  notes: string | null;
  latest_code: string | null;
}

interface AdminPayload {
  configured: boolean;
  portal_links_enabled?: boolean;
  bookings: Booking[];
  leads: Lead[];
  maps?: unknown[];
}

type BotVpsStatus = "pending" | "provisioning" | "awaiting_oauth" | "active" | "deactivated";

const BOT_STATUS_META: Record<BotVpsStatus | "unknown", { label: string; dot: string }> = {
  pending:        { label: "Pending",        dot: "bg-text-3" },
  provisioning:   { label: "Provisioning",   dot: "bg-yellow-400" },
  awaiting_oauth: { label: "Awaiting OAuth", dot: "bg-orange" },
  active:         { label: "Active",         dot: "bg-good" },
  deactivated:    { label: "Deactivated",    dot: "bg-bad" },
  unknown:        { label: "Unknown",        dot: "bg-text-3" },
};

function formatSetupCode(code: string | null): string {
  if (!code) return "—";
  return code.length >= 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const TOKEN_KEY = "ramped:adminToken";

const phaseColor = (phase: string) => {
  switch (phase) {
    case "Live": return "good" as const;
    case "QA": return "purple" as const;
    case "Build": return "blue" as const;
    case "Discovery": return "orange" as const;
    case "Kickoff": return "blue" as const;
    default: return "neutral" as const;
  }
};

const paymentColor = (status: string | null) => {
  switch (status) {
    case "subscription_active":
    case "onboarding_paid": return "good" as const;
    case "past_due":
    case "unpaid": return "red" as const;
    case "cancelled": return "neutral" as const;
    default: return "neutral" as const;
  }
};

export default function AdminClient() {
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [data, setData] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"bookings" | "leads" | "bots">("bookings");

  const [bots, setBots] = useState<BotClient[] | null>(null);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [healthStatuses, setHealthStatuses] = useState<Record<string, "online" | "offline">>({});
  const [resetConfirm, setResetConfirm] = useState<Record<string, boolean>>({});
  const [showNewBotForm, setShowNewBotForm] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [newBotSlug, setNewBotSlug] = useState("");
  const [newBotSlugEdited, setNewBotSlugEdited] = useState(false);
  const [newBotSubmitting, setNewBotSubmitting] = useState(false);
  const [newBotResult, setNewBotResult] = useState<{ name: string; slug: string; code: string } | null>(null);
  const [newBotError, setNewBotError] = useState<string | null>(null);

  const loadBots = async () => {
    if (!token) return;
    setBotsLoading(true);
    setBotsError(null);
    try {
      const r = await fetch("/api/bot-clients", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`API ${r.status}`);
      const json = (await r.json()) as { clients: BotClient[] };
      setBots(json.clients);
    } catch (e) {
      setBotsError(e instanceof Error ? e.message : "Failed to load bot clients");
    } finally {
      setBotsLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "bots" && bots === null && token && !botsLoading) {
      loadBots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token]);

  const handleGenerateCode = async (clientId: string) => {
    const r = await fetch("/api/bot-generate-code", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    });
    if (!r.ok) {
      alert(`Failed to generate code (${r.status})`);
      return;
    }
    await loadBots();
  };

  const handleHealth = async () => {
    const r = await fetch("/api/bot-vps-status", { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      alert(`Health check failed (${r.status})`);
      return;
    }
    const json = (await r.json()) as { statuses: Record<string, "online" | "offline"> };
    setHealthStatuses(json.statuses);
  };

  const handleResetLimit = async (clientId: string) => {
    const r = await fetch("/api/bot-reset-rate-limit", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    });
    if (!r.ok) {
      alert(`Reset failed (${r.status})`);
      return;
    }
    setResetConfirm((s) => ({ ...s, [clientId]: true }));
    setTimeout(() => {
      setResetConfirm((s) => {
        const { [clientId]: _, ...rest } = s;
        return rest;
      });
    }, 2000);
  };

  const handleRevoke = async (clientId: string, name: string) => {
    if (!confirm(`Revoke "${name}"? This deactivates the client and expires unclaimed codes.`)) return;
    const r = await fetch("/api/bot-revoke", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    });
    if (!r.ok) {
      alert(`Revoke failed (${r.status})`);
      return;
    }
    await loadBots();
  };

  const handleNewBotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewBotError(null);
    setNewBotSubmitting(true);
    try {
      const r = await fetch("/api/bot-provision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBotName.trim(), slug: newBotSlug.trim() }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `API ${r.status}`);
      }
      const j = (await r.json()) as { client: BotClient; code: string };
      setNewBotResult({ name: j.client.name, slug: j.client.slug, code: j.code });
      setNewBotName("");
      setNewBotSlug("");
      setNewBotSlugEdited(false);
      await loadBots();
    } catch (err) {
      setNewBotError(err instanceof Error ? err.message : "Failed to provision client");
    } finally {
      setNewBotSubmitting(false);
    }
  };

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/admin/bookings", { headers: { Authorization: `Bearer ${token}` } });
        if (r.status === 401) {
          if (!cancelled) {
            localStorage.removeItem(TOKEN_KEY);
            setToken("");
            setError("That token didn't work. Try again.");
          }
          return;
        }
        if (!r.ok) throw new Error(`API ${r.status}`);
        const json = (await r.json()) as AdminPayload;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (!token) {
    return (
      <section className="px-6 py-16">
        <div className="max-w-[480px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Internal · Admin</div>
          <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.1] m-0 mb-3">Admin sign-in</h1>
          <p className="text-text-2 text-[14px] leading-relaxed mb-6">
            Paste your <code className="font-mono text-text-1 bg-bg-2 px-1.5 py-0.5 rounded">ADMIN_TOKEN</code>. Stored in this browser only.
          </p>
          <Card className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (tokenInput.trim()) {
                  localStorage.setItem(TOKEN_KEY, tokenInput.trim());
                  setToken(tokenInput.trim());
                  setTokenInput("");
                }
              }}
            >
              <Field label="Token">
                <Input
                  type="password"
                  autoFocus
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="paste here"
                  autoComplete="off"
                />
              </Field>
              {error && <p className="text-bad text-[13px] mb-3">{error}</p>}
              <Button type="submit" variant="primary" className="w-full">Sign in →</Button>
            </form>
          </Card>
          <p className="mt-6 text-[12px] text-text-3">
            Lost the token? Check the Vercel project env vars (`ADMIN_TOKEN`).
          </p>
        </div>
      </section>
    );
  }

  if (loading && !data) {
    return (
      <section className="px-6 py-16">
        <div className="max-w-[1200px] mx-auto">
          <p className="text-text-2">Loading...</p>
        </div>
      </section>
    );
  }

  if (data && data.configured === false) {
    return (
      <section className="px-6 py-16">
        <div className="max-w-[760px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Internal · Admin</div>
          <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.1] m-0 mb-4">Database not configured</h1>
          <p className="text-text-1 mb-6">
            <code className="font-mono text-text-1 bg-bg-2 px-1.5 py-0.5 rounded">SUPABASE_URL</code> or{" "}
            <code className="font-mono text-text-1 bg-bg-2 px-1.5 py-0.5 rounded">SUPABASE_SERVICE_KEY</code> isn't set on this Vercel project.
            Add both in <a href="https://vercel.com/lead-forgev1/ramped-s98t/settings/environment-variables" className="text-blue-2 underline">project env vars</a> and redeploy.
          </p>
          <Button onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken(""); setData(null); }} variant="secondary">Sign out</Button>
        </div>
      </section>
    );
  }

  const bookings = data?.bookings ?? [];
  const leads = data?.leads ?? [];

  return (
    <section className="px-6 py-12">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex items-end justify-between gap-6 mb-8 flex-wrap">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-2">Internal · Admin</div>
            <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.06] m-0">
              {bookings.length} bookings · {leads.length} leads
            </h1>
          </div>
          <div className="flex gap-3 items-center">
            <Button href="https://www.30dayramp.com/admin" external variant="secondary">Legacy admin →</Button>
            <Button onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken(""); setData(null); }} variant="ghost">Sign out</Button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("bookings")}
            className={`px-4 py-2 rounded-lg text-[13.5px] font-medium border transition-colors ${tab === "bookings" ? "bg-blue/10 border-blue/40 text-blue-2" : "bg-bg-2 border-line-2 text-text-1 hover:bg-bg-3"}`}
          >
            Bookings ({bookings.length})
          </button>
          <button
            onClick={() => setTab("leads")}
            className={`px-4 py-2 rounded-lg text-[13.5px] font-medium border transition-colors ${tab === "leads" ? "bg-blue/10 border-blue/40 text-blue-2" : "bg-bg-2 border-line-2 text-text-1 hover:bg-bg-3"}`}
          >
            Leads ({leads.length})
          </button>
          <button
            onClick={() => setTab("bots")}
            className={`px-4 py-2 rounded-lg text-[13.5px] font-medium border transition-colors ${tab === "bots" ? "bg-blue/10 border-blue/40 text-blue-2" : "bg-bg-2 border-line-2 text-text-1 hover:bg-bg-3"}`}
          >
            Ramped Bot{bots ? ` (${bots.length})` : ""}
          </button>
        </div>

        {tab === "bookings" && (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead className="bg-bg-3 text-text-3">
                  <tr>
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">When</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Who</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Tier</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Phase</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Payment</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Portal</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-text-3">No bookings yet.</td></tr>
                  )}
                  {bookings.map((b) => {
                    const when = b.datetime ? new Date(b.datetime) : null;
                    const whenStr = when ? when.toLocaleString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit",
                      timeZone: b.timezone || "America/Chicago",
                    }) : "—";
                    return (
                      <tr key={b.id} className="border-t border-line">
                        <td className="px-4 py-3 align-top">
                          <div className="text-text-0 font-medium">{whenStr}</div>
                          <div className="text-[12px] text-text-3 font-mono">{b.timezone || "—"}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="text-text-0 font-medium">{b.name || "—"}</div>
                          <div className="text-[12px] text-text-2"><a href={`mailto:${b.email}`} className="text-blue-2 hover:text-blue">{b.email}</a></div>
                          {b.company && <div className="text-[12px] text-text-3">{b.company}</div>}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {b.tier ? (
                            <div className="text-text-1">
                              {b.tier}
                              {b.billing && <span className="text-text-3 text-[12px] ml-1">· {b.billing}</span>}
                            </div>
                          ) : <span className="text-text-3">—</span>}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge variant={phaseColor(b.phase)}>{b.phase}</Badge>
                          <div className="text-[12px] text-text-3 mt-1">{b.phase_eyebrow}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {b.payment_status ? (
                            <Badge variant={paymentColor(b.payment_status)}>{b.payment_status.replace(/_/g, " ")}</Badge>
                          ) : <span className="text-text-3">—</span>}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {b.portal_url ? (
                            <a href={b.portal_url} target="_blank" rel="noopener noreferrer" className="text-blue-2 hover:text-blue text-[12px] font-mono">Open →</a>
                          ) : <span className="text-text-3 text-[12px]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "leads" && (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead className="bg-bg-3 text-text-3">
                  <tr>
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">When</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Email</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-12 text-center text-text-3">No leads yet.</td></tr>
                  )}
                  {leads.map((l) => (
                    <tr key={l.id} className="border-t border-line">
                      <td className="px-4 py-3 align-top text-text-0 font-mono text-[12.5px]">
                        {new Date(l.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <a href={`mailto:${l.email}`} className="text-blue-2 hover:text-blue">{l.email}</a>
                      </td>
                      <td className="px-4 py-3 align-top text-text-2">{l.source || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "bots" && (
          <>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="text-text-2 text-[13px]">
                {botsLoading ? "Loading..." : bots ? `${bots.length} client${bots.length === 1 ? "" : "s"}` : ""}
                {botsError && <span className="text-bad ml-2">· {botsError}</span>}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleHealth} variant="secondary" size="sm">Run health check</Button>
                <Button onClick={() => { setShowNewBotForm(true); setNewBotResult(null); setNewBotError(null); }} variant="primary" size="sm">+ New Client</Button>
              </div>
            </div>

            {showNewBotForm && (
              <Card className="mb-6 p-6">
                {newBotResult ? (
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-good font-semibold mb-2">Provisioned</div>
                    <h3 className="text-[20px] font-bold text-text-0 mb-3">{newBotResult.name}</h3>
                    <p className="text-text-2 text-[13.5px] mb-4">
                      Slug: <code className="font-mono text-text-1 bg-bg-2 px-1.5 py-0.5 rounded">{newBotResult.slug}</code>
                    </p>
                    <div className="bg-bg-2 border border-line-2 rounded-xl p-4 mb-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-1">Setup code (24h)</div>
                      <div className="font-mono text-[22px] tracking-[0.15em] text-text-0 font-semibold">{formatSetupCode(newBotResult.code)}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => { setNewBotResult(null); setShowNewBotForm(false); }} variant="primary" size="sm">Done</Button>
                      <Button onClick={() => setNewBotResult(null)} variant="ghost" size="sm">Add another</Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleNewBotSubmit}>
                    <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">New Ramped Bot client</div>
                    <Field label="Name">
                      <Input
                        autoFocus
                        value={newBotName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewBotName(v);
                          if (!newBotSlugEdited) setNewBotSlug(slugify(v));
                        }}
                        placeholder="Acme Holdings"
                      />
                    </Field>
                    <Field label="Slug" hint={newBotSlug ? `https://${newBotSlug}.bot.30dayramp.com` : "lowercase alphanumeric + hyphens"}>
                      <Input
                        value={newBotSlug}
                        onChange={(e) => { setNewBotSlug(e.target.value.toLowerCase()); setNewBotSlugEdited(true); }}
                        placeholder="acme-holdings"
                      />
                    </Field>
                    {newBotError && <p className="text-bad text-[13px] mb-3">{newBotError}</p>}
                    <div className="flex gap-2">
                      <Button type="submit" variant="primary" size="sm" disabled={newBotSubmitting || !newBotName.trim() || !newBotSlug.trim()}>
                        {newBotSubmitting ? "Provisioning..." : "Provision"}
                      </Button>
                      <Button type="button" onClick={() => { setShowNewBotForm(false); setNewBotError(null); }} variant="ghost" size="sm">Cancel</Button>
                    </div>
                  </form>
                )}
              </Card>
            )}

            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead className="bg-bg-3 text-text-3">
                    <tr>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Name</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Slug</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Status</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">IP</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Setup Code</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!bots && !botsLoading && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-text-3">Click "Ramped Bot" tab to load.</td></tr>
                    )}
                    {bots && bots.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-text-3">No clients yet.</td></tr>
                    )}
                    {bots && bots.map((c) => {
                      const statusKey = (c.vps_status ?? "unknown") as BotVpsStatus | "unknown";
                      const meta = BOT_STATUS_META[statusKey] ?? BOT_STATUS_META.unknown;
                      const health = healthStatuses[c.id];
                      return (
                        <tr key={c.id} className="border-t border-line">
                          <td className="px-4 py-3 align-top">
                            <div className="text-text-0 font-medium">{c.name}</div>
                            {c.created_at && (
                              <div className="text-[12px] text-text-3 font-mono">
                                {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-text-1 font-mono text-[12.5px]">{c.slug}</td>
                          <td className="px-4 py-3 align-top">
                            <div className="inline-flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
                              <span className="text-text-1">{meta.label}</span>
                            </div>
                            {health && (
                              <div className={`text-[11px] mt-1 font-mono ${health === "online" ? "text-good" : "text-bad"}`}>
                                {health === "online" ? "✓ online" : "✗ offline"}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-text-2 font-mono text-[12.5px]">{c.droplet_ip || "—"}</td>
                          <td className="px-4 py-3 align-top">
                            <span className="font-mono text-text-1 tracking-[0.1em]">{formatSetupCode(c.latest_code)}</span>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleGenerateCode(c.id)}
                                className="px-2.5 py-1 rounded-lg text-[12px] font-medium border border-line-2 bg-bg-2 text-text-1 hover:bg-bg-3 transition-colors"
                              >
                                New Code
                              </button>
                              <button
                                onClick={handleHealth}
                                className="px-2.5 py-1 rounded-lg text-[12px] font-medium border border-line-2 bg-bg-2 text-text-1 hover:bg-bg-3 transition-colors"
                              >
                                Health
                              </button>
                              {resetConfirm[c.id] ? (
                                <span className="px-2.5 py-1 rounded-lg text-[12px] font-medium border border-good/40 bg-good/10 text-good">
                                  ✓ Reset
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleResetLimit(c.id)}
                                  className="px-2.5 py-1 rounded-lg text-[12px] font-medium border border-line-2 bg-bg-2 text-text-1 hover:bg-bg-3 transition-colors"
                                >
                                  Reset Limit
                                </button>
                              )}
                              <button
                                onClick={() => handleRevoke(c.id, c.name)}
                                className="px-2.5 py-1 rounded-lg text-[12px] font-medium border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20 transition-colors"
                              >
                                Revoke
                              </button>
                              {c.vps_status === "awaiting_oauth" && (
                                <a
                                  href={`https://${c.slug}.bot.30dayramp.com:10255`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 rounded-lg text-[12px] font-medium border border-blue/40 bg-blue/10 text-blue-2 hover:bg-blue/20 transition-colors"
                                >
                                  Open OneCLI →
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        <p className="mt-8 text-[12px] text-text-3">
          Need full CRUD (edit / cancel / materials)? Use the <a href="https://www.30dayramp.com/admin" className="text-blue-2 underline">legacy admin</a> at {site.email.split("@")[1]} until those screens are ported.
        </p>
      </div>
    </section>
  );
}
