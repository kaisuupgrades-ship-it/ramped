import type { Metadata } from "next";
import AdminClient from "./AdminClient";

export const metadata: Metadata = {
  title: "Admin",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

/**
 * Admin landing — bearer-token auth via localStorage. Same pattern as legacy
 * admin.html: paste your ADMIN_TOKEN once, it's stored locally, every API call
 * sends it as `Authorization: Bearer ...`.
 *
 * Clerk SSO is intentionally NOT used here yet — it's the plan once Clerk's
 * Edge-runtime story stabilizes (currently middleware no-ops). Bearer tokens
 * give us the same security posture as the legacy admin without any net-new
 * infra dependencies.
 */
export default function AdminPage() {
  return <AdminClient />;
}
