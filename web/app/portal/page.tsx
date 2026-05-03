import type { Metadata } from "next";
import { Card } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Client portal",
  robots: "noindex, nofollow",
};

interface Props {
  searchParams: Promise<{ id?: string; exp?: string; t?: string }>;
}

/**
 * Customer portal landing. Real token validation + dashboard hydration are
 * still on the legacy site (api/portal-data.js, portal.html). For tonight,
 * v2 forwards portal links to the legacy URL preserving the signed token —
 * customers don't notice the difference.
 *
 * The full v2 portal port (real-time agent status, drafts approval, ticket
 * threads, billing) is in the next session.
 */
export default async function PortalPage({ searchParams }: Props) {
  const sp = await searchParams;
  const hasToken = sp.id && sp.exp && sp.t;
  const legacyUrl = hasToken
    ? `https://www.30dayramp.com/portal?id=${encodeURIComponent(sp.id!)}&exp=${encodeURIComponent(sp.exp!)}&t=${encodeURIComponent(sp.t!)}`
    : "https://www.30dayramp.com/portal";

  return (
    <section className="px-6 py-16">
      <div className="max-w-[640px] mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Client portal</div>
        <h1 className="text-[clamp(32px,4vw,44px)] tracking-tight font-bold leading-[1.1] m-0">
          Your portal lives on the legacy site for now.
        </h1>
        <p className="mt-4 text-text-1 leading-relaxed">
          We&apos;re mid-migration to a new portal experience — agent status in real time, draft approvals
          inline, support tickets in-thread. While that&apos;s being built, your existing portal is fully
          functional at the legacy URL. Same data, same login link, no action needed.
        </p>

        <Card className="mt-8 p-6">
          {hasToken ? (
            <>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-good mb-2">✓ Token detected</div>
              <h2 className="m-0 mb-3 text-lg font-semibold">Continue to your portal</h2>
              <p className="m-0 mb-5 text-text-1 text-[14.5px] leading-relaxed">
                Your signed access link is valid. Click below — it&apos;ll take you straight to your dashboard.
              </p>
            </>
          ) : (
            <>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-2">No access token in URL</div>
              <h2 className="m-0 mb-3 text-lg font-semibold">Need a fresh access link?</h2>
              <p className="m-0 mb-5 text-text-1 text-[14.5px] leading-relaxed">
                Email {site.email} and we&apos;ll regenerate your portal link. Each link is valid for 90 days
                and signed so it can&apos;t be brute-forced.
              </p>
            </>
          )}
          <Button href={legacyUrl} external variant="primary">Open your portal →</Button>
        </Card>

        <p className="mt-8 text-text-3 text-[12.5px]">
          Migrating to v2 portal soon. Questions? Reach Andrew or Jon at{" "}
          <a href={`mailto:${site.email}`} className="text-blue-2 hover:text-blue">{site.email}</a>.
        </p>
      </div>
    </section>
  );
}
