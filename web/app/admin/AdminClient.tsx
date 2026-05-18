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

interface AdminPayload {
  configured: boolean;
  portal_links_enabled?: boolean;
  bookings: Booking[];
  leads: Lead[];
  maps?: unknown[];
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
  const [tab, setTab] = useState<"bookings" | "leads" | "decks">("bookings");
  // Prospect Decks tab state
  const [decks, setDecks] = useState<DeckRow[] | null>(null);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [regenIds, setRegenIds] = useState<Set<string>>(new Set());

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
    setRegenIds(new Set([...regenIds, bookingId]));
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
                              <a
                                href={`/api/admin/decks/download?deck_id=${deck.id}`}
                                onClick={(e) => {
                                  // Add Authorization header isn't possible on a plain anchor.
                                  // Use a fetch + blob trick to keep the bearer header.
                                  e.preventDefault();
                                  if (!token) return;
                                  fetch(`/api/admin/decks/download?deck_id=${deck.id}`, {
                                    headers: { Authorization: `Bearer ${token}` },
                                    redirect: "follow",
                                  })
                                    .then(r => r.blob())
                                    .then(blob => {
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = deck.deck_filename || "deck.pptx";
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                                    });
                                }}
                                className="text-blue-2 hover:text-blue text-[12px] mr-3"
                              >
                                Download
                              </a>
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
          Need full CRUD (edit / cancel / materials)? Use the <a href="https://www.30dayramp.com/admin" className="text-blue-2 underline">legacy admin</a> at {site.email.split("@")[1]} until those screens are ported.
        </p>
      </div>
    </section>
  );
}
