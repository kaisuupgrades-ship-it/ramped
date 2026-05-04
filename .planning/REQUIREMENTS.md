# Requirements — Ramped AI M1 (Revenue Ready)

**Milestone:** M1 — Revenue-Ready (Stripe + Client Portal + Security Hardening)
**Created:** 2026-05-04
**Status:** Active

---

## Requirement Index

### SEC — Security Hardening

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| SEC-01 | Admin token moved from localStorage to sessionStorage; CSP migrated to nonce-based (removes unsafe-inline) | Critical | Audit C2-2 |
| SEC-02 | OAuth state parameter replaced with HMAC ephemeral token (exp + nonce + HMAC), OAuth start endpoint requires Bearer auth | Critical | Audit C2-5 |
| SEC-03 | Cloudflare Turnstile CAPTCHA added to /api/book, /api/contact, and /api/questionnaire endpoints | Critical | Audit C2-4 |
| SEC-04 | Email-change in portal requires confirmation link to new address before applying; security notice sent to old address | High | Audit H2-1 |
| SEC-05 | Email-only questionnaire fallback removed; booking_id required or API returns 400 | High | Audit H2-4 |
| SEC-06 | Migration 006 applied: agent_runs schema collision fixed (001 vs 004 conflict resolved) | High | Audit H2-3 |
| SEC-07 | Rate limiting replaced with Redis/Upstash distributed limiter (not in-memory Map) | High | Audit H2-8 |
| SEC-08 | RLS enabled on portal/agent/Stripe tables via migration 007 | High | Audit H2-7 |
| SEC-09 | getClientIp uses x-real-ip (Vercel-set) as canonical IP, not X-Forwarded-For | Medium | Audit M2-1 |
| SEC-10 | IP_HASH_SALT env var hard-fails if not set (no fallback to default string) | Medium | Audit M2-2 |
| SEC-11 | confirmDialog uses textContent by default; only explicit confirmDialogHtml uses innerHTML | Medium | Audit M2-5 |
| SEC-12 | Upload MIME allowlist tightened to text/plain and text/csv only (text/html removed) | Medium | Audit M2-7 |
| SEC-13 | Stripe webhook idempotency: 409 Conflict correctly returns false from recordEventOnce | Medium | Audit M2-8 |
| SEC-14 | resources-refresh.js uses constant-time safeEqual for secret comparison | Medium | Audit M2-10 |
| SEC-15 | Timezone validated against Intl.supportedValuesOf('timeZone') in availability.js and portal-profile.js | Medium | Audit M2-11 |

### PAY — Payments

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| PAY-01 | Prospect can select Starter ($2,500/mo) or Growth ($5,000/mo) plan at booking and proceed to Stripe Checkout | Critical | PROJECT.md |
| PAY-02 | Stripe Checkout session created server-side with correct price/product for selected tier and billing cadence | Critical | PROJECT.md |
| PAY-03 | billing_cadence persisted to bookings table at booking time (not lost) | High | CONCERNS.md tech debt |
| PAY-04 | Stripe webhook processes checkout.session.completed and subscription events; updates booking payment status | Critical | PROJECT.md |
| PAY-05 | Successful payment triggers portal link generation and onboarding email to client | High | PROJECT.md |
| PAY-06 | Stripe Product/Price IDs cached in Supabase config table on first creation; reused on subsequent calls | Medium | CONCERNS.md tech debt |
| PAY-07 | Admin can view payment status per booking in admin dashboard | Medium | PROJECT.md |
| PAY-08 | Stripe webhook handler has unit test coverage: signature verification, idempotency, event routing | High | CONCERNS.md |

### PORTAL — Client Portal

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| PORTAL-01 | Admin can create a client account and assign it to a booking from the admin dashboard | High | PROJECT.md |
| PORTAL-02 | Client receives a signed portal link via email after payment is confirmed | High | PROJECT.md |
| PORTAL-03 | Client can view their current engagement phase (Pre-kickoff → Kickoff → Discovery → Build → QA → Live) | High | PROJECT.md |
| PORTAL-04 | Client portal shows agent activity feed with recent agent_runs (action, outcome, hours_saved) | High | PROJECT.md |
| PORTAL-05 | Client portal shows billing status (plan tier, next payment date, Stripe subscription state) | High | PROJECT.md |
| PORTAL-06 | Client portal shows weekly digest summary (hours saved, tasks completed this week) | Medium | PROJECT.md |
| PORTAL-07 | Client can submit and view support tickets from the portal | Medium | PROJECT.md (existing portal tickets infra) |
| PORTAL-08 | Portal email-change requires confirmation (SEC-04 dependency — listed for cross-reference) | High | Audit H2-1 |
| PORTAL-09 | logger.js retargeted to new agent_runs schema after migration 006; legacy agent_runs_legacy table retired | High | CONCERNS.md |

