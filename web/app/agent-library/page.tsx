import type { Metadata } from "next";
import { Card } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Agent library — what an AI department actually does, all day",
  description: "Four scenarios from production deployments, played out workflow-by-workflow. No demos. No marketing magic. Just the work.",
  alternates: { canonical: "https://www.30dayramp.com/agent-library" },
};

const scenarios = [
  {
    eyebrow: "Sales · Inbound lead routing",
    title: "Sara hits the demo form. 47 seconds later, she's booked.",
    body:
      "A new lead lands. The agent enriches the company against your ICP, scores the fit, drafts a tailored response, and slots a calendar time — before your AE has finished their coffee.",
    stats: [
      { label: "Time to touch", value: "47s" },
      { label: "Pipeline added", value: "$12.4K" },
      { label: "Hours saved",   value: "18 / wk" },
    ],
    flow: ["HubSpot", "Slack", "Calendar"],
  },
  {
    eyebrow: "Operations · Inventory",
    title: "The reorder agent doesn't sleep through Q4.",
    body:
      "Watches stock levels in NetSuite, cross-references the SKU forecast against open orders, and drafts purchase orders to your top vendors automatically — surfaced in Slack for one-click approval.",
    stats: [
      { label: "Stockouts", value: "↓ 73%" },
      { label: "Reorder cycle", value: "4 → 1d" },
      { label: "Hours saved", value: "11 / wk" },
    ],
    flow: ["NetSuite", "Slack"],
  },
  {
    eyebrow: "Finance · Variance reporting",
    title: "Friday financials in 4 minutes.",
    body:
      "Pulls the week's QuickBooks ledger, compares against budget, flags the variances over your threshold, drafts a clean memo with explanations — emails you the PDF before noon every Friday.",
    stats: [
      { label: "Report time", value: "3hr → 4m" },
      { label: "Variance flags", value: "100% covered" },
      { label: "Hours saved", value: "7 / wk" },
    ],
    flow: ["QuickBooks", "Email"],
  },
  {
    eyebrow: "Sales · Call qualifying",
    title: "MEDDIC-scored Gong recap, in your inbox at 6am.",
    body:
      "Yesterday's calls get transcribed by Gong, scored against MEDDIC by the agent, summarized into a one-pager per deal, and synced back to HubSpot — all before your AEs are awake.",
    stats: [
      { label: "Call admin",   value: "↓ 90%" },
      { label: "MEDDIC fields", value: "Auto-filled" },
      { label: "Hours saved",  value: "9 / wk per AE" },
    ],
    flow: ["Gong", "HubSpot"],
  },
];

export default function AgentLibraryPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-10">
        <div className="max-w-[1180px] mx-auto">
          <h1 className="text-[clamp(36px,5vw,56px)] tracking-tight font-bold leading-[1.06] m-0 max-w-3xl">
            What an AI department <span className="gradient-text">actually does, all day.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-text-1 text-[16.5px] leading-relaxed">
            Four scenarios from production deployments, played out workflow-by-workflow. No demos. No marketing
            magic. Just the work.
          </p>
        </div>
      </section>

      <section className="px-6 py-8">
        <div className="max-w-[1180px] mx-auto grid lg:grid-cols-2 gap-5">
          {scenarios.map((s) => (
            <Card key={s.title} className="p-7">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-blue-2 font-semibold mb-3">{s.eyebrow}</div>
              <h2 className="m-0 text-[clamp(20px,2vw,26px)] tracking-tight font-bold leading-tight">{s.title}</h2>
              <p className="mt-3 text-text-1 text-[15px] leading-relaxed">{s.body}</p>

              <div className="mt-5 flex items-center gap-2 flex-wrap text-[12px] font-mono uppercase tracking-[0.06em] text-text-3">
                {s.flow.map((step, i) => (
                  <span key={step} className="inline-flex items-center gap-2">
                    <span className="px-2 py-1 rounded-md bg-bg-3 border border-line text-text-1">{step}</span>
                    {i < s.flow.length - 1 && <span className="text-text-3">→</span>}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                {s.stats.map((st) => (
                  <div key={st.label} className="bg-bg-2 border border-line rounded-lg p-3 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-3">{st.label}</div>
                    <div className="mt-1 text-orange-2 font-bold text-[18px] tracking-tight">{st.value}</div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="max-w-[1180px] mx-auto">
          <Card className="text-center p-12 bg-gradient-to-br from-blue/[0.08] via-bg-2 to-orange/[0.06]">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">
              These are real deployments — not roadmaps
            </div>
            <h2 className="text-[clamp(28px,3.4vw,44px)] tracking-tight font-bold m-0">
              Want one running in <span className="gradient-text">your stack?</span>
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-text-1 leading-relaxed">
              30-day go-live or your money back. We&apos;ll scope which of these fits your business on the call.
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
