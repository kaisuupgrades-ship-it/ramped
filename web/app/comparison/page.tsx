import type { Metadata } from "next";
import { Card } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "VA vs AI agents — the honest comparison",
  description: "Same work. Faster. More accurate. A fraction of the cost. And it doesn't quit at month nine for a better offer.",
  alternates: { canonical: "https://www.30dayramp.com/comparison" },
};

const heroStats = [
  { eyebrow: "AVG. ANNUAL COST",  value: "$30K",  sub: "vs $60–90K for a full-time VA team" },
  { eyebrow: "RESPONSE TIME",     value: "< 1 min", sub: "vs 4–8 hours for human follow-up" },
  { eyebrow: "COVERAGE",          value: "24/7",  sub: "vs 40 hrs/week, time-zone gated" },
  { eyebrow: "TIME TO LIVE",      value: "30 days", sub: "vs 6–9 months DIY build" },
];

const dimensions = [
  { dim: "Coverage",          va: "40 hrs/week, time-zone gated",      ai: "24/7, every channel" },
  { dim: "Response time",     va: "4–8 hours typical",                  ai: "Under a minute" },
  { dim: "Onboarding",        va: "4–8 weeks of training, hand-holding", ai: "30-day build, then autonomous" },
  { dim: "Quality drift",     va: "Drops with fatigue + turnover",      ai: "Consistent, version-controlled" },
  { dim: "Cost",              va: "$60–90K/yr fully loaded",            ai: "$30K/yr flat" },
  { dim: "Scaling",           va: "Linear — hire more humans",          ai: "Sub-linear — same agent, more volume" },
  { dim: "Tenure",            va: "18 months avg before exit",          ai: "Always-on, doesn't quit" },
  { dim: "Knowledge capture", va: "Tribal — leaves with the person",    ai: "Codified in the agent" },
  { dim: "Sick days",         va: "Yes",                                 ai: "Never" },
  { dim: "Bias for shipping", va: "Often pilot-locked",                 ai: "30-day go-live or refund" },
];

export default function ComparisonPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-6 pt-16 pb-10">
        <div className="max-w-[1180px] mx-auto">
          <h1 className="text-[clamp(36px,5vw,56px)] tracking-tight font-bold leading-[1.06] m-0 max-w-3xl">
            Why operators are replacing VAs with{" "}
            <span className="gradient-text">AI agents.</span>
          </h1>
          <p className="mt-5 max-w-xl text-text-1 text-[16.5px] leading-relaxed">
            Same work. Faster. More accurate. A fraction of the cost. And it doesn&apos;t quit at month nine
            for a better offer.
          </p>
          <div className="mt-9 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {heroStats.map((s) => (
              <Card key={s.eyebrow} className="p-5">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-3 mb-2">{s.eyebrow}</div>
                <div className="text-[28px] font-bold tracking-tight text-orange-2 leading-none">{s.value}</div>
                <div className="mt-2 text-[12.5px] text-text-2 leading-snug">{s.sub}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-6 py-12">
        <div className="max-w-[1180px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">VA vs AI agents</div>
          <h2 className="text-[clamp(28px,3.4vw,42px)] tracking-tight font-bold m-0 max-w-2xl">10 dimensions. One winner.</h2>
          <p className="mt-3 max-w-2xl text-text-1 leading-relaxed">
            A virtual assistant is a person you have to onboard, manage, and replace. An AI agent is software
            that runs on day one and gets better every week.
          </p>

          <Card className="mt-8 p-0 overflow-hidden">
            <div className="grid grid-cols-[1.4fr_1.3fr_1.3fr] text-[13px]">
              <div className="px-5 py-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-3 border-b border-line">Dimension</div>
              <div className="px-5 py-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-3 border-b border-line border-l border-line">Virtual Assistant</div>
              <div className="px-5 py-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-orange-2 font-semibold border-b border-line border-l border-line">Ramped AI agent</div>
              {dimensions.flatMap((row, i) => {
                const last = i === dimensions.length - 1;
                const b = last ? "" : "border-b border-line";
                return [
                  <div key={`${row.dim}-d`} className={`px-5 py-3.5 text-text-0 font-semibold ${b}`}>{row.dim}</div>,
                  <div key={`${row.dim}-va`} className={`px-5 py-3.5 text-text-2 border-l border-line ${b}`}>{row.va}</div>,
                  <div key={`${row.dim}-ai`} className={`px-5 py-3.5 text-orange-2 border-l border-line ${b}`}>{row.ai}</div>,
                ];
              })}
            </div>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="max-w-[1180px] mx-auto">
          <Card className="text-center p-12 bg-gradient-to-br from-blue/[0.08] via-bg-2 to-orange/[0.06]">
            <h2 className="text-[clamp(28px,3.4vw,44px)] tracking-tight font-bold m-0">
              See <span className="gradient-text">your numbers.</span>
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-text-1 leading-relaxed">
              Tell us your current setup and we&apos;ll show you exact dollar + hour savings on a 30-min call —
              or sent to your inbox if you&apos;d rather skip the meeting.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center">
              <Button href="/book" size="lg" variant="primary">Book a discovery call →</Button>
              <Button href="/free-roadmap" size="lg" variant="secondary">Get your free roadmap</Button>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}

