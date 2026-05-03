import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/core";
import { team, founderNote } from "@/lib/team";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `Meet the team behind ${site.name} — operators who built the AI department they wished they'd had.`,
  alternates: { canonical: "https://www.30dayramp.com/about" },
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-6 pt-16 pb-12">
        <div className="max-w-[1180px] mx-auto">
          <h1 className="text-[clamp(40px,6vw,68px)] leading-[1.04] tracking-[-0.035em] font-bold m-0 max-w-3xl">
            We&apos;re operators who got tired of{" "}
            <span className="gradient-text">AI consultants who don&apos;t ship.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-text-1 text-[17px] leading-relaxed">
            So we built the company we wished existed — one that builds and runs the agents
            instead of selling you another strategy deck.
          </p>
        </div>
      </section>

      {/* Founder note (full-width prose) */}
      <section className="px-6 pb-20">
        <div className="max-w-[880px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Founder note</div>
          <h2 className="text-[clamp(28px,3.4vw,42px)] tracking-tight font-bold leading-tight m-0 max-w-2xl">
            Why we started Ramped AI
          </h2>
          <div className="mt-6 space-y-5 text-text-1 text-[16.5px] leading-[1.7]">
            {founderNote.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="mt-5 text-text-2 text-[14.5px]">— {founderNote.attribution}, Founder</p>
        </div>
      </section>

      {/* Operating principles */}
      <section className="px-6 py-16">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center mb-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Operating principles</div>
            <h2 className="text-[clamp(28px,3.4vw,42px)] tracking-tight font-bold m-0">How we work, in three lines.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { num: "01", title: "We ship working software.",  body: 'No strategy decks. No "AI roadmap" deliverables. We build agents that run inside your real systems — HubSpot, NetSuite, Slack — and we put them in production.' },
              { num: "02", title: "30 days, or it's free.",     body: "One go-live deadline. One flat fee. If your first agent isn't running in production by day 30, we refund the engagement. No partial payments, no fine print." },
              { num: "03", title: "Operators only.",            body: "We work with companies running real businesses — distribution, services, B2B. Not pre-revenue startups. Not AI-curious enterprises looking for a pilot. Operators who need leverage right now." },
            ].map((p) => (
              <Card key={p.num} className="p-7">
                <div className="font-mono text-[11px] text-blue-2 tracking-[0.1em] mb-4">{p.num}</div>
                <h3 className="m-0 mb-3 text-lg font-semibold">{p.title}</h3>
                <p className="m-0 text-[14.5px] text-text-1 leading-relaxed">{p.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team grid */}
      <section className="px-6 py-16">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center mb-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">The team</div>
            <h2 className="text-[clamp(28px,3.4vw,42px)] tracking-tight font-bold m-0">Small, senior, and shipping.</h2>
            <p className="mt-3 text-text-1 max-w-xl mx-auto leading-relaxed">
              We stay deliberately small so the people scoping your build are the same people writing the code.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {team.map((m) => (
              <Card key={m.id} className="p-7">
                <div className="flex items-center gap-4 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.photo}
                    alt={`${m.name}, ${m.role} of Ramped AI`}
                    width={72}
                    height={72}
                    loading="lazy"
                    className="rounded-full object-cover bg-bg-3 border border-line shrink-0"
                    style={{ objectPosition: m.photoFocal ?? "center" }}
                  />
                  <div>
                    <h4 className="m-0 text-lg font-semibold tracking-tight">{m.name}</h4>
                    <div className="text-blue-2 font-semibold text-[13px] mt-0.5">{m.role}</div>
                  </div>
                </div>
                <div className="w-8 h-px bg-line my-4" />
                {m.bio.map((p, i) => (
                  <p key={i} className="text-[13.5px] text-text-1 leading-[1.7] mb-3 last:mb-4">{p}</p>
                ))}
                <div className="flex flex-wrap gap-1.5">
                  {m.tags.map((t) => (
                    <span key={t} className="text-[11px] font-semibold py-1 px-2.5 rounded-full bg-bg-3 border border-line text-text-2">{t}</span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="max-w-[1180px] mx-auto">
          <Card className="text-center p-12 bg-gradient-to-br from-blue/[0.08] via-bg-2 to-orange/[0.06]">
            <h2 className="text-[clamp(28px,3.4vw,44px)] tracking-tight font-bold m-0">
              Ready to ramp <span className="gradient-text">your AI department?</span>
            </h2>
            <p className="mt-4 text-text-1 leading-relaxed">30-minute discovery call. Free, no commitment.</p>
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
