import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/core";
import { HomepageDemo } from "@/components/HomepageDemo";
import { TimelineCards } from "@/components/TimelineCards";
import { PricingTiers } from "@/components/PricingTiers";
import { founderNote } from "@/lib/team";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${site.name} — ${site.tagline}` },
  description: site.description,
  alternates: { canonical: "https://www.30dayramp.com/" },
};

/** JSON-LD structured data — gives Google + LLM crawlers a clean
 *  understanding of what this business is and what we sell. */
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Ramped AI",
    url: "https://www.30dayramp.com",
    logo: "https://www.30dayramp.com/logo.png",
    description:
      "Done-for-you AI implementation. We build, deploy, and run AI agents inside your operating business — automating your highest-friction workflows on a flat monthly fee.",
    founder: { "@type": "Person", name: "Andrew Yoon" },
    contactPoint: {
      "@type": "ContactPoint",
      email: "jon@30dayramp.com",
      contactType: "Sales",
      areaServed: "US",
      availableLanguage: ["English"],
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Ramped AI",
    url: "https://www.30dayramp.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://www.30dayramp.com/resources?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "AI Agent Implementation",
    provider: { "@type": "Organization", name: "Ramped AI" },
    areaServed: "US",
    description:
      "Done-for-you AI agent implementation for small and mid-size operating businesses. Build, deploy, and run AI agents inside your existing tools (Slack, email, CRM) — 30 days from kickoff to live, or full refund.",
    offers: [
      {
        "@type": "Offer",
        name: "Starter",
        price: "2500",
        priceCurrency: "USD",
        priceSpecification: { "@type": "UnitPriceSpecification", price: "2500", priceCurrency: "USD", unitText: "MONTH" },
      },
      {
        "@type": "Offer",
        name: "Growth",
        price: "5000",
        priceCurrency: "USD",
        priceSpecification: { "@type": "UnitPriceSpecification", price: "5000", priceCurrency: "USD", unitText: "MONTH" },
      },
    ],
  },
];

const faqs = [
  {
    q: "How is this different from hiring an AI consultant?",
    a: "We build and run the agents ourselves. You get working software, not a strategy deck.",
  },
  {
    q: "Do I need technical staff to work with you?",
    a: "No. We handle everything — setup, integration, training, and maintenance. Your team just uses the results.",
  },
  {
    q: "What kinds of businesses do you work with?",
    a: "Established businesses with real workflows to automate. We work best with companies doing $1M+ in revenue that have repetitive, high-volume processes.",
  },
  {
    q: "What if it doesn't work in 30 days?",
    a: "You get a full refund. No questions asked.",
  },
  {
    q: "What does the monthly fee cover?",
    a: "Uptime, maintenance, iteration, and ongoing improvements. As your business grows, we expand the system without a new engagement.",
  },
  {
    q: "How long does onboarding take?",
    a: "Most clients are live within 30 days. We run a structured onboarding — discovery, build, test, launch — and your first automation is typically running in week two.",
  },
];

/** FAQPage structured data — qualifies for rich results in Google SERP. */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const timelineWeeks = [
  {
    num: "01/04",
    week: "Week 1 · Diagnose",
    title: "Map your stack & find the wins.",
    body: "Workshops with your team. Audit of NetSuite, HubSpot, QuickBooks, Slack. Locked deployment plan.",
    width: "25%",
  },
  {
    num: "02/04",
    week: "Week 2 · Build",
    title: "Wire the agents into production.",
    body: "Custom agent built and integrated with your real systems. First workflow running end-to-end in staging.",
    width: "50%",
  },
  {
    num: "03/04",
    week: "Week 3 · Test",
    title: "Pressure-test on real volume.",
    body: "Run agents against last quarter's data. Tune the edges. Approval flows wired into Slack.",
    width: "75%",
  },
  {
    num: "04/04",
    week: "Week 4 · Live",
    title: "Production. Day-one ROI.",
    body: "Agents take live traffic. Daily health checks. Monthly retainer kicks in for ongoing iteration.",
    width: "100%",
  },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
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

      {/* Interactive demo — Slack-style preview of what an AI agent looks like in production */}
      <section className="px-6 py-10">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3 inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-good motion-safe:animate-pulse" /> Day 30 · Live
            </div>
            <h2 className="text-[clamp(28px,3.6vw,42px)] tracking-tight font-bold m-0">
              See what <span className="gradient-text">your AI department</span> looks like.
            </h2>
            <p className="mt-3 text-text-1 leading-relaxed">
              Slack-native. Trained on your data. Pick a workflow — your agent runs it end-to-end.
            </p>
          </div>

          <HomepageDemo />
        </div>
      </section>

      {/* Xtractor proof — founder's prior business as social proof */}
      <section className="px-6 py-16">
        <div className="max-w-[1180px] mx-auto">
          <div className="bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-[20px] p-8 md:p-10 grid md:grid-cols-[auto_1fr] gap-6 md:gap-8 items-start">
            <div className="w-16 h-16 rounded-2xl bg-white grid place-items-center font-bold text-[#0B1220] text-sm tracking-tight">XD</div>
            <div>
              <div className="font-bold text-[18px] text-text-0">Xtractor Depot</div>
              <div className="text-[13px] text-text-2 mt-0.5">Industrial equipment supplier · Founder</div>
              <div className="flex flex-wrap gap-x-8 gap-y-3 my-4">
                <div>
                  <div className="text-[30px] font-bold tracking-tight text-orange-2 leading-none">14h</div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-text-3 mt-1">Saved per week</div>
                </div>
                <div>
                  <div className="text-[30px] font-bold tracking-tight text-orange-2 leading-none">8 min</div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-text-3 mt-1">Response time</div>
                </div>
                <div>
                  <div className="text-[30px] font-bold tracking-tight text-orange-2 leading-none">30d</div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-text-3 mt-1">To live</div>
                </div>
              </div>
              <blockquote className="text-[17px] leading-[1.55] text-text-1 italic m-0">
                &ldquo;Honestly, I was skeptical. We&apos;d tried software before and it always ended up as one more thing to manage. By day 30 we had a live agent handling our quote intake — no babysitting required. <strong className="text-text-0 not-italic">I wish we&apos;d done this two years ago.</strong>&rdquo;
              </blockquote>
              <cite className="block mt-3 text-[14px] text-text-2 not-italic">— Andrew, Founder, Xtractor Depot</cite>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline / How it works */}
      <section id="how-it-works" className="px-6 py-20">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3 inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-2 motion-safe:animate-pulse" /> 30-day deployment · built-in guarantee
            </div>
            <h2 className="text-[clamp(28px,3.6vw,42px)] tracking-tight font-bold m-0">
              From kickoff to <span className="gradient-text">live agents</span> in 30 days.
            </h2>
            <p className="mt-3 text-text-1 leading-relaxed">
              Four weeks. Four milestones. A working AI department by the end of the month — or your money back.
            </p>
          </div>

          <TimelineCards weeks={timelineWeeks} />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-20">
        <div className="max-w-[920px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">FAQ</div>
            <h2 className="text-[clamp(28px,3.6vw,42px)] tracking-tight font-bold m-0">Common questions</h2>
            <p className="mt-3 text-text-1 leading-relaxed">
              We deploy AI agents into your operating business — automating your highest-friction workflows. Flat monthly fee. Go-live guarantee.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-xl px-5 py-4 transition-colors open:border-line-2 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-start justify-between gap-4 cursor-pointer list-none text-text-0 font-semibold text-[15.5px] leading-snug">
                  <span>{f.q}</span>
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-text-3 mt-1 flex-shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <p className="mt-3 text-[14.5px] leading-relaxed text-text-1 m-0">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Pricing</div>
            <h2 className="text-[clamp(28px,3.6vw,42px)] tracking-tight font-bold m-0">
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

          <PricingTiers />
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
            <h2 className="text-[clamp(28px,3.6vw,42px)] tracking-tight font-bold m-0 max-w-3xl mx-auto">
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
