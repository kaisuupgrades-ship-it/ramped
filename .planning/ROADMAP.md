# Roadmap: Ramped AI — M1 Revenue Ready

## Overview

M1 takes the existing brownfield site (landing page, booking, admin, questionnaire) from "working but vulnerable and unbillable" to "secure, paying clients onboarded end-to-end." Security hardening comes first — no payments accepted on a vulnerable system. Stripe payments come second (revenue blocker). The client portal ships third so paying clients have somewhere to land. Operational tooling (VPS deploy script, agent templates) rounds out M1 and enables repeatable client delivery at scale.

**Milestone:** M1 — Revenue-Ready
**Granularity:** Fine (8 phases)
**Total Requirements:** 46

---

## Phases

- [ ] **Phase 1: Critical Security Fixes** - Resolve the 3 critical + database schema issues that must be closed before accepting any payment
- [ ] **Phase 2: Security Hardening Sweep** - Apply the remaining high/medium audit items; replace in-memory rate limiter; fix frontend UX regressions
- [ ] **Phase 3: Portal & Data Integrity** - Email-change confirmation flow, signed endpoints for map/roadmap, schema migration cleanup, test infrastructure
- [ ] **Phase 4: Stripe Payments** - End-to-end Checkout, webhook processing, and payment confirmation email
- [ ] **Phase 5: Client Portal Core** - Admin-initiated client account creation, portal link delivery, phase timeline, billing status
- [ ] **Phase 6: Portal Activity & Support** - Agent activity feed, weekly digest view, support ticket UI
- [ ] **Phase 7: VPS Deploy Script** - Repeatable, idempotent bash script that provisions a client VPS from zero
- [ ] **Phase 8: Agent CLAUDE.md Templates** - Reusable starting-point templates for the four core agent types

---

## Phase Details

### Phase 1: Critical Security Fixes
**Goal**: The three open critical vulnerabilities and highest-impact data issues are closed before any payment path is opened
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-05, SEC-06, SEC-08
**Success Criteria** (what must be TRUE):
  1. Admin token is stored in sessionStorage (not localStorage); no existing page reads from localStorage for the token
  2. Google OAuth start endpoint requires Bearer auth; the OAuth state param contains an HMAC-signed ephemeral token, not the raw ADMIN_TOKEN
  3. Submitting the questionnaire without a valid booking_id returns 400; no Claude call or email is triggered
  4. Migration 006 applied: agent_runs table has the 004-schema columns (agent_id, booking_id, action, outcome, hours_saved); legacy table renamed
  5. Migration 007 applied: RLS enabled on portal, agent, and Stripe tables
**Plans**: TBD

### Phase 2: Security Hardening Sweep
**Goal**: All remaining high and medium audit findings are addressed; rate limiting is production-grade; frontend UX regressions removed
**Depends on**: Phase 1
**Requirements**: SEC-03, SEC-07, SEC-09, SEC-10, SEC-11, SEC-12, SEC-13, SEC-14, SEC-15, UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. Cloudflare Turnstile token is required on /api/book, /api/contact, and /api/questionnaire; requests without a valid token receive 400
  2. Rate limiting is enforced via Upstash Redis; limit holds across multiple serverless container instances (not per-container in-memory Map)
  3. getClientIp returns x-real-ip (Vercel-set); X-Forwarded-For is not used as the primary rate-limit key
  4. about.html loads styles from /styles.css with no Tailwind CDN script tag present in the page source
  5. Mobile nav on comparison.html opens, closes on link click, and closes on Escape keypress
**Plans**: TBD

### Phase 3: Portal & Data Integrity
**Goal**: Email-change is safe, public map/roadmap endpoints require signed tokens, schema and logger are aligned with migration 006, and auth helpers have test coverage
**Depends on**: Phase 1
**Requirements**: SEC-04, UX-04, PORTAL-08, PORTAL-09, INFRA-01, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Changing a portal email address sends a confirmation link to the new address and a security notice to the old; the change is not applied until the confirmation link is clicked
  2. Calling /api/get-map or /api/get-roadmap with a bare UUID returns 401; a valid HMAC-signed token is required
  3. api/_lib/logger.js writes to the 004-schema agent_runs columns (agent_id, booking_id, action, outcome, hours_saved)
  4. Unit tests pass for admin-auth.js (constant-time compare), map-token.js (sign/verify), and cron-auth.js (bearer check)
  5. package.json engines field specifies Node >=20; admin endpoint tests run in CI with ADMIN_TOKEN set
**Plans**: TBD

