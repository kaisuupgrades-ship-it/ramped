import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/core";
import { tiers, formatPrice } from "@/lib/pricing";
import { team, founderNote } from "@/lib/team";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-[1180px] mx-auto">
          <h1 className="text-[clamp(40px,7vw,84px)] leading-[1.04] tracking-[-0.035em] font-bold m-0 max-w-3xl">
            Your AI department,
            <br />
            <span className="gradient-text">live in 30 days.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] text-text-1 leading-relaxed">
            Done-for-you AI implementation. We build, deploy, and run AI agents inside your operating business —
            automating your highest-friction workflows on a flat monthly fee.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/book" size="lg" variant="primary">Book a discovery call →</Button>
            <Button href="/free-roadmap" size="lg" variant="secondary">Get your free roadmap</Button>
          </div>
          <div className="mt-7 inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-orange/[0.05] border border-orange/30">
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} className="text-orange-2 flex-shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
            </svg>
            <div className="leading-tight">
              <div className="text-text-0 font-semibold text-sm">30-day go-live guarantee — full refund if we miss.</div>
              <div className="text-text-3 text-[12.5px]">No fine print. No partial payments. No questions.</div>
            </div>
          </div>
          <p className="mt-6 text-[13.5px] text-text-2">
            Built by <span className="text-text-0 font-semibold">Andrew Yoon</span> — 10-year operator and founder of Xtractor Depot.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Pricing</div>
            <h2 className="text-[clamp(32px,4.5vw,52px)] leading-[1.1] tracking-tight font-bold m-0">
              Simple, performance-backed pricing.
            </h2>
            <p className="mt-4 text-text-1 leading-relaxed">
              We guarantee your AI agent goes live within 30 days — or you get a full refund. No partial payments, no fine print.
            </p>
            <p className="mt-3 text-[14px] text-text-2">
              Wondering how this compares to hiring a VA?{" "}
              <Link href="/comparison" className="text-blue-2 hover:text-blue underline-offset-2">See the full breakdown →</Link>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {tiers.map((t) => (
              <div
                key={t.id}
                className={`bg-gradient-to-b ${t.highlighted ? "from-orange/10 to-bg-2 border-orange/40" : "from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border-line"} border rounded-2xl p-7 flex flex-col`}
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
                      ${formatPrice(t.price.annual)}<span className="text-text-3 text-base font-normal">/mo</span>
                    </div>
                    <div className="mt-1 text-[13px] text-text-2">
                      billed annually · save ${formatPrice(t.price.annualSavings)} · + ${formatPrice(t.price.onboarding)} onboarding
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
                  <Button href={t.cta.href} variant={t.highlighted ? "primary" : "secondary"} className="w-full">{t.cta.label}</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder note (compact) */}
      <section className="px-6 py-16">
        <Card className="max-w-3xl mx-auto p-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Founder note</div>
          <h2 className="text-[clamp(24px,3vw,34px)] tracking-tight font-bold m-0">Why we started Ramped AI.</h2>
          <div className="mt-5 space-y-4 text-text-1 leading-relaxed">
            <p>{founderNote.paragraphs[1]}</p>
            <p>{founderNote.paragraphs[3]}</p>
          </div>
          <p className="mt-5 text-text-2 text-[14px]">— {founderNote.attribution}, Founder</p>
          <div className="mt-6"><Button href="/about" variant="ghost" size="sm">Read the full story →</Button></div>
        </Card>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="max-w-[1180px] mx-auto">
          <Card className="text-center p-12 bg-gradient-to-br from-blue/[0.08] via-bg-2 to-orange/[0.06]">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-4">30-day guarantee · or your money back</div>
            <h2 className="text-[clamp(32px,4vw,48px)] tracking-tight font-bold m-0 max-w-2xl mx-auto">
              Ready to ramp <span className="gradient-text">your AI department?</span>
            </h2>
            <p className="mt-5 max-w-xl mx-auto text-text-1 leading-relaxed">
              30-minute call. We&apos;ll map your highest-leverage automation, scope a deployment plan, and show you the exact ROI math — free, no commitment.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Button href="/book" size="lg" variant="primary">Book a discovery call →</Button>
              <Button href="/free-roadmap" size="lg" variant="secondary">Get your free roadmap</Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2.5 justify-center font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
              <span>Free · No commitment</span><span>·</span><span>30 minutes</span><span>·</span><span>Live in 30 days, or refund</span>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
