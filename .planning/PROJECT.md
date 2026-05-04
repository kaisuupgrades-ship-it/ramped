# Ramped AI — Project Context

**Last updated:** 2026-05-04 after initialization
**Milestone:** M1 — Revenue-Ready (Stripe + Client Portal + Security Hardening)

---

## What This Is

Ramped AI is a **managed AI agency for SMBs**. We build, deploy, and run AI agents that automate repetitive business operations — lead follow-up, CRM entry, email triage, scheduling, proposals, reporting, support. Clients pay a flat monthly retainer. We handle 100% of infrastructure, AI accounts, and ongoing management.

**URL:** https://30dayramp.com
**Tagline:** "Your AI department, live in 30 days."

The product is:
1. **A marketing + booking site** (30dayramp.com) — drives prospects to discovery calls
2. **A client portal** (in progress) — lets active clients see their agents, activity, and billing
3. **An internal ops system** — admin dashboard, booking management, lead grading

This GSD project covers **the software** (website, APIs, database, client portal). The AI agent delivery service itself (nanoclaw, CLAUDE.md templates, VPS setup) is managed separately.

---

## Core Value

**Prospects can find us, book a call, sign up, and pay — without human intervention.** Everything before and after that (content, ops, clients) compounds from that foundation.

The ONE thing that must work right now: **a prospect can go from landing page → booked call → signed → paid → onboarded without Jon manually chasing anything.**

---

## Current State (Brownfield)

### What's Live and Working
- ✓ Landing page, pricing, comparison, about, demo pages — live at 30dayramp.com
- ✓ Booking flow — Google Calendar integration, email confirmations, Supabase DB
- ✓ Questionnaire — linked to bookings, AI lead grading (A/B/C), stored in DB
- ✓ Admin dashboard — view bookings, questionnaire responses, lead grades, send followups
- ✓ Email flows — booking confirmation, "prepare for your call", post-call followup
- ✓ Security audit v2 — admin auth, CSP, rate limiting, CORS hardening
- ✓ Playwright E2E test suite — booking flow, questionnaire, admin
- ✓ CI/CD via GitHub Actions
- ✓ Materials tab in admin — internal asset registry

### What's Missing (Blocks Revenue)
- ✗ **Stripe payments** — cannot charge clients, #1 blocker
- ✗ **Client portal** — no post-signup experience, clients see nothing
- ✗ **Security critical items** — 3 unresolved critical + 8 high issues from audit v2
- ✗ **VPS deploy script** — manual client setup, not repeatable at scale
- ✗ **Agent CLAUDE.md templates** — no standardized starting points for client agents

---

## Requirements

### Validated (Working in Production)

- ✓ Prospect can view landing page with pricing, comparison, and social proof
- ✓ Prospect can book a 30-min discovery call with available time slot
- ✓ Booking creates Google Calendar event + sends confirmation email with Meet link
- ✓ Prospect receives questionnaire link and can submit pre-call answers
- ✓ Admin can view all bookings, questionnaire responses, and AI lead grades
- ✓ Admin can send post-call followup email from dashboard
- ✓ Admin auth secured with constant-time bearer token compare
- ✓ Rate limiting on all public POST endpoints
- ✓ Playwright E2E tests for critical flows

### Active (In-Progress / Needed)

- [ ] Client can pay for Starter or Growth plan via Stripe Checkout
- [ ] Stripe webhook confirms payment and triggers onboarding
- [ ] Signed client can log into a portal and see their agent activity
- [ ] Client portal shows weekly digest, agent run history, billing status
- [ ] Admin can create and assign a client account from the dashboard
- [ ] OAuth state parameter uses HMAC ephemeral token (not admin token)
- [ ] Admin token not stored in localStorage (sessionStorage + nonce CSP)
- [ ] Email-only questionnaire fallback removed (booking_id required)
- [ ] Turnstile CAPTCHA on book, contact, and questionnaire endpoints
- [ ] Rate limiting moved to Redis/Upstash (not in-memory)
- [ ] agent_runs schema collision fixed (migration 006 applied)
- [ ] get-map and get-roadmap endpoints require signed token (not UUID)
- [ ] Tailwind CDN removed from about.html
- [ ] Mobile nav fixed on comparison.html
- [ ] Pricing FOUC fixed on index.html

### Out of Scope (This Milestone)

- Full client dashboard with custom reporting — v2
- White-label portal per client — v3
- Self-serve plan upgrades/downgrades — v2
- Public API for client integrations — v3
- Mobile app — not planned

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vanilla HTML + Vercel serverless | No build step, fast deploys, low ops overhead | Locked — don't add framework |
| Supabase for database | PostgreSQL with simple REST API, generous free tier | Locked |
| No npm runtime dependencies | Call all APIs via native fetch() | Locked — avoids supply chain risk |
| Stripe for payments | Industry standard, solid webhooks, easy portal | Decided |
| Resend for email | Simple API, good deliverability | Locked |
| One admin token (not multi-user auth) | Internal only, single operator (Jon) | Acceptable for v1 |
| Forward-only SQL migrations | Safe, auditable, no rollback surprises | Locked |
| Pricing: Starter $2,500/mo, Growth $5,000/mo | Competitive with agencies, strong margin | Locked (update all 4 places) |

---

## Stack Summary

- **Frontend:** Static HTML5 + Tailwind CSS v4 (compiled artifact, not CDN)
- **Backend:** Vercel serverless functions (Node.js ≥20, ES Modules, native fetch)
- **Database:** Supabase (PostgreSQL + Storage)
- **Email:** Resend API
- **Calendar:** Google OAuth2 + Calendar API
- **Payments:** Stripe (Checkout + Webhooks) — to be implemented
- **AI:** Anthropic Claude (questionnaire grading)
- **Hosting:** Vercel (static + functions + crons)
- **Testing:** Playwright E2E + axe-core accessibility + Lighthouse

---

## Security Posture (Audit v2 — 2026-04-29)

31 open findings: 5 Critical · 8 High · 12 Medium · 6 Low

**Must fix before first paying client:**
- C2-2: Admin token in localStorage (XSS risk)
- C2-5: OAuth state = raw admin token (leaks to logs)
- C2-4: No CAPTCHA → email bombing vector
- H2-1: Email change without confirmation (account takeover)
- H2-4: Email-only questionnaire fallback (LLM abuse)

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Update Context with current state

---
*Last updated: 2026-05-04 after initialization*
