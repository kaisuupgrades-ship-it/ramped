import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Card } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Admin",
  robots: "noindex, nofollow",
};

/**
 * Admin landing page. Clerk-gated via middleware.ts (matcher: /admin(.*)).
 *
 * The full admin dashboard (Bookings table, Materials tab, Audit log, manual
 * roadmap regen, env health) is being ported in a follow-up session — this is
 * a holding page so the route resolves and shows a clear next step.
 *
 * Until the v2 admin is built out, the legacy admin at /admin (on the legacy
 * deploy domain) remains the source of truth.
 */
export default async function AdminPage() {
  const { userId } = await auth();
  const user = userId ? await currentUser() : null;
  const greetName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? "team";

  return (
    <section className="px-6 py-16">
      <div className="max-w-[760px] mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold mb-3">Internal · Admin</div>
        <h1 className="text-[clamp(36px,5vw,52px)] tracking-tight font-bold leading-[1.06] m-0">
          Welcome back, {greetName}.
        </h1>
        <p className="mt-4 text-text-1 leading-relaxed">
          The full admin dashboard (bookings table, materials, audit log) is being ported into the new app
          this week. While that&apos;s in progress, use the legacy admin for live operations:
        </p>

        <Card className="mt-8 p-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-2">Available now</div>
          <h2 className="m-0 mb-3 text-lg font-semibold">Legacy admin dashboard</h2>
          <p className="m-0 mb-5 text-text-1 text-[14.5px] leading-relaxed">
            Same data, fully working. Bookings, materials, audit log, manual roadmap re-generation — everything
            you need today.
          </p>
          <Button href="https://www.30dayramp.com/admin" external variant="primary">Open legacy admin →</Button>
        </Card>

        <Card className="mt-4 p-6 opacity-80">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-3 mb-2">Coming next session</div>
          <h2 className="m-0 mb-3 text-lg font-semibold">v2 admin dashboard</h2>
          <ul className="m-0 pl-5 text-[14px] text-text-1 leading-[1.7] space-y-1">
            <li>Bookings table with inline edit + cancel</li>
            <li>Materials manager (upload, delete, grid/list view)</li>
            <li>Audit log with filterable timeline</li>
            <li>Manual roadmap re-generation per booking</li>
            <li>Env-health dashboard (Anthropic, Resend, Stripe, Calendar)</li>
            <li>Magic-link client portal token generator</li>
          </ul>
        </Card>

        <p className="mt-10 text-text-3 text-[12.5px]">
          Logged in via Clerk · {user?.emailAddresses?.[0]?.emailAddress ?? userId} · Questions? Email{" "}
          <a href={`mailto:${site.email}`} className="text-blue-2 hover:text-blue">{site.email}</a>
        </p>
      </div>
    </section>
  );
}
