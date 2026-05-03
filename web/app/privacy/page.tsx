import type { Metadata } from "next";
import { Card } from "@/components/ui/core";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${site.name} collects, uses, and protects your information.`,
  alternates: { canonical: "https://www.30dayramp.com/privacy" },
};

const sections = [
  {
    title: "1. Information we collect",
    paragraphs: [
      "We collect information you give us directly — your name, email, company, role, and the answers you submit on forms (booking, questionnaire, free-roadmap). For active customers, we additionally process operational data inside the systems we integrate (HubSpot, NetSuite, etc.) under the scope of the engagement.",
      "We also collect basic usage data automatically: pages viewed, referring URL, device type, and IP-derived approximate location. We do not buy or rent third-party data about you.",
    ],
  },
  {
    title: "2. How we use it",
    paragraphs: [
      "Your information powers the discovery call (we use your questionnaire answers to prep), the AI roadmap we send you, ongoing communication about your engagement, and product analytics to improve the site.",
      "We use Anthropic Claude to generate personalized roadmap content from your questionnaire answers. Anthropic processes the data per their commercial terms and does not train models on it.",
    ],
  },
  {
    title: "3. Who we share it with",
    paragraphs: [
      "We share data only with the service providers we depend on: Supabase (database), Resend (email), Anthropic (AI generation), Google Calendar (call invites), Stripe (billing for engaged customers). We don't sell or rent your data, ever.",
    ],
  },
  {
    title: "4. Cookies & tracking",
    paragraphs: [
      "We use Vercel Analytics for aggregate page-view analytics. No advertising cookies, no third-party trackers, no behavioral profiling. The customer portal uses signed, time-limited URLs (HMAC, 90-day TTL) — not cookies — for access.",
    ],
  },
  {
    title: "5. Your rights",
    paragraphs: [
      `You can request deletion or a copy of any information we hold about you by emailing ${site.email}. We honor requests within 7 business days.`,
    ],
  },
  {
    title: "6. Security",
    paragraphs: [
      "All connections are encrypted in transit (HSTS, TLS 1.2+). Customer data lives in Supabase Postgres with row-level security. Admin tools are gated behind a bearer token and audit-logged. Sensitive secrets are scoped to the serverless functions that need them.",
    ],
  },
  {
    title: "7. Contact",
    paragraphs: [
      `Questions about this policy? Email ${site.email}. We read everything.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <section className="px-6 py-16">
      <div className="max-w-[760px] mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Legal · Privacy</div>
        <h1 className="text-[clamp(36px,5vw,56px)] tracking-tight font-bold leading-[1.06] m-0">Privacy policy</h1>
        <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-3">
          Last updated · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>

        <Card className="mt-8 p-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-3">On this page</div>
          <ol className="list-decimal pl-5 m-0 space-y-1 text-[14.5px] text-text-1">
            {sections.map((s) => (
              <li key={s.title}><a href={`#${slug(s.title)}`} className="hover:text-text-0">{s.title.replace(/^\d+\.\s*/, "")}</a></li>
            ))}
          </ol>
        </Card>

        <div className="mt-10 space-y-10 text-text-1 text-[15.5px] leading-[1.75]">
          <p>
            This policy describes how <strong className="text-text-0">{site.name}</strong> (&quot;we&quot;, &quot;us&quot;) collects,
            uses, and protects information when you use our website at <strong className="text-text-0">{site.domain}</strong> or
            engage us as a customer.
          </p>
          {sections.map((s) => (
            <div key={s.title} id={slug(s.title)}>
              <h2 className="text-xl font-semibold tracking-tight m-0 mb-3 text-text-0">{s.title}</h2>
              <div className="space-y-3.5">
                {s.paragraphs.map((p, i) => <p key={i} className="m-0">{p}</p>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/^\d+\.\s*/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
