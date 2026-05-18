"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Badge, Input, Field, Label, Textarea } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";

/* ============================================================================
   Admin CRM — bookings, leads, Ramped Bot, plus a slide-in client-detail panel
   with Overview / Bot / Channels / Materials tabs.

   Token is held in localStorage. Every API call sends `Authorization: Bearer ...`.
   The detail panel lazy-loads `/api/booking-detail/[id]` on open and never
   pre-fetches bot data for every booking.
   ========================================================================== */

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
  admin_notes?: string | null;
  meet_link: string | null;
  phase: string;
  phase_eyebrow: string;
  day_of_thirty: number | null;
  portal_url: string | null;
  created_at?: string;
}

interface Lead { id: string; email: string; created_at: string; source?: string | null }

interface DeckRow {
  booking: {
    id: string;
    datetime: string;
    name: string;
    email: string;
    company: string;
    company_url: string | null;
  };
  deck: {
    id: string;
    status: "pending" | "researching" | "generating" | "ready" | "failed" | string;
    company_url_source: "form" | "email_domain" | null;
    research_confidence: "high" | "medium" | "low" | null;
    deck_filename: string | null;
    template_version: string | null;
    error_message: string | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
  } | null;
}

interface BotClient {
  id: string;
  name: string;
  slug: string;
  droplet_id: string | null;
  droplet_ip: string | null;
  vps_status: string | null;
  hermes_url: string | null;
  novnc_url: string | null;
  api_server_key: string | null;
  email: string | null;
  booking_id: string | null;
  created_at: string | null;
  last_active_at: string | null;
  notes: string | null;
  latest_code: string | null;
  booking_name?: string | null;
  booking_email?: string | null;
  booking_company?: string | null;
}

interface AdminPayload {
  configured: boolean;
  portal_links_enabled?: boolean;
  bookings: Booking[];
  leads: Lead[];
  maps?: unknown[];
}

interface MaterialItem {
  source: "repo" | "upload";
  id: string;
  category: string;
  title: string;
  description: string | null;
  filename: string;
  type_pill: string;
  size_bytes: number | null;
  updated_at: string | null;
  uploaded_at?: string;
  mime?: string;
  path?: string;
  editable: boolean;
  deletable: boolean;
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

const STATUS_OPTIONS: Array<{ value: Booking["status"]; label: string }> = [
  { value: "new", label: "New" },
  { value: "discovery", label: "Discovery" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "post_won", label: "Post-Won" },
  { value: "no_show", label: "No Show" },
];

const TIER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "enterprise", label: "Enterprise" },
];

const MATERIAL_CATEGORIES = ["strategy", "audits", "ops", "design", "sales", "marketing", "other"] as const;

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