### OPS — Operational Tooling

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| OPS-01 | Bash deploy script provisions a fresh VPS from zero: installs nanoclaw, configures env, starts agent daemon | High | PROJECT.md |
| OPS-02 | Deploy script is idempotent: re-running on an existing VPS applies only diffs, does not break running agents | High | PROJECT.md |
| OPS-03 | Deploy script produces a post-deploy health report: services running, connectivity verified | Medium | PROJECT.md |
| OPS-04 | Agent CLAUDE.md template library covers at minimum: lead-follow-up, CRM entry, email triage, scheduling agents | High | PROJECT.md |
| OPS-05 | Each CLAUDE.md template includes: role definition, tools available, workflow steps, escalation rules, example inputs/outputs | Medium | PROJECT.md |
| OPS-06 | Admin can register a new client VPS and deploy agent stack from the admin dashboard (or CLI) | Medium | PROJECT.md |

### UX — User Experience Fixes

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| UX-01 | Tailwind CDN script tag removed from about.html; page styled from /styles.css only | High | CONCERNS.md / CLAUDE.md |
| UX-02 | Mobile nav works on comparison.html (hamburger, drawer close on link click and Escape) | Medium | PROJECT.md |
| UX-03 | Pricing FOUC (flash of unstyled content) eliminated on index.html | Medium | PROJECT.md |
| UX-04 | get-map and get-roadmap endpoints require signed HMAC token (not bare UUID) | High | CONCERNS.md / Audit C1 |

### INFRA — Infrastructure

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| INFRA-01 | Security-critical auth helpers (admin-auth.js, map-token.js, cron-auth.js) have unit test coverage | High | CONCERNS.md |
| INFRA-02 | Stripe webhook handler test coverage: signature verification, idempotency, routing (see PAY-08) | High | CONCERNS.md |
| INFRA-03 | Admin endpoints covered in CI (ADMIN_TOKEN set in test env so admin tests don't skip) | Medium | CONCERNS.md |
| INFRA-04 | Node version pinned in package.json engines field (>=20) | Medium | CONCERNS.md |

---

## Counts

| Category | Total Requirements |
|----------|--------------------|
| SEC | 15 |
| PAY | 8 |
| PORTAL | 9 |
| OPS | 6 |
| UX | 4 |
| INFRA | 4 |
| **Total** | **46** |

---

## Out of Scope (This Milestone)

- Full client dashboard with custom reporting — v2
- White-label portal per client — v3
- Self-serve plan upgrades/downgrades — v2
- Public API for client integrations — v3
- Mobile app — not planned
- Tailwind build pipeline / design token consolidation — v2
- Nonce-based CSP for full XSS mitigation — SEC-01 covers sessionStorage migration; full nonce migration is v2
- Full booking email confirmation with ownership verification — v2

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 2 | Pending |
| SEC-04 | Phase 3 | Pending |
| SEC-05 | Phase 1 | Pending |
| SEC-06 | Phase 1 | Pending |
| SEC-07 | Phase 2 | Pending |
| SEC-08 | Phase 1 | Pending |
| SEC-09 | Phase 2 | Pending |
| SEC-10 | Phase 2 | Pending |
| SEC-11 | Phase 2 | Pending |
| SEC-12 | Phase 2 | Pending |
| SEC-13 | Phase 2 | Pending |
| SEC-14 | Phase 2 | Pending |
| SEC-15 | Phase 2 | Pending |
| PAY-01 | Phase 4 | Pending |
| PAY-02 | Phase 4 | Pending |
| PAY-03 | Phase 3 | Pending |
| PAY-04 | Phase 4 | Pending |
| PAY-05 | Phase 4 | Pending |
| PAY-06 | Phase 4 | Pending |
| PAY-07 | Phase 5 | Pending |
| PAY-08 | Phase 4 | Pending |
| PORTAL-01 | Phase 5 | Pending |
| PORTAL-02 | Phase 5 | Pending |
| PORTAL-03 | Phase 5 | Pending |
| PORTAL-04 | Phase 6 | Pending |
| PORTAL-05 | Phase 5 | Pending |
| PORTAL-06 | Phase 6 | Pending |
| PORTAL-07 | Phase 6 | Pending |
| PORTAL-08 | Phase 3 | Pending |
| PORTAL-09 | Phase 3 | Pending |
| OPS-01 | Phase 7 | Pending |
| OPS-02 | Phase 7 | Pending |
| OPS-03 | Phase 7 | Pending |
| OPS-04 | Phase 8 | Pending |
| OPS-05 | Phase 8 | Pending |
| OPS-06 | Phase 7 | Pending |
| UX-01 | Phase 2 | Pending |
| UX-02 | Phase 2 | Pending |
| UX-03 | Phase 2 | Pending |
| UX-04 | Phase 3 | Pending |
| INFRA-01 | Phase 3 | Pending |
| INFRA-02 | Phase 4 | Pending |
| INFRA-03 | Phase 3 | Pending |
| INFRA-04 | Phase 3 | Pending |

---

*Last updated: 2026-05-04 (initial roadmap)*
