import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/core";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Thanks",
  robots: "noindex, nofollow",
};

interface Props {
  searchParams: Promise<{
    intent?: string;
    date?: string;
    slot?: string;
    booking_id?: string;
  }>;
}

export default async function ThanksPage({ searchParams }: Props) {
  const sp = await searchParams;
  const intent = sp.intent ?? "booking";

  let title = "We got it. Talk soon.";
  let subtitle: React.ReactNode = (
    <>Confirmation in your inbox within 5 minutes. If it doesn&apos;t show, check spam or email <a href={`mailto:${site.email}`} className="text-blue-2 hover:text-blue">{site.email}</a>.</>
  );
  let nextSteps = [
    { label: "Calendar invite", body: "— landing in your inbox now. Add it before you forget." },
    { label: "Pre-call prep", body: "— Andrew personally reviews your answers and builds a tailored automation map before you meet." },
    { label: "The call", body: "— 30 minutes, on Google Meet. We'll walk through the highest-leverage workflows and exact ROI math." },
    { label: "You decide", body: "— no follow-up sequence, no nudge emails. If it's a fit, we send a scope. If not, we go our separate ways." },
  ];

  if (intent === "questionnaire") {
    title = "Got it. We're prepping.";
    subtitle = (
      <>Andrew will review your answers and build a tailored automation map before your call. Look out for it in your inbox shortly.</>
    );
    nextSteps = [
      { label: "Automation map", body: "— a personalized analysis of where AI can take work off your team's plate." },
      { label: "ROI estimate", body: "— honest numbers in dollars and hours, on Starter vs Growth tiers." },
      { label: "On the call", body: "— we'll walk through the map live and answer any questions you have." },
    ];
  } else if (intent === "roadmap") {
    title = "Your roadmap is on the way.";
    subtitle = (
      <>We&apos;ll send your personalized 30-day AI roadmap to your inbox within 24 hours. No call required.</>
    );
    nextSteps = [
      { label: "Your roadmap", body: "— a 6-page PDF tailored to your stack, pain points, and team size." },
      { label: "ROI estimate", body: "— honest dollars + hours saved, on Starter vs Growth." },
      { label: "Want to talk it through?", body: "— book a call any time and we'll walk through it live." },
    ];
  }

  // For booking confirmations with date+slot, personalize the title
  if (intent === "booking" && sp.date && sp.slot) {
    const d = new Date(sp.date + "T12:00:00Z");
    if (!Number.isNaN(d.getTime())) {
      const friendly = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
      title = `Booked for ${friendly}.`;
      subtitle = (
        <>See you at <strong className="text-text-0">{sp.slot}</strong>. Calendar invite is on its way to your inbox.</>
      );
    }
  }

  return (
    <section className="px-6 py-20">
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-good/15 border border-good/40 grid place-items-center mx-auto">
          <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-good">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="mt-7 text-[clamp(36px,5vw,56px)] tracking-tight font-bold leading-[1.06] m-0">
          <span className="gradient-text">{title}</span>
        </h1>
        <p className="mt-5 text-text-1 leading-relaxed">{subtitle}</p>

        <Card className="text-left mt-10 p-7">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-5">What happens next</div>
          <ol className="space-y-4 list-none p-0">
            {nextSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="w-7 h-7 rounded-full bg-blue/10 border border-blue/30 grid place-items-center text-blue-2 text-[12px] font-mono font-bold flex-shrink-0">{i + 1}</span>
                <div className="leading-relaxed text-text-1 text-[14.5px]">
                  <strong className="text-text-0">{s.label}</strong> {s.body}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="mt-10 flex gap-3 justify-center flex-wrap">
          <Button href="/agent-library" variant="secondary">Browse the agent library</Button>
          <Button href="/" variant="primary">Back to home →</Button>
        </div>
      </div>
    </section>
  );
}