### Phase 4: Stripe Payments
**Goal**: A prospect can complete payment for Starter or Growth plan via Stripe Checkout without any admin intervention; webhooks update booking state automatically
**Depends on**: Phase 1, Phase 2 (Turnstile must be live before Checkout is public)
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-08, INFRA-02
**Success Criteria** (what must be TRUE):
  1. Visiting /book and selecting a plan tier and billing cadence shows a "Pay now" CTA that opens a Stripe Checkout session for the correct price
  2. billing_cadence is persisted to the bookings row at booking time (monthly or annual, not null)
  3. After successful Checkout, the webhook fires within 30 seconds and the booking row reflects paid status
  4. Client receives a "You're in — here's your portal link" email within 60 seconds of payment completing
  5. Stripe Product/Price IDs are fetched from Supabase config table on repeat calls (no duplicate product creation)
  6. Stripe webhook test suite passes: signature verification, duplicate-event replay returns 200+skipped, booking status update verified
**Plans**: TBD
**UI hint**: yes

### Phase 5: Client Portal Core
**Goal**: Admin can create a client account and assign it to a booking; client can log into the portal and see their engagement phase and billing status
**Depends on**: Phase 3, Phase 4
**Requirements**: PORTAL-01, PORTAL-02, PORTAL-03, PORTAL-05, PAY-07
**Success Criteria** (what must be TRUE):
  1. Admin can select any paid booking in the dashboard and click "Create client account" — portal link is generated and client email populated
  2. Client clicking the signed portal link sees the 6-phase timeline with their current phase highlighted
  3. Client portal shows current plan tier (Starter/Growth), billing cadence, and next payment date sourced from Stripe subscription data
  4. Admin dashboard booking row shows payment status (unpaid / paid / subscription active) without leaving the dashboard
  5. Portal link expires after 90 days; a new link can be sent from the admin dashboard
**Plans**: TBD
**UI hint**: yes

### Phase 6: Portal Activity & Support
**Goal**: Client portal shows live agent activity, weekly digest data, and lets clients submit support tickets
**Depends on**: Phase 5
**Requirements**: PORTAL-04, PORTAL-06, PORTAL-07
**Success Criteria** (what must be TRUE):
  1. Client portal activity feed shows the last 10 agent_runs with action, outcome, and hours_saved for their account
  2. Portal displays a "This week" summary card showing total hours saved and tasks completed (sourced from agent_runs past 7 days)
  3. Client can submit a support ticket from the portal and see all prior tickets with their status
  4. Agent activity feed shows "No activity yet" state when agent_runs is empty (not an error or blank screen)
**Plans**: TBD
**UI hint**: yes

### Phase 7: VPS Deploy Script
**Goal**: A bash script reproducibly provisions a client VPS from zero to a running nanoclaw agent daemon; re-running is safe
**Depends on**: Phase 4 (payments confirm clients exist to deploy for)
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-06
**Success Criteria** (what must be TRUE):
  1. Running the deploy script on a fresh Ubuntu VPS installs nanoclaw, writes env config, and starts the agent daemon without manual steps
  2. Running the same script a second time on an existing VPS completes without error and does not restart a healthy daemon
  3. Script prints a health report at the end: which services are running, API connectivity verified, agent daemon PID
  4. Admin dashboard (or CLI) has a "Deploy to VPS" action that accepts host/credentials and triggers the script remotely
**Plans**: TBD

### Phase 8: Agent CLAUDE.md Templates
**Goal**: A library of four ready-to-use CLAUDE.md agent templates covers the core Ramped AI use cases; each can be deployed to a client VPS as-is
**Depends on**: Phase 7
**Requirements**: OPS-04, OPS-05
**Success Criteria** (what must be TRUE):
  1. Templates exist for: lead-follow-up, CRM entry, email triage, and scheduling agents
  2. Each template contains: role definition, tools available, workflow steps, escalation rules, and at least two example inputs/outputs
  3. A new client agent can be deployed by copying the relevant template, filling in four env vars, and running the deploy script
  4. Templates are stored in the repo under a discoverable path (e.g., templates/agents/) and registered in materials.json
**Plans**: TBD

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Critical Security Fixes | 0/TBD | Not started | - |
| 2. Security Hardening Sweep | 0/TBD | Not started | - |
| 3. Portal & Data Integrity | 0/TBD | Not started | - |
| 4. Stripe Payments | 0/TBD | Not started | - |
| 5. Client Portal Core | 0/TBD | Not started | - |
| 6. Portal Activity & Support | 0/TBD | Not started | - |
| 7. VPS Deploy Script | 0/TBD | Not started | - |
| 8. Agent CLAUDE.md Templates | 0/TBD | Not started | - |
