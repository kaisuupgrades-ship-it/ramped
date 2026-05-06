"use client";

/**
 * Homepage pricing — Monthly/Annual toggle + in-section guarantee banner.
 * The toggle swaps the displayed price + secondary line + tier CTA URL.
 * Restored from the legacy `setBilling()` behavior.
 */
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { tiers, formatPrice } from "@/lib/pricing";

type Mode = "monthly" | "annual";

export function PricingTiers() {
  const [mode, setMode] = React.useState<Mode>("annual");

  return (
    <>
      {/* Billing toggle */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div
          role="radiogroup"
          aria-label="Billing cadence"
          className="inline-flex p-1 rounded-full bg-bg-2 border border-line"
        >
          {(["monthly", "annual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                mode === m ? "bg-bg-0 text-text-0 shadow-sm" : "text-text-2 hover:text-text-1"
              }`}
            >
              {m === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
        {mode === "annual" && (
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-orange-2 inline-flex items-center gap-1.5">
            <span aria-hidden="true">🎁</span> 2 months free
          </span>
        )}
      </div>

      {/* Tier grid */}
      <div className="grid md:grid-cols-3 gap-5">
        {tiers.map((t) => {
          const ctaHref = t.price ? `${t.cta.href}&billing=${mode}` : t.cta.href;
          return (
            <div
              key={t.id}
              className={`bg-bg-1 bg-gradient-to-b ${t.highlighted ? "from-orange/10 to-bg-2 border-orange/40" : "from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border-line"} border rounded-2xl p-7 flex flex-col`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="m-0 text-lg font-semibold">{t.name}</h3>
                {t.badge && (
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.06em] text-orange-2 inline-flex items-center gap-1">
                    <span aria-hidden="true">★</span> {t.badge}
                  </span>
                )}
              </div>
              <div className="text-text-3 font-mono text-[11px] uppercase tracking-[0.08em] mb-5">{t.bestFor}</div>
              {t.price ? (
                <>
                  <div className="text-[44px] font-bold tracking-tight leading-none">
                    ${formatPrice(mode === "annual" ? t.price.annual : t.price.monthly)}
                    <span className="text-text-3 text-base font-normal">/mo</span>
                  </div>
                  <div className="mt-1 text-[13px] text-text-2">
                    {mode === "annual"
                      ? `billed annually · save $${formatPrice(t.price.annualSavings)} · + $${formatPrice(t.price.onboarding)} onboarding`
                      : `+ $${formatPrice(t.price.onboarding)} one-time onboarding`}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[40px] font-bold tracking-tight leading-none">From $10K<span className="text-text-3 text-base font-normal">/mo</span></div>
                  <div className="mt-1 text-[13px] text-text-2">Scoped on call · Custom SLA</div>
                </>
              )}
              <ul className="mt-6 space-y-2.5 text-[14px] text-text-1 list-none p-0 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className="text-good flex-shrink-0 mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Button href={ctaHref} variant={t.highlighted ? "primary" : "secondary"} className="w-full">{t.cta.label}</Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guarantee banner */}
      <div className="mt-10 max-w-3xl mx-auto rounded-2xl border border-orange/30 bg-orange/[0.05] p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-orange/15 grid place-items-center text-orange-2 flex-shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-text-0 font-semibold text-[15px]">30-day guaranteed satisfaction or your money back.</div>
          <div className="mt-1 text-[13.5px] text-text-2 leading-relaxed">
            If your AI agent isn&apos;t live and running within 30 days, you get a full refund. No questions, no partial payments, no fine print.
          </div>
        </div>
      </div>

      <div className="text-center mt-6 text-[14px] text-text-2">
        Not ready to commit?{" "}
        <Link href="/book" className="text-blue-2 font-semibold hover:text-blue underline-offset-2">
          Book a free 30-minute discovery call first.
        </Link>
      </div>
    </>
  );
}
