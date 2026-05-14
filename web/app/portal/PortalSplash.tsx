"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/core";
import { site } from "@/lib/site";

type Mode = "choose" | "client-email" | "client-sent";

export default function PortalSplash() {
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/portal-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (r.status === 429) {
        setError("Too many requests. Try again in a few minutes.");
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(typeof j?.error === "string" ? j.error : "Something went wrong. Try again.");
        return;
      }
      setMode("client-sent");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="px-6 py-16">
      <div className="max-w-[520px] mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">
          Client portal
        </div>

        {mode === "choose" && (
          <>
            <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.1] m-0 mb-3">
              Sign in
            </h1>
            <p className="text-text-1 mb-8">
              Clients sign in with the email they booked with — we&apos;ll send a fresh portal link. Jon and team use the admin login.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => setMode("client-email")} variant="blue" size="lg" className="flex-1">
                I&apos;m a client
              </Button>
              <Button href="/admin" variant="outline" size="lg" className="flex-1">
                I&apos;m an admin
              </Button>
            </div>
            <p className="mt-8 text-[13px] text-text-3">
              Lost your link or never received one? Email{" "}
              <a href={`mailto:${site.email}`} className="text-blue-2 underline">{site.email}</a>.
            </p>
          </>
        )}

        {mode === "client-email" && (
          <>
            <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.1] m-0 mb-3">
              Send me a link
            </h1>
            <p className="text-text-1 mb-6">
              Enter the email you used to book your discovery call. If we find a matching booking, we&apos;ll send a fresh portal link to your inbox.
            </p>
            <form onSubmit={submit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-mono uppercase tracking-[0.08em] text-text-3">Email</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-11 px-4 rounded-xl bg-bg-2 border border-line-2 text-text-0 placeholder:text-text-3 focus:border-blue focus:outline-none"
                />
              </label>
              {error && (
                <div className="text-[13px] text-bad">{error}</div>
              )}
              <div className="flex gap-2 mt-2">
                <Button type="submit" variant="blue" size="lg" disabled={busy || !email} className="flex-1">
                  {busy ? "Sending…" : "Send me a link"}
                </Button>
                <Button type="button" variant="ghost" size="lg" onClick={() => { setMode("choose"); setError(null); }}>
                  Back
                </Button>
              </div>
            </form>
          </>
        )}

        {mode === "client-sent" && (
          <>
            <h1 className="text-[clamp(28px,4vw,40px)] tracking-tight font-bold leading-[1.1] m-0 mb-3">
              Check your inbox
            </h1>
            <p className="text-text-1 mb-6">
              If <span className="text-text-0 font-medium">{email}</span> matches a booking, a fresh portal link is on its way. It&apos;s valid for 90 days.
            </p>
            <Card className="p-5 mb-6">
              <div className="text-[13px] text-text-2 leading-relaxed">
                Didn&apos;t get it within a couple of minutes? Check your spam folder, or email{" "}
                <a href={`mailto:${site.email}`} className="text-blue-2 underline">{site.email}</a> and Jon will sort it out.
              </div>
            </Card>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => { setMode("choose"); setEmail(""); setError(null); }}
            >
              Use a different email
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