function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [tab, setTab] = useState<"bookings" | "leads" | "bots" | "decks">("bookings");
  // Prospect Decks tab state
  const [decks, setDecks] = useState<DeckRow[] | null>(null);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [regenIds, setRegenIds] = useState<Set<string>>(new Set());

  const [bots, setBots] = useState<BotClient[] | null>(null);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [healthStatuses, setHealthStatuses] = useState<Record<string, "online" | "offline">>({});
  const [resetConfirm, setResetConfirm] = useState<Record<string, boolean>>({});
  const [showNewBotForm, setShowNewBotForm] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [newBotSlug, setNewBotSlug] = useState("");
  const [newBotSlugEdited, setNewBotSlugEdited] = useState(false);
  const [newBotBookingId, setNewBotBookingId] = useState<string>("");
  const [newBotSubmitting, setNewBotSubmitting] = useState(false);
  const [newBotResult, setNewBotResult] = useState<{ name: string; slug: string; code: string } | null>(null);
  const [newBotError, setNewBotError] = useState<string | null>(null);

  // Client detail panel state
  const [detailOpenId, setDetailOpenId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/bookings", { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setError("That token didn't work. Try again.");
        return;
      }
      if (!r.ok) throw new Error(`API ${r.status}`);
      const json = (await r.json()) as AdminPayload;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadBots = useCallback(async () => {
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
  }, [token]);

  useEffect(() => {
    if (tab === "bots" && bots === null && token && !botsLoading) {
      loadBots();
    }
  }, [tab, bots, token, botsLoading, loadBots]);

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
        const next = { ...s };
        delete next[clientId];
        return next;
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
      const payload: Record<string, unknown> = {
        name: newBotName.trim(),
        slug: newBotSlug.trim(),
      };
      if (newBotBookingId) {
        const booking = data?.bookings.find((b) => b.id === newBotBookingId);
        payload.booking_id = newBotBookingId;
        if (booking?.email) payload.email = booking.email;
      }
      const r = await fetch("/api/bot-provision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      setNewBotBookingId("");
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
    if (token) loadBookings();
  }, [token, loadBookings]);

  // Load decks when the Decks tab is opened (or token first arrives + tab is decks)
  useEffect(() => {
    if (!token || tab !== "decks") return;
    let cancelled = false;
    (async () => {
      setDecksLoading(true);
      setDecksError(null);
      try {
        const r = await fetch("/api/admin/decks", { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error(`API ${r.status}`);
        const json = (await r.json()) as { rows: DeckRow[] };
        if (!cancelled) setDecks(json.rows || []);
      } catch (e) {
        if (!cancelled) setDecksError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setDecksLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, tab]);

  const refreshDecks = async () => {
    if (!token) return;
    const r = await fetch("/api/admin/decks", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const json = (await r.json()) as { rows: DeckRow[] };
      setDecks(json.rows || []);
    }
  };

  const regenerateDeck = async (bookingId: string) => {
    if (!token) return;
    setRegenIds(prev => new Set([...prev, bookingId]));
    try {
      await fetch("/api/admin/decks", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      await refreshDecks();
    } finally {
      setRegenIds(prev => {
        const next = new Set(prev);
        next.delete(bookingId);
        return next;
      });
    }
  };

  const markReviewed = async (deckId: string) => {
    if (!token) return;
    await fetch("/api/admin/decks/review", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ deck_id: deckId }),
    });
    await refreshDecks();
  };

  const downloadDeck = async (deckId: string, filename: string | null) => {
    if (!token) return;
    const r = await fetch(`/api/admin/decks/download?deck_id=${deckId}`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "deck.pptx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Esc closes the detail panel
  useEffect(() => {
    if (!detailOpenId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDetailOpenId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpenId]);

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

  // Build a quick lookup of bot status by booking_id so the bookings table can
  // show a dot without per-row fetches. Falls back to "not loaded" until the
  // bots tab is visited at least once.
  const botByBookingId = new Map<string, BotClient>();
  if (bots) for (const c of bots) if (c.booking_id) botByBookingId.set(c.booking_id, c);

  const openBooking = detailOpenId ? bookings.find((b) => b.id === detailOpenId) ?? null : null;

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
          <button
            onClick={() => setTab("decks")}
            className={`px-4 py-2 rounded-lg text-[13.5px] font-medium border transition-colors ${tab === "decks" ? "bg-blue/10 border-blue/40 text-blue-2" : "bg-bg-2 border-line-2 text-text-1 hover:bg-bg-3"}`}
          >
            Prospect Decks{decks ? ` (${decks.length})` : ""}
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
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Bot</th>
                    <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Portal</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-text-3">No bookings yet.</td></tr>
                  )}
                  {bookings.map((b) => {
                    const when = b.datetime ? new Date(b.datetime) : null;
                    const whenStr = when ? when.toLocaleString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit",
                      timeZone: b.timezone || "America/Chicago",
                    }) : "—";
                    const bot = botByBookingId.get(b.id);
                    const botDot = bot
                      ? (bot.vps_status === "active"
                          ? "bg-good"
                          : bot.vps_status === "awaiting_oauth"
                            ? "bg-orange"
                            : "bg-text-3")
                      : null;
                    return (
                      <tr
                        key={b.id}
                        className="border-t border-line cursor-pointer hover:bg-bg-2 transition-colors"
                        onClick={() => setDetailOpenId(b.id)}
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="text-text-0 font-medium">{whenStr}</div>
                          <div className="text-[12px] text-text-3 font-mono">{b.timezone || "—"}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="text-text-0 font-medium">{b.name || "—"}</div>
                          <div className="text-[12px] text-text-2">{b.email}</div>
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
                          {botDot ? (
                            <span className={`inline-block w-2 h-2 rounded-full ${botDot}`} title={bot?.vps_status ?? ""} />
                          ) : (
                            <span className="text-text-3">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top" onClick={(e) => e.stopPropagation()}>
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
                    <Field label="Link to booking (optional)" hint="Associates this client with an existing CRM booking.">
                      <select
                        value={newBotBookingId}
                        onChange={(e) => setNewBotBookingId(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl bg-bg-2 border border-line-2 text-text-0 text-[14.5px] focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/30 transition-colors"
                      >
                        <option value="">— Unlinked —</option>
                        {bookings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.company || b.name || b.email}
                          </option>
                        ))}
                      </select>
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
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Email</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Company</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Status</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">IP</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Setup Code</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!bots && !botsLoading && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-text-3">Click "Ramped Bot" tab to load.</td></tr>
                    )}
                    {bots && bots.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-text-3">No clients yet.</td></tr>
                    )}
                    {bots && bots.map((c) => {
                      const statusKey = (c.vps_status ?? "unknown") as BotVpsStatus | "unknown";
                      const meta = BOT_STATUS_META[statusKey] ?? BOT_STATUS_META.unknown;
                      const health = healthStatuses[c.id];
                      const displayName = c.booking_name || c.name;
                      const displayEmail = c.booking_email || c.email;
                      const displayCompany = c.booking_company;
                      return (
                        <tr key={c.id} className="border-t border-line">
                          <td className="px-4 py-3 align-top">
                            <div className="text-text-0 font-medium">{displayName}</div>
                            <div className="text-[12px] text-text-3 font-mono">{c.slug}</div>
                          </td>
                          <td className="px-4 py-3 align-top text-text-2 text-[12.5px]">{displayEmail || "—"}</td>
                          <td className="px-4 py-3 align-top text-text-2 text-[12.5px]">{displayCompany || "—"}</td>
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

        {tab === "decks" && (
          <Card className="p-0 overflow-hidden">
            {decksLoading && <div className="p-8 text-text-3 text-[13px]">Loading…</div>}
            {decksError && <div className="p-6 text-red-2 text-[13px]">{decksError}</div>}
            {!decksLoading && !decksError && decks && (
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead className="bg-bg-3 text-text-3">
                    <tr>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Call</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Prospect / Company</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Status</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Confidence</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Source</th>
                      <th className="text-right font-mono text-[11px] uppercase tracking-[0.06em] px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decks.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-text-3">No bookings yet — decks will appear here as bookings come in.</td></tr>
                    )}
                    {decks.map(({ booking, deck }) => {
                      const callTime = booking.datetime
                        ? new Date(booking.datetime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : "—";
                      const status = deck?.status ?? "—";
                      const confidence = deck?.research_confidence ?? null;
                      const isRegen = regenIds.has(booking.id);
                      const ready = deck?.status === "ready";
                      const failed = deck?.status === "failed";
                      const inFlight = deck?.status === "researching" || deck?.status === "generating" || deck?.status === "pending";
                      return (
                        <tr key={booking.id} className="border-t border-line">
                          <td className="px-4 py-3 align-top text-text-0 font-mono text-[12.5px]">{callTime}</td>
                          <td className="px-4 py-3 align-top">
                            <div className="text-text-0 font-medium">{booking.name}</div>
                            <div className="text-text-2 text-[12px]">{booking.company}</div>
                            <div className="text-text-3 text-[11px] font-mono">{booking.email}</div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            {ready && <Badge variant="good">Ready</Badge>}
                            {inFlight && <Badge variant="blue">{status}</Badge>}
                            {failed && <Badge variant="red">Failed</Badge>}
                            {!deck && <Badge variant="neutral">—</Badge>}
                            {deck?.reviewed_at && <div className="mt-1 text-text-3 text-[11px]">✓ reviewed</div>}
                            {failed && deck?.error_message && (
                              <div className="mt-1 text-red-2 text-[11px] max-w-[280px]">{deck.error_message.slice(0, 200)}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            {confidence === "high" && <Badge variant="good">High</Badge>}
                            {confidence === "medium" && <Badge variant="blue">Medium</Badge>}
                            {confidence === "low" && <Badge variant="orange">Low</Badge>}
                            {!confidence && <span className="text-text-3">—</span>}
                          </td>
                          <td className="px-4 py-3 align-top text-text-2 text-[12px]">
                            {deck?.company_url_source === "form" ? "form" : deck?.company_url_source === "email_domain" ? "email domain" : "—"}
                          </td>
                          <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                            {ready && deck && (
                              <button
                                onClick={() => downloadDeck(deck.id, deck.deck_filename)}
                                className="text-blue-2 hover:text-blue text-[12px] mr-3"
                              >
                                Download
                              </button>
                            )}
                            <button
                              onClick={() => regenerateDeck(booking.id)}
                              disabled={isRegen}
                              className="text-text-1 hover:text-text-0 text-[12px] mr-3 disabled:opacity-50"
                            >
                              {isRegen ? "Regenerating…" : "Regenerate"}
                            </button>
                            {ready && deck && !deck.reviewed_at && (
                              <button
                                onClick={() => markReviewed(deck.id)}
                                className="text-text-1 hover:text-text-0 text-[12px]"
                              >
                                Mark reviewed
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <p className="mt-8 text-[12px] text-text-3">
          Need anything the new admin doesn't have yet? The <a href="https://www.30dayramp.com/admin" className="text-blue-2 underline">legacy admin</a> at {site.email.split("@")[1]} is the fallback.
        </p>
      </div>

      {openBooking && (
        <ClientDetailPanel
          booking={openBooking}
          token={token}
          onClose={() => setDetailOpenId(null)}
          onUpdated={() => { loadBookings(); }}
          onBotChanged={() => { loadBots(); }}
        />
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Slide-in detail panel: Overview / Bot / Materials
   ────────────────────────────────────────────────────────────────────────── */

function ClientDetailPanel({
  booking,
  token,
  onClose,
  onUpdated,
  onBotChanged,
}: {
  booking: Booking;
  token: string;
  onClose: () => void;
  onUpdated: () => void;
  onBotChanged: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "bot" | "channels" | "materials">("overview");

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <aside
        className="fixed inset-y-0 right-0 w-[560px] max-w-[100vw] bg-bg-1 border-l border-line z-50 flex flex-col shadow-2xl"
        role="dialog"
        aria-label="Client detail"
      >
        <header className="flex items-start justify-between gap-3 px-6 py-5 border-b border-line">
          <div className="min-w-0">
            <div className="text-text-0 font-semibold text-[16px] truncate">
              {booking.name || booking.email}
            </div>
            {booking.company && <div className="text-[12.5px] text-text-2 truncate">{booking.company}</div>}
            <div className="text-[12px] text-text-3 truncate">
              <a href={`mailto:${booking.email}`} className="text-blue-2 hover:text-blue">{booking.email}</a>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-lg text-text-2 hover:text-text-0 hover:bg-bg-3 flex items-center justify-center text-[20px] leading-none"
          >
            ×
          </button>
        </header>

        <nav className="flex gap-1 px-4 py-2 border-b border-line bg-bg-2">
          {(["overview", "bot", "channels", "materials"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
                activeTab === t
                  ? "bg-blue/10 border-blue/40 text-blue-2"
                  : "bg-transparent border-transparent text-text-2 hover:bg-bg-3 hover:text-text-0"
              }`}
            >
              {t === "overview" ? "Overview" : t === "bot" ? "Bot" : t === "channels" ? "Channels" : "Materials"}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "overview" && (
            <OverviewTab booking={booking} token={token} onUpdated={onUpdated} onClose={onClose} />
          )}
          {activeTab === "bot" && (
            <BotTab booking={booking} token={token} onBotChanged={onBotChanged} onClose={onClose} />
          )}
          {activeTab === "channels" && (
            <ChannelsTab booking={booking} token={token} />
          )}
          {activeTab === "materials" && (
            <MaterialsTab token={token} />
          )}
        </div>
      </aside>
    </>
  );
}

/* ────────── Overview tab ────────── */

function OverviewTab({
  booking,
  token,
  onUpdated,
  onClose,
}: {
  booking: Booking;
  token: string;
  onUpdated: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: booking.name ?? "",
    email: booking.email ?? "",
    company: booking.company ?? "",
    status: booking.status ?? "new",
    tier: booking.tier ?? "",
    timezone: booking.timezone ?? "",
    notes: booking.notes ?? "",
    admin_notes: booking.admin_notes ?? "",
    meet_link: booking.meet_link ?? "",
    datetime: toLocalInputValue(booking.datetime),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when the panel switches bookings without unmounting.
  useEffect(() => {
    setForm({
      name: booking.name ?? "",
      email: booking.email ?? "",
      company: booking.company ?? "",
      status: booking.status ?? "new",
      tier: booking.tier ?? "",
      timezone: booking.timezone ?? "",
      notes: booking.notes ?? "",
      admin_notes: booking.admin_notes ?? "",
      meet_link: booking.meet_link ?? "",
      datetime: toLocalInputValue(booking.datetime),
    });
    setSaved(false);
    setError(null);
  }, [booking]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: Record<string, unknown> = {
        id: booking.id,
        name: form.name,
        email: form.email,
        company: form.company,
        status: form.status,
        tier: form.tier,
        timezone: form.timezone,
        notes: form.notes,
        admin_notes: form.admin_notes,
        meet_link: form.meet_link,
      };
      if (form.datetime) {
        const d = new Date(form.datetime);
        if (!isNaN(d.getTime())) payload.datetime = d.toISOString();
      }
      const r = await fetch("/api/booking-update", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `API ${r.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm(`Archive ${booking.name || booking.email}? Sets status to "lost" and notes "Archived". This is reversible from the legacy admin.`)) return;
    setArchiving(true);
    setError(null);
    try {
      const r = await fetch("/api/booking-delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: booking.id }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `API ${r.status}`);
      }
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <form onSubmit={handleSave}>
      <Field label="Name">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="Company">
        <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full h-11 px-3.5 rounded-xl bg-bg-2 border border-line-2 text-text-0 text-[14.5px] focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/30 transition-colors"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value ?? ""} value={o.value ?? ""}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Tier">
          <select
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value })}
            className="w-full h-11 px-3.5 rounded-xl bg-bg-2 border border-line-2 text-text-0 text-[14.5px] focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/30 transition-colors"
          >
            {TIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kickoff datetime">
          <Input
            type="datetime-local"
            value={form.datetime}
            onChange={(e) => setForm({ ...form, datetime: e.target.value })}
          />
        </Field>
        <Field label="Timezone">
          <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="America/Chicago" />
        </Field>
      </div>

      <Field label="Meet link">
        <Input value={form.meet_link} onChange={(e) => setForm({ ...form, meet_link: e.target.value })} placeholder="https://meet.google.com/..." />
      </Field>

      <Field label="Notes (visible to client)">
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
        />
      </Field>

      <Field label="Admin notes (internal)">
        <Textarea
          value={form.admin_notes}
          onChange={(e) => setForm({ ...form, admin_notes: e.target.value })}
          rows={3}
        />
      </Field>

      {error && <p className="text-bad text-[13px] mb-3">{error}</p>}

      <div className="flex items-center gap-3 mb-8">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
        {saved && <span className="text-good text-[13px] font-mono">✓ Saved</span>}
      </div>

      <div className="border-t border-line pt-5">
        <Label>Danger zone</Label>
        <p className="text-[12.5px] text-text-3 mb-3 leading-relaxed">
          Archive marks status as <code className="font-mono bg-bg-2 px-1 rounded">lost</code> and notes the row as Archived.
          The row is preserved for audit history.
        </p>
        <button
          type="button"
          onClick={handleArchive}
          disabled={archiving}
          className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20 transition-colors disabled:opacity-50"
        >
          {archiving ? "Archiving..." : "Archive client"}
        </button>
      </div>
    </form>
  );
}

/* ────────── Bot tab ────────── */

interface BookingDetailResponse {
  booking: Booking;
  bot_client: BotClient | null;
  latest_code: string | null;
}

function BotTab({
  booking,
  token,
  onBotChanged,
  onClose,
}: {
  booking: Booking;
  token: string;
  onBotChanged: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BookingDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/booking-detail/${booking.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
      const json = (await r.json()) as BookingDetailResponse;
      setDetail(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [booking.id, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-text-2 text-[13.5px]">Loading bot status...</p>;
  if (error) return <p className="text-bad text-[13.5px]">{error}</p>;

  if (!detail?.bot_client) {
    return (
      <ProvisionForm
        booking={booking}
        token={token}
        onProvisioned={() => { load(); onBotChanged(); }}
      />
    );
  }

  return (
    <BotStatusView
      client={detail.bot_client}
      latestCode={detail.latest_code}
      token={token}
      onChanged={() => { load(); onBotChanged(); }}
      onClose={onClose}
    />
  );
}

function ProvisionForm({
  booking,
  token,
  onProvisioned,
}: {
  booking: Booking;
  token: string;
  onProvisioned: () => void;
}) {
  const defaultName = booking.company || booking.name || booking.email;
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(slugify(defaultName));
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/bot-provision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          booking_id: booking.id,
          email: booking.email,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `API ${r.status}`);
      }
      const j = (await r.json()) as { code: string };
      setResult({ code: j.code });
      onProvisioned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to provision");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-good font-semibold mb-2">Provisioned</div>
        <p className="text-text-2 text-[13.5px] mb-3">
          Bot client linked to this booking. Hand the operator the setup code below.
        </p>
        <div className="bg-bg-2 border border-line-2 rounded-xl p-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-1">Setup code (24h)</div>
          <div className="font-mono text-[22px] tracking-[0.15em] text-text-0 font-semibold">{formatSetupCode(result.code)}</div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">No bot linked</div>
      <p className="text-text-2 text-[13.5px] mb-4 leading-relaxed">
        Provision a Ramped Bot VPS for this client. Pre-filled from booking data — edit if needed.
      </p>
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => {
            const v = e.target.value;
            setName(v);
            if (!slugEdited) setSlug(slugify(v));
          }}
          placeholder="Acme Holdings"
        />
      </Field>
      <Field label="Slug" hint={slug ? `https://${slug}.bot.30dayramp.com` : "lowercase alphanumeric + hyphens"}>
        <Input
          value={slug}
          onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugEdited(true); }}
          placeholder="acme-holdings"
        />
      </Field>
      {error && <p className="text-bad text-[13px] mb-3">{error}</p>}
      <Button type="submit" variant="primary" disabled={submitting || !name.trim() || !slug.trim()}>
        {submitting ? "Provisioning..." : "Provision Bot"}
      </Button>
    </form>
  );
}

function BotStatusView({
  client: clientProp,
  latestCode,
  token,
  onChanged,
  onClose,
}: {
  client: BotClient;
  latestCode: string | null;
  token: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [overrides, setOverrides] = useState<Partial<BotClient>>({});
  useEffect(() => { setOverrides({}); }, [clientProp]);
  const client = { ...clientProp, ...overrides };
  const statusKey = (client.vps_status ?? "unknown") as BotVpsStatus | "unknown";
  const meta = BOT_STATUS_META[statusKey] ?? BOT_STATUS_META.unknown;
  const [health, setHealth] = useState<"online" | "offline" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vncCopied, setVncCopied] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const vncPassword = client.api_server_key ? client.api_server_key.slice(0, 8) : null;
  const copyVncPassword = async () => {
    if (!vncPassword) return;
    try {
      await navigator.clipboard.writeText(vncPassword);
      setVncCopied(true);
      setTimeout(() => setVncCopied(false), 1500);
    } catch { /* clipboard blocked — ignore */ }
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : "Action failed"); } finally { setBusy(null); }
  };

  const handleNewCode = () => run("code", async () => {
    const r = await fetch("/api/bot-generate-code", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: client.id }),
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
    onChanged();
  });

  const handleHealth = () => run("health", async () => {
    const r = await fetch("/api/bot-vps-status", { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`API ${r.status}`);
    const j = (await r.json()) as { statuses: Record<string, "online" | "offline"> };
    setHealth(j.statuses[client.id] ?? null);
  });

  const handleCheckDroplet = () => run("droplet", async () => {
    const r = await fetch(`/api/bot-poll-droplet?client_id=${encodeURIComponent(client.id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || `API ${r.status}`);
    }
    onChanged();
  });

  const handleReprovision = () => run("reprovision", async () => {
    const r = await fetch("/api/bot-reprovision", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: client.id }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || `API ${r.status}`);
    }
    onChanged();
  });

  const handleReset = () => run("reset", async () => {
    const r = await fetch("/api/bot-reset-rate-limit", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: client.id }),
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
  });

  const handleAuthorizeOpenAI = () => run("auth-openai", async () => {
    setAuthNotice(null);
    const r = await fetch(`/api/bot-auth-openai?client_id=${encodeURIComponent(client.id)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = (await r.json().catch(() => ({}))) as { auth_url?: string; error?: string };
    if (!r.ok || !j.auth_url) throw new Error(j.error || `API ${r.status}`);
    window.open(j.auth_url, "_blank", "noopener,noreferrer");
    setAuthNotice("Complete authorization in the new tab, then click Activate when done.");
  });

  const handleActivate = () => run("activate", async () => {
    const r = await fetch("/api/bot-activate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: client.id }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || `API ${r.status}`);
    }
    setAuthNotice(null);
    onChanged();
  });

  const handleRevoke = () => {
    if (!confirm(`Revoke "${client.name}"? This destroys the DigitalOcean droplet and expires unclaimed codes.`)) return;
    run("revoke", async () => {
      const r = await fetch("/api/bot-revoke", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `API ${r.status}`);
      }
      onChanged();
      onClose();
    });
  };

  return (
    <div>
      <div className="mb-4">
        <div className="inline-flex items-center gap-2 mb-1">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot}`} />
          <span className="text-text-0 font-semibold">{meta.label}</span>
        </div>
      </div>

      {client.vps_status === "provisioning" && (
        <div className="mb-4 rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-3 text-[13px] text-text-1">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
            <span>Orgo is creating your VPS — Hermes setup takes about 5–10 min.</span>
          </div>
          {client.droplet_ip && (
            <div className="mt-1.5 font-mono text-[12px] text-text-2">IP assigned: {client.droplet_ip}</div>
          )}
        </div>
      )}

      <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3 text-[13.5px] mb-5">
        <dt className="text-text-3 font-mono text-[11.5px] uppercase tracking-[0.05em] pt-0.5">Slug</dt>
        <dd className="text-text-1 font-mono">{client.slug}</dd>

        <dt className="text-text-3 font-mono text-[11.5px] uppercase tracking-[0.05em] pt-0.5">IP</dt>
        <dd className="text-text-1 font-mono">{client.droplet_ip || "—"}</dd>

        <dt className="text-text-3 font-mono text-[11.5px] uppercase tracking-[0.05em] pt-0.5">Hermes URL</dt>
        <dd className="text-text-1 font-mono text-[12.5px] break-all">
          {client.hermes_url ? (
            <a href={client.hermes_url} target="_blank" rel="noopener noreferrer" className="text-blue-2 hover:text-blue">{client.hermes_url}</a>
          ) : "—"}
        </dd>

        <dt className="text-text-3 font-mono text-[11.5px] uppercase tracking-[0.05em] pt-0.5">Desktop URL</dt>
        <dd className="text-text-1 font-mono text-[12.5px] break-all">
          {client.novnc_url ? (
            <a href={client.novnc_url} target="_blank" rel="noopener noreferrer" className="text-blue-2 hover:text-blue">{client.novnc_url}</a>
          ) : "—"}
        </dd>

        <dt className="text-text-3 font-mono text-[11.5px] uppercase tracking-[0.05em] pt-0.5">VNC password</dt>
        <dd className="text-text-1 font-mono text-[12.5px]">
          {vncPassword ? (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={vncPassword}
                readOnly
                className="flex-1 min-w-0 px-2 py-1 rounded-md bg-bg-2 border border-line-2 text-text-1 font-mono text-[12.5px] tracking-[0.1em]"
              />
              <button
                type="button"
                onClick={copyVncPassword}
                className="px-2.5 py-1 rounded-md text-[11.5px] font-medium border border-line-2 bg-bg-2 text-text-1 hover:bg-bg-3 transition-colors whitespace-nowrap"
              >
                {vncCopied ? "Copied" : "Copy"}
              </button>
            </div>
          ) : "—"}
        </dd>

        <dt className="text-text-3 font-mono text-[11.5px] uppercase tracking-[0.05em] pt-0.5">Setup code</dt>
        <dd className="text-text-1 font-mono tracking-[0.15em]">{formatSetupCode(latestCode)}</dd>

        <dt className="text-text-3 font-mono text-[11.5px] uppercase tracking-[0.05em] pt-0.5">Last active</dt>
        <dd className="text-text-1">
          {client.last_active_at
            ? new Date(client.last_active_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
            : "—"}
        </dd>
      </dl>

      {health && (
        <div className={`mb-4 text-[12.5px] font-mono ${health === "online" ? "text-good" : "text-bad"}`}>
          {health === "online" ? "✓ online" : "✗ offline"}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {client.droplet_id && (
          <button onClick={handleCheckDroplet} disabled={busy === "droplet"} className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-blue/40 bg-blue/10 text-blue-2 hover:bg-blue/20 transition-colors disabled:opacity-50">{busy === "droplet" ? "..." : "Check Status"}</button>
        )}
        {(!client.droplet_id || client.vps_status === "deactivated") && client.vps_status !== "provisioning" && (
          <button onClick={handleReprovision} disabled={busy === "reprovision"} className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-blue/40 bg-blue/10 text-blue-2 hover:bg-blue/20 transition-colors disabled:opacity-50">{busy === "reprovision" ? "..." : "Provision VPS"}</button>
        )}
        <button onClick={handleNewCode} disabled={busy === "code"} className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-line-2 bg-bg-2 text-text-1 hover:bg-bg-3 transition-colors disabled:opacity-50">{busy === "code" ? "..." : "New Code"}</button>
        <button onClick={handleHealth} disabled={busy === "health"} className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-line-2 bg-bg-2 text-text-1 hover:bg-bg-3 transition-colors disabled:opacity-50">{busy === "health" ? "..." : "Health Check"}</button>
        <button onClick={handleReset} disabled={busy === "reset"} className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-line-2 bg-bg-2 text-text-1 hover:bg-bg-3 transition-colors disabled:opacity-50">{busy === "reset" ? "..." : "Reset Rate Limit"}</button>
        <button onClick={handleRevoke} disabled={busy === "revoke"} className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20 transition-colors disabled:opacity-50">{busy === "revoke" ? "..." : "Revoke"}</button>
        {client.vps_status === "awaiting_oauth" && (
          <>
            <button
              onClick={handleAuthorizeOpenAI}
              disabled={busy === "auth-openai"}
              className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-orange/40 bg-orange/10 text-orange hover:bg-orange/20 transition-colors disabled:opacity-50"
            >
              {busy === "auth-openai" ? "..." : "Authorize OpenAI →"}
            </button>
            <button
              onClick={handleActivate}
              disabled={busy === "activate"}
              className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-good/40 bg-good/10 text-good hover:bg-good/20 transition-colors disabled:opacity-50"
            >
              {busy === "activate" ? "..." : "Activate"}
            </button>
            <a
              href={`https://${client.slug}.bot.30dayramp.com:10255`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-blue/40 bg-blue/10 text-blue-2 hover:bg-blue/20 transition-colors"
            >
              Open OneCLI →
            </a>
          </>
        )}
        {client.novnc_url && (
          <a
            href={client.novnc_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-blue/40 bg-blue/10 text-blue-2 hover:bg-blue/20 transition-colors"
          >
            Open Desktop →
          </a>
        )}
      </div>

      {authNotice && (
        <div className="mb-3 rounded-lg border border-orange/40 bg-orange/10 px-3 py-2 text-[12.5px] text-orange">
          {authNotice}
        </div>
      )}
      {error && <p className="text-bad text-[13px]">{error}</p>}
    </div>
  );
}

/* ────────── Channels tab ────────── */

interface ChannelConfig {
  slack?: { enabled?: boolean; bot_token?: string; app_token?: string; allowed_users?: string; home_channel?: string };
  discord?: { enabled?: boolean; token?: string };
  email?: { enabled?: boolean; imap_host?: string; smtp_host?: string; port?: string; username?: string; password?: string };
  ai?: { enabled?: boolean; provider?: string; api_key?: string; model?: string };
  web_search?: { enabled?: boolean; backend?: string; api_key?: string };
}

const EMPTY_CHANNEL_CONFIG: Required<ChannelConfig> = {
  slack:      { enabled: false, bot_token: "", app_token: "", allowed_users: "", home_channel: "" },
  discord:    { enabled: false, token: "" },
  email:      { enabled: false, imap_host: "", smtp_host: "", port: "", username: "", password: "" },
  ai:         { enabled: false, provider: "anthropic", api_key: "", model: "claude-sonnet-4-5" },
  web_search: { enabled: false, backend: "none", api_key: "" },
};

function mergeChannelConfig(loaded: ChannelConfig | null | undefined): Required<ChannelConfig> {
  const c = loaded ?? {};
  return {
    slack:      { ...EMPTY_CHANNEL_CONFIG.slack,      ...(c.slack ?? {}) },
    discord:    { ...EMPTY_CHANNEL_CONFIG.discord,    ...(c.discord ?? {}) },
    email:      { ...EMPTY_CHANNEL_CONFIG.email,      ...(c.email ?? {}) },
    ai:         { ...EMPTY_CHANNEL_CONFIG.ai,         ...(c.ai ?? {}) },
    web_search: { ...EMPTY_CHANNEL_CONFIG.web_search, ...(c.web_search ?? {}) },
  };
}

function ChannelsTab({ booking, token }: { booking: Booking; token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botClientId, setBotClientId] = useState<string | null>(null);
  const [config, setConfig] = useState<Required<ChannelConfig>>(EMPTY_CHANNEL_CONFIG);
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detailRes = await fetch(`/api/booking-detail/${booking.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!detailRes.ok) throw new Error(`API ${detailRes.status}`);
      const detail = (await detailRes.json()) as BookingDetailResponse;
      if (!detail.bot_client) {
        setBotClientId(null);
        setConfig(EMPTY_CHANNEL_CONFIG);
        return;
      }
      setBotClientId(detail.bot_client.id);
      const ccRes = await fetch(`/api/bot-update-channels?client_id=${encodeURIComponent(detail.bot_client.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!ccRes.ok) throw new Error(`Channel config load failed (${ccRes.status})`);
      const cc = (await ccRes.json()) as { channel_config: ChannelConfig | null };
      setConfig(mergeChannelConfig(cc.channel_config));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [booking.id, token]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!botClientId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await fetch("/api/bot-update-channels", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: botClientId, channel_config: config }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `API ${r.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-text-2 text-[13.5px]">Loading channels...</p>;
  if (error && !botClientId) return <p className="text-bad text-[13.5px]">{error}</p>;

  if (!botClientId) {
    return (
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-3 font-semibold mb-3">No bot linked</div>
        <p className="text-text-2 text-[13.5px] leading-relaxed">
          Provision a Ramped Bot for this client first — open the <strong className="text-text-1">Bot</strong> tab.
          Channel configuration only applies to clients with a VPS.
        </p>
      </div>
    );
  }

  const toggle = (k: string) => setOpenSection((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div>
      <p className="text-text-2 text-[13px] mb-4 leading-relaxed">
        Per-client Hermes channel configuration. Changes take effect on next provision —
        for running bots, use Push Config.
      </p>

      <ChannelSection
        title="Slack"
        enabled={!!config.slack.enabled}
        onEnabledChange={(v) => setConfig({ ...config, slack: { ...config.slack, enabled: v } })}
        open={openSection.slack ?? !!config.slack.enabled}
        onToggle={() => toggle("slack")}
      >
        <Field label="Bot token" hint="xoxb-...">
          <Input
            value={config.slack.bot_token ?? ""}
            onChange={(e) => setConfig({ ...config, slack: { ...config.slack, bot_token: e.target.value } })}
            placeholder="xoxb-..."
          />
        </Field>
        <Field label="App token" hint="xapp-...">
          <Input
            value={config.slack.app_token ?? ""}
            onChange={(e) => setConfig({ ...config, slack: { ...config.slack, app_token: e.target.value } })}
            placeholder="xapp-..."
          />
        </Field>
        <Field label="Allowed user IDs" hint="Comma-separated Slack Member IDs">
          <Input
            value={config.slack.allowed_users ?? ""}
            onChange={(e) => setConfig({ ...config, slack: { ...config.slack, allowed_users: e.target.value } })}
            placeholder="U01ABC,U02DEF"
          />
        </Field>
        <Field label="Home channel ID">
          <Input
            value={config.slack.home_channel ?? ""}
            onChange={(e) => setConfig({ ...config, slack: { ...config.slack, home_channel: e.target.value } })}
            placeholder="C01ABC"
          />
        </Field>
      </ChannelSection>

      <ChannelSection
        title="Discord"
        enabled={!!config.discord.enabled}
        onEnabledChange={(v) => setConfig({ ...config, discord: { ...config.discord, enabled: v } })}
        open={openSection.discord ?? !!config.discord.enabled}
        onToggle={() => toggle("discord")}
      >
        <Field label="Bot token">
          <Input
            value={config.discord.token ?? ""}
            onChange={(e) => setConfig({ ...config, discord: { ...config.discord, token: e.target.value } })}
            placeholder="MT..."
          />
        </Field>
      </ChannelSection>

      <ChannelSection
        title="Email"
        enabled={!!config.email.enabled}
        onEnabledChange={(v) => setConfig({ ...config, email: { ...config.email, enabled: v } })}
        open={openSection.email ?? !!config.email.enabled}
        onToggle={() => toggle("email")}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="IMAP host">
            <Input
              value={config.email.imap_host ?? ""}
              onChange={(e) => setConfig({ ...config, email: { ...config.email, imap_host: e.target.value } })}
              placeholder="imap.gmail.com"
            />
          </Field>
          <Field label="SMTP host">
            <Input
              value={config.email.smtp_host ?? ""}
              onChange={(e) => setConfig({ ...config, email: { ...config.email, smtp_host: e.target.value } })}
              placeholder="smtp.gmail.com"
            />
          </Field>
        </div>
        <Field label="Port">
          <Input
            value={config.email.port ?? ""}
            onChange={(e) => setConfig({ ...config, email: { ...config.email, port: e.target.value } })}
            placeholder="993"
          />
        </Field>
        <Field label="Username">
          <Input
            value={config.email.username ?? ""}
            onChange={(e) => setConfig({ ...config, email: { ...config.email, username: e.target.value } })}
            placeholder="user@example.com"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={config.email.password ?? ""}
            onChange={(e) => setConfig({ ...config, email: { ...config.email, password: e.target.value } })}
            placeholder="••••••••"
          />
        </Field>
      </ChannelSection>

      <ChannelSection
        title="AI Provider"
        enabled={!!config.ai.enabled}
        onEnabledChange={(v) => setConfig({ ...config, ai: { ...config.ai, enabled: v } })}
        open={openSection.ai ?? !!config.ai.enabled}
        onToggle={() => toggle("ai")}
      >
        <Field label="Provider">
          <select
            value={config.ai.provider ?? "anthropic"}
            onChange={(e) => setConfig({ ...config, ai: { ...config.ai, provider: e.target.value } })}
            className="w-full h-11 px-3.5 rounded-xl bg-bg-2 border border-line-2 text-text-0 text-[14.5px] focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/30 transition-colors"
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </Field>
        <Field label="API key">
          <Input
            type="password"
            value={config.ai.api_key ?? ""}
            onChange={(e) => setConfig({ ...config, ai: { ...config.ai, api_key: e.target.value } })}
            placeholder="sk-..."
          />
        </Field>
        <Field label="Model">
          <Input
            value={config.ai.model ?? ""}
            onChange={(e) => setConfig({ ...config, ai: { ...config.ai, model: e.target.value } })}
            placeholder="claude-sonnet-4-5"
          />
        </Field>
      </ChannelSection>

      <ChannelSection
        title="Web Search"
        enabled={!!config.web_search.enabled}
        onEnabledChange={(v) => setConfig({ ...config, web_search: { ...config.web_search, enabled: v } })}
        open={openSection.web_search ?? !!config.web_search.enabled}
        onToggle={() => toggle("web_search")}
      >
        <Field label="Backend">
          <select
            value={config.web_search.backend ?? "none"}
            onChange={(e) => setConfig({ ...config, web_search: { ...config.web_search, backend: e.target.value } })}
            className="w-full h-11 px-3.5 rounded-xl bg-bg-2 border border-line-2 text-text-0 text-[14.5px] focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/30 transition-colors"
          >
            <option value="none">None</option>
            <option value="firecrawl">Firecrawl</option>
            <option value="tavily">Tavily</option>
            <option value="exa">Exa</option>
          </select>
        </Field>
        <Field label="API key">
          <Input
            type="password"
            value={config.web_search.api_key ?? ""}
            onChange={(e) => setConfig({ ...config, web_search: { ...config.web_search, api_key: e.target.value } })}
            placeholder="key..."
          />
        </Field>
      </ChannelSection>

      {error && <p className="text-bad text-[13px] mb-3">{error}</p>}

      <div className="flex items-center gap-3 mt-5 mb-3">
        <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Channels"}
        </Button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-line-2 bg-bg-2 text-text-3 cursor-not-allowed"
        >
          Push Config
        </button>
        {saved && <span className="text-good text-[13px] font-mono">✓ Saved</span>}
      </div>

      <p className="text-text-3 text-[12px] leading-relaxed">
        Changes take effect on next provision. For running bots, use Push Config.
      </p>
    </div>
  );
}

function ChannelSection({
  title,
  enabled,
  onEnabledChange,
  open,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-line-2 rounded-xl bg-bg-2 mb-3">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-text-0 text-[14px] font-semibold flex-1 text-left"
        >
          <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>›</span>
          {title}
          {enabled && (
            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.05em] bg-good/15 text-good">
              on
            </span>
          )}
        </button>
        <label className="inline-flex items-center gap-2 text-[12px] text-text-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="w-4 h-4 accent-blue"
          />
          Enabled
        </label>
      </div>
      {open && (
        <div className="px-4 pb-3 border-t border-line">
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

/* ────────── Materials tab ────────── */

function MaterialsTab({ token }: { token: string }) {
  const [items, setItems] = useState<MaterialItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin-materials", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`API ${r.status}`);
      const json = (await r.json()) as { items: MaterialItem[] };
      setItems(json.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const initRes = await fetch("/api/admin-materials", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "other",
          title: file.name.replace(/\.[^.]+$/, ""),
          filename: file.name,
          mime: file.type || "application/octet-stream",
          size_bytes: file.size,
        }),
      });
      if (!initRes.ok) {
        const j = (await initRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `init failed (${initRes.status})`);
      }
      const init = (await initRes.json()) as { uploadUrl: string };

      const putRes = await fetch(init.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`upload failed (${putRes.status})`);

      await load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (id: string) => {
    const r = await fetch(`/api/admin-materials?id=${encodeURIComponent(id)}&action=download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { alert(`Download URL failed (${r.status})`); return; }
    const j = (await r.json()) as { url: string };
    window.open(j.url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This removes the file and its record.`)) return;
    const r = await fetch(`/api/admin-materials?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { alert(`Delete failed (${r.status})`); return; }
    await load();
  };

  if (loading) return <p className="text-text-2 text-[13.5px]">Loading materials...</p>;
  if (error) return <p className="text-bad text-[13.5px]">{error}</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-text-2 text-[13px]">
          {items ? `${items.length} item${items.length === 1 ? "" : "s"}` : ""}
        </div>
        <label className="inline-flex items-center px-3 py-2 rounded-lg text-[13px] font-semibold bg-bg-3 border border-line-2 text-text-0 hover:bg-bg-4 cursor-pointer transition-colors">
          {uploading ? "Uploading..." : "Upload file"}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {uploadError && <p className="text-bad text-[13px] mb-3">{uploadError}</p>}

      <div className="space-y-2">
        {items && items.length === 0 && (
          <p className="text-text-3 text-[13px] py-8 text-center">No materials yet.</p>
        )}
        {items && items.map((it) => (
          <MaterialRow
            key={it.id}
            item={it}
            editing={editingId === it.id}
            onEdit={() => setEditingId(it.id)}
            onCancelEdit={() => setEditingId(null)}
            onSavedEdit={() => { setEditingId(null); load(); }}
            onDownload={() => handleDownload(it.id)}
            onDelete={() => handleDelete(it.id, it.title)}
            token={token}
          />
        ))}
      </div>
    </div>
  );
}

function MaterialRow({
  item,
  editing,
  onEdit,
  onCancelEdit,
  onSavedEdit,
  onDownload,
  onDelete,
  token,
}: {
  item: MaterialItem;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSavedEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
  token: string;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [category, setCategory] = useState(item.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <div className="border border-line-2 rounded-xl bg-bg-2 p-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-bg-2 border border-line-2 text-text-0 text-[14.5px] focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/30 transition-colors"
          >
            {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        {error && <p className="text-bad text-[13px] mb-2">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              setSaving(true); setError(null);
              try {
                const r = await fetch(`/api/admin-materials?id=${encodeURIComponent(item.id)}`, {
                  method: "PATCH",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ title, description, category }),
                });
                if (!r.ok) {
                  const j = (await r.json().catch(() => ({}))) as { error?: string };
                  throw new Error(j.error || `API ${r.status}`);
                }
                onSavedEdit();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Save failed");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={onCancelEdit}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border border-line-2 rounded-xl bg-bg-2 px-3 py-2.5">
      <div className="w-10 h-10 rounded-lg bg-bg-3 border border-line-2 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.05em] text-text-2 shrink-0">
        {item.type_pill}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-text-0 text-[13.5px] font-medium truncate">{item.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] uppercase tracking-[0.05em] font-mono text-text-3">{item.category}</span>
          <span className="text-text-3 text-[11px]">·</span>
          <span className="text-text-3 text-[11px]">{formatBytes(item.size_bytes)}</span>
          {item.source === "repo" && (
            <>
              <span className="text-text-3 text-[11px]">·</span>
              <span className="text-text-3 text-[11px]">repo</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {item.source === "upload" ? (
          <button onClick={onDownload} title="Download" className="w-8 h-8 rounded-lg text-text-2 hover:text-text-0 hover:bg-bg-3 flex items-center justify-center text-[13px]" aria-label="Download">↓</button>
        ) : item.path ? (
          <a href={item.path} target="_blank" rel="noopener noreferrer" title="Open" className="w-8 h-8 rounded-lg text-text-2 hover:text-text-0 hover:bg-bg-3 flex items-center justify-center text-[13px]" aria-label="Open">↗</a>
        ) : null}
        {item.editable && (
          <button onClick={onEdit} title="Edit" className="w-8 h-8 rounded-lg text-text-2 hover:text-text-0 hover:bg-bg-3 flex items-center justify-center text-[13px]" aria-label="Edit">✎</button>
        )}
        {item.deletable && (
          <button onClick={onDelete} title="Delete" className="w-8 h-8 rounded-lg text-text-2 hover:text-bad hover:bg-bad/10 flex items-center justify-center text-[13px]" aria-label="Delete">🗑</button>
        )}
      </div>
    </div>
  );
}
