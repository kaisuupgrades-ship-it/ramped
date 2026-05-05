/**
 * No-op middleware — intentional.
 *
 * We tried Clerk's clerkMiddleware here originally, but Clerk's newer SDK
 * imports Node-only APIs (#crypto, safe-node-apis) that don't run in Vercel's
 * Edge runtime. Next.js 15.2 added experimental nodejs runtime for middleware,
 * but it's still flag-gated and not stable enough to rely on.
 *
 * Instead, auth is enforced at the page/route level via auth.protect() inside
 * server components and route handlers. See app/admin/page.tsx for the pattern.
 * This keeps the middleware step lightweight and the runtime question moot.
 */
export default function middleware() {
  // intentionally empty
}

export const config = {
  // Match nothing — middleware doesn't run on any path. Page-level auth checks
  // handle protected routes.
  matcher: [],
};
