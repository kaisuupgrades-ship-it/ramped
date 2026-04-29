# Ramped AI — Visual / Brand Audit

> **VISUAL AUDIT v2 — 2026-04-29 (post-PR3, post-portal, post-Stripe)**
> Re-audit by Senior Product Designer. Targets full repo as of `git clone … 2026-04-29`.
> Since v1 (2026-04-27): the **protected pages** (`/admin`, `/dashboard`, `/portal`) shipped without ever being design-audited. The pricing FOUC, mobile nav drift, OG image, favicon, founder credit line, customer-logo strip, and pain illustrations from v1's Tier A all landed. v2 covers (a) the protected pages, (b) cross-page consistency drift introduced by the new pages, (c) Lindy.ai + Gumloop competitive deltas (the user's expanded compset), and (d) Nielsen-heuristic gaps surfaced by reading every page.

---

## v2 — Severity Summary

| #     | Finding                                                                | Tier | File:line                                                     |
|-------|------------------------------------------------------------------------|------|---------------------------------------------------------------|
| V2-A1 | **Protected pages have no design system inheritance.** `/admin`, `/dashboard`, `/portal` declare their own inline `:root` blocks and CSS classes — none reuse `/styles.css`. Drift is structural. | A | `admin.html:13-23`; `dashboard.html:13-23`; `portal.html:15-19` |
| V2-A2 | **JetBrains Mono is referenced on 6 pages that don't load it.** Numbers fall back to system mono (SF Mono on Mac, Consolas on Windows). | A | `admin.html:11`; `dashboard.html:11`; `pricing-onepager.html:8`; `thanks.html:20`; `privacy.html:16`; `questionnaire-preview.html:7` |
| V2-A3 | **Inter weight loadout drifts on 5 pages** (`404`, `logo-concepts`, `questionnaire-preview`, `sales`, `pitch`) | A | each `<head>` |
| V2-A4 | `/admin` and `/dashboard` are 80% structurally duplicated — same auth-card, same shadow box, same color tokens; `/dashboard` was redirected to `/admin` in `vercel.json` but the file is still in the repo. | A | `vercel.json:30-33`; `dashboard.html` |
| V2-A5 | `/portal` welcome banner uses a brand-blue gradient that no other page uses — no other dark surface on a customer-facing page. Reads as "different product." | A | `portal.html:44-50` |
| V2-A6 | **Empty-state copy is filler, not direction.** "Activity tracking comes online during the build phase. You'll see every agent action and milestone here." — passive voice, doesn't tell the customer what to do *now*. | A | `portal.html:1011`; same pattern in 4 other empty states |
| V2-A7 | `confirmDialog` modal in `/admin` has no close-on-Escape, no focus trap, no `role="dialog"`. Failed Nielsen heuristic 3 (User control). | A | `admin.html:1058-1067` |
| V2-B1 | **Hero is still "competent indie SaaS" not premium.** Hero CTA card is a flat box; no real product visualization; the new agent-UI mock from v1 Tier B never landed. | B | `index.html` hero section |
| V2-B2 | **Pricing toggle UX:** the active state is an `inset` button on a pill background — works, but the contrast at the muted/active edge is only ~3.5:1 (fails WCAG AA for non-text indicators). | B | `index.html:706-707` |
| V2-B3 | `/portal` mobile (≤920px) collapses to single column — sidebar (Next call, Team, Quick links) drops *below* the activity feed. The "next call" card is the most-used widget; should pin to top of stack on mobile. | B | `portal.html:41` `@media(max-width:920px)` |
| V2-B4 | `/admin` table at narrow widths (≤900px) horizontal-scrolls a 7-column table. No mobile-first reflow. Admin runs this off their phone occasionally — verified it doesn't survive. | B | `admin.html` bookings table |
| V2-B5 | **`book.html` calendar widget builds with `innerHTML` per render** — first interaction has visible reflow on slow Android. Worth a 2KB calendar template at SSR. | B | `book.html:268,338,362,376` |
| V2-B6 | **Lindy.ai and Gumloop both lead with a *live, interactive* product demo above the fold.** Lindy: "Try it now" inline chat. Gumloop: a working node-graph builder. We have `client-demo.html` (`/demo`) but it's behind a click. | B | scope: homepage hero |
| V2-B7 | **No CSP-nonce migration → every inline `<style>` and `<script>` lives by `'unsafe-inline'`.** This is also a security item (Phase 1 M2-12) but it's a design-system blocker: until we have a build step, inline-only is the only path. | B | `vercel.json:135` |
| V2-C1 | **Per-tier differentiation:** Growth card has `border-color: var(--accent)` but no real "popular" weight. Linear and Notion give their middle SKU a real visual hierarchy via larger card, brighter shadow, micro-illustration. | C | `index.html` pricing cards |
| V2-C2 | **No agent-UI screenshot in the homepage hero.** v1 Tier B1 — still open. This is the single highest-leverage visual upgrade. | C | scope: hero |
| V2-C3 | **Logo mark is still the four-bars SVG** — same as v1 #12. Recognizable at 32px, forgettable at any size. Lindy uses a custom orange "L." | C | `favicon.svg`, every page nav |
| V2-C4 | **Color palette:** still cream/ink/blue. Lindy uses orange-as-primary; Gumloop uses purple. We have `#1F4FFF` which is ~10 other AI startups' primary. A second accent (warm coral or amber-orange) used sparingly on Live/Verified would help. | C | tokens across the codebase |
| V2-C5 | **Real photography:** still zero. About page has team avatar JPGs (good); rest of site has stock SVG illustrations or none. Stripe/Ramp/Notion all use real photography. | C | scope: hero, about, customers |

**Counts:** 7 Tier A · 7 Tier B · 5 Tier C · 19 open items.
**v1 items confirmed FIXED:** v1 #1 hero centered ✓ · v1 #3 founder credit line ✓ · v1 #4 ticker unified ✓ · v1 #5 pain illustrations shipped ✓ · v1 A4/A5 customer-logo strip ✓ · v1 C1/C2/C3 OG image / favicon / apple-touch ✓ (now 215KB / 127KB / 5.8KB) · v1 C6 pricing FOUC ✓ (defaults render `$2,083 /mo` directly).

---

## A. Newly-shipped pages — first-pass audit

### `/portal` (`portal.html`, 67 KB) — Tier B overall

**Bones are right.** The 5-step Kickoff → Discovery → Build → QA → Live timeline is the most important UI pattern for the product (the "is this actually being built?" anxiety the CLIENT-PORTAL-PLAN.md calls out). Visual treatment is solid: `surface` for inactive, `#F0F8F4` + good-green for done, `#EEF3FF` + accent + 3px shadow for active. Heuristic 1 (visibility of system status) is satisfied.

**Issues:**

1. **The welcome banner gradient is off-system.** `linear-gradient(135deg, #0B1220 0%, #1A2748 60%, #1F4FFF 130%)` plus a radial highlight overlay. No other customer-facing page has a gradient like this — it's a unique surface. Either standardize a "hero banner" treatment used in 2–3 places, or kill the gradient and use a flat dark surface (cf. `404.html`'s dark theme — it works because it's restrained).
2. **The "Welcome, $name" headline is generic.** *"Hi {firstName}, your AI department is being built."* — fine pre-launch. After go-live the same banner reads as out-of-date. Two different banners (pre-launch vs. live) plus a phase-aware sub-line would close it.
3. **Empty states are passive (heuristic 1 + 5 violations).** Lines `1003, 1011`, etc. read `"Your agents will be listed here once we've finished discovery..."`, `"Activity tracking comes online during the build phase..."`. These describe absence; they should *direct* the customer's next action ("Complete onboarding to unlock", "Book your kickoff call to get started"). Stripe and Linear do this very deliberately — empty states are the highest-leverage onboarding moments.
4. **Mobile single-column ordering is wrong.** At ≤920px the layout flattens to vertical; the sidebar (Next call · Team · Quick links · Roadmap CTA) sinks *below* the activity feed. The "Next call" CTA — which is the highest-frequency repeat-visit reason — gets pushed below the fold. Pin it to top of stack.
5. **Approvals queue (drafts) renders inline `onclick="decideDraft('${d.id}', 'approve')"` handlers** — see Phase 1 M2-4. Visually it's also chunky — three buttons stacked horizontally + a `<textarea>` inside each card means the queue card is ~280px tall. Linear collapses approval items to single-line until expanded; consider doing the same.
6. **Skip-link is set up correctly. No mobile drawer** — but the portal nav is intentionally minimal (logo + Email Jon + View roadmap). Acceptable.
7. **Profile section** (read-only on the portal but writable via `/api/portal-profile`): no UI in the rendered HTML; appears to be a future phase. Audit M2-1 (account email takeover) is the security counterpart; from a visual angle, when it lands, copy the "Settings · Profile · Notifications" three-tab pattern from Stripe Customer Portal — proven.

**Sample fix (V2-A6 — directional empty states):**
```html
<!-- portal.html — replace passive empty state -->
<div class="empty-state empty-state-direct" style="padding:24px 28px;border:1px dashed var(--line);border-radius:12px;background:var(--surface);">
  <p style="font-size:14px;font-weight:600;color:var(--ink);margin:0 0 6px;">Your agents will appear here.</p>
  <p style="font-size:13px;color:var(--muted);line-height:1.55;margin:0 0 14px;">Once your discovery call is done and the roadmap is finalized, every agent we build will land here with a status pill (Building → Live → Paused).</p>
  <a href="${nextActionUrl}" style="display:inline-flex;gap:6px;align-items:center;padding:8px 14px;background:var(--ink);color:#fff;font-size:13px;font-weight:600;border-radius:8px;text-decoration:none;">${nextActionLabel} →</a>
</div>
```
…where `nextActionUrl` is `/book` if no kickoff yet, `${SITE_URL}/portal#onboarding` if `payment_status==='onboarding_paid'`, etc.

---

### `/admin` (`admin.html`, 97 KB) — Tier B overall

**Functional density is right.** Bookings table + leads + tickets + agents + Stripe actions in one page is the right shape for a 1-person ops console. Echoes the Vercel project dashboard pattern (sidebar + dense table + per-row contextual actions). Won't scale past ~5 customers without filtering, but that's fine — it's the right MVP shape.

**Issues:**

1. **Auth UI is heavier than it needs to be.** `box-shadow: 4px 4px 0 var(--ink)` on the auth card — a "neo-brutalist" treatment that lives nowhere else on the site. Stripe Dashboard auth is intentionally invisible (a single centered card, no shadow, no chrome). Drop the offset shadow; it pulls visual weight away from the input.
2. **Token-input is `type="password"`.** Good. But the placeholder says "Password" and the label says "ADMIN PASSWORD" — we ship a *bearer token*, not a password. Heuristic 2 (match between system and real world) violation, plus it primes the user to type a low-entropy string that won't work. Rename label to "Admin token" + placeholder "Bearer token".
3. **`confirmDialog` modal (line 1058) has zero a11y plumbing.** No `role="dialog"`, no `aria-modal="true"`, no focus trap, no Escape-to-close, no return-focus. Heuristic 3 (User control). Fixable in ~30 lines:
   ```js
   function confirmDialog(htmlMsg) {
     return new Promise(resolve => {
       const bd = document.createElement('div');
       bd.className = 'cdialog-backdrop';
       bd.setAttribute('role', 'dialog');
       bd.setAttribute('aria-modal', 'true');
       bd.innerHTML = '<div class="cdialog-box"><p class="cdialog-msg"></p>…</div>';
       bd.querySelector('.cdialog-msg').innerHTML = htmlMsg; // caller must escape
       document.body.appendChild(bd);
       const lastFocus = document.activeElement;
       const close = result => { document.body.removeChild(bd); lastFocus?.focus?.(); resolve(result); };
       bd.querySelector('.cdialog-confirm').addEventListener('click', () => close(true));
       bd.querySelector('.cdialog-cancel').addEventListener('click',  () => close(false));
       bd.addEventListener('keydown', e => { if (e.key === 'Escape') close(false); });
       bd.querySelector('.cdialog-cancel').focus();
     });
   }
   ```
4. **Bookings table — no zebra striping, no sticky header, no column resize, no per-row affordance hover.** At >50 bookings this becomes hard to scan. Add `position: sticky; top: 0;` to `<thead>`, light hover row highlight, and a count of total/filtered bookings near the table header.
5. **"Tickets" tab (line 1643-1679) has no compose-new-ticket UI on the admin side** — only reply. Acceptable for now (admin doesn't open tickets, customers do via `/portal-tickets`), but the empty state should say so explicitly: *"Customers open tickets from their portal — you'll see them here."*
6. **Stripe action buttons (`💳 Invoice`, line 1716)** are emoji-prefixed. Per CLAUDE.md ("No emoji in customer-facing copy except where deliberately set"). Admin is internal so this is technically OK, but inconsistent — most other admin actions are text-only.
7. **Color contrast:** the `--muted: #5B6272` on `--paper: #FAFAF7` ratio is ~5.7:1 (passes AA for text, fails AAA). For the admin meta lines (`opened ${timeAgo(t.created_at)}`) which are 12px, this is genuinely hard to read on a 13" laptop. Bump muted to `#4A5060` for admin specifically.
8. **No keyboard shortcuts.** Linear-style admin would have `g + b` to jump to bookings, `g + t` for tickets, `/` to focus search. Not blocking — but the gap is felt at >100 bookings.

---

### `/dashboard` (`dashboard.html`, 25 KB) — Tier A: delete or merge

The repo has both `/admin` and `/dashboard`. `vercel.json:30-33` redirects `/dashboard → /admin` (non-permanent). The source file is still a 25KB orphan with its own auth shell.

**Fix:** delete `dashboard.html` from the repo. The route already 302s to `/admin`. Dead code = drift surface (V2-A2 originally manifested here too).

If `/dashboard` was intended as a *customer-facing* dashboard distinct from `/admin` and got mistakenly conflated, surface that intent — but the file's contents (booking list, agent runs) read as admin-internal. My assumption: it's the older admin shell from before `/admin` shipped. Confirm with Jon, then delete.

---

## B. Cross-page consistency drift since v1

### V2-A1 — Protected pages do not reuse `/styles.css`

`admin.html`, `dashboard.html`, and `portal.html` each declare their own inline `:root { --ink, --paper, --line, --muted, --accent, --good, --surface }` block. None loads `/styles.css`. This is by-design (admin is pre-Tailwind), but it means token drift becomes structural — when you change `--accent` site-wide, you have to touch 3 protected pages too. The CLAUDE.md M1 build-pipeline item is the long-term fix.

**Audit table — token consistency across protected pages:**

| Token | `admin.html` | `dashboard.html` | `portal.html` | Canonical |
|-------|--------------|------------------|---------------|-----------|
| `--ink` | `#0B1220` ✓ | `#0B1220` ✓ | `#0B1220` ✓ | `#0B1220` |
| `--paper` | `#FAFAF7` ✓ | `#FAFAF7` ✓ | `#FAFAF7` ✓ | `#FAFAF7` |
| `--line` | `#E6E4DC` ✓ | `#E6E4DC` ✓ | `#E6E4DC` ✓ | `#E6E4DC` |
| `--muted` | `#5B6272` ✓ | `#5B6272` ✓ | `#5B6272` ✓ | `#5B6272` |
| `--accent` | `#1F4FFF` ✓ | `#1F4FFF` ✓ | `#1F4FFF` ✓ | `#1F4FFF` |
| `--accent-2` | (missing) | (missing) | `#0B2A8C` ✓ | `#0B2A8C` |
| `--surface` | `#F5F5F3` ✓ | `#F5F5F3` ✓ | `#F5F5F3` ✓ | `#F5F5F3` |
| `--good` | `#0F7A4B` ✓ | `#0F7A4B` ✓ | `#0F7A4B` ✓ | `#0F7A4B` |
| `--warn` | (uses `--warn-bg`,`--warn-border`) | `#B45309` ✓ | `#B45309` ✓ | `#B45309` |
| `--danger` | `#c0392b` 🔴 | `#c0392b` 🔴 | (missing) | not in palette |
| `--ink-2` | (missing) | (missing) | `#1A2233` ✓ | `#1A2233` |

**Findings:** `--danger: #c0392b` is a brick-red used only in protected pages — it's not in CLAUDE.md's canonical palette. Either add it (it's a useful semantic token) or replace with the existing `--warn`. `--accent-2` is missing on `admin`/`dashboard`; the secondary blue is used on the customer-facing site for CTAs that need a hover state. `--ink-2` only on `portal`.

**Fix:** add a `db/migrations/`-style "design tokens" reference doc and a 1-page protected-pages audit script:
```bash
# scripts/check-tokens.sh
for f in admin.html dashboard.html portal.html; do
  echo "=== $f ==="
  awk '/:root\s*{/,/}/' "$f" | grep -oE '\-\-[a-z0-9-]+\s*:\s*[^;]+;'
done | sort | uniq -c | sort -rn | head -20
```
Run pre-commit. Drift surfaces immediately.

---

### V2-A2 — JetBrains Mono referenced but not loaded on 6 pages

| Page | Loads `JetBrains Mono`? | Uses `JetBrains Mono` in CSS? |
|------|------------------------|------------------------------|
| `admin.html` | ❌ | ✅ (multiple `.btn-action`, table monos) |
| `dashboard.html` | ❌ | ✅ |
| `pricing-onepager.html` | ❌ | ✅ |
| `thanks.html` | ❌ | ✅ |
| `privacy.html` | ❌ | ✅ |
| `questionnaire-preview.html` | ❌ | ✅ |
| every other page | ✅ | ✅ |

**Result on those 6 pages:** the CSS rule `font-family: 'JetBrains Mono', monospace` falls through to the next stack entry — `monospace` — which on macOS resolves to `SF Mono`, on Windows to `Consolas`, on Linux to `DejaVu Sans Mono`. Numbers and "small caps eyebrows" therefore look different from the same elements on the homepage. Especially noticeable in admin's data tables (timestamps, counts) and in portal's metric cards once those merge styles.

**Fix (1 line per page):**
```html
<!-- admin.html, dashboard.html, pricing-onepager.html, thanks.html, privacy.html, questionnaire-preview.html -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

### V2-A3 — Inter weight loadout drift

Per CLAUDE.md the canonical loadout is `Inter:wght@400;500;600;700;800` and `JetBrains+Mono:wght@400;500`. Drift:

| Page | Loaded | Issue |
|------|--------|-------|
| `404.html` | `Inter:400;500;600;700` + `JetBrains+Mono:400;700` | missing `800`; mono `700` instead of `500` |
| `logo-concepts.html` | `Inter:400;600;700;800;900` + `JetBrains+Mono:500` | missing `500`, has `900` |
| `questionnaire-preview.html` | `Inter:400;500;600;700` (no mono) | missing `800` |
| `sales.html`, `pitch.html` | `Inter:400;500;600;700;800;900` + `JetBrains+Mono:500;700` | `900` not in canonical; mono missing `400` |

**Fix:** add a `scripts/check-fonts.sh`:
```bash
for f in *.html; do
  hit=$(grep -oE 'family=Inter:wght@[0-9;]+' "$f" || echo "")
  if [ -n "$hit" ] && [ "$hit" != "family=Inter:wght@400;500;600;700;800" ]; then
    echo "⚠ $f → $hit"
  fi
done
```
Then enforce.

---

## C. Competitor expansion — Lindy.ai, Gumloop

The user asked us to widen the compset beyond v1's `getviktor / whitehorseai / gohighlevel` to add `lindy.ai / gumloop.com` (plus indirectly `automation.agency`, `smythos`, `adept` cited later in Phase 4).

| Vector | Ramped today | Lindy.ai | Gumloop | Verdict |
|--------|--------------|----------|---------|---------|
| Hero pattern | text + dual CTA + customer logo strip | text + **inline live demo** | text + **animated node-graph builder visible above fold** | ❌ Ramped is 2nd-tier — no product visible |
| Time-bound promise | "Live in 30 days" | "Set up in minutes" (different positioning) | "Build in clicks" | ✅ Ramped owns "30 days" — keep |
| Pricing transparency | 3 tiers visible, toggle, refund | hidden (book demo) | self-serve $97/mo + free | ✅ Ramped is more transparent than Lindy, less self-serve than Gumloop |
| Visual hierarchy | mostly cream + accent blue | cream + **orange-as-primary** | dark + purple | ⚠ "blue B2B SaaS" is the most crowded color slot in the category |
| Done-for-you positioning | 100% — refund if not live | hybrid (managed + self-serve) | 100% self-serve | ✅ Ramped is differentiated, but the "how is this different from a $97/mo Gumloop subscription?" objection is real and unaddressed on the page |
| Founder credibility above-fold | "Founded by Andrew Yoon — operator at Xtractor Depot" ✓ | hidden | hidden | ✅ Ramped wins |
| Mobile UX | clean (mobile audit confirms) | smooth | smooth | tie |

**Take-aways:**

- **V2-B6 (highest-leverage Tier B):** add a "see it work" surface above the fold. Even a 30-second silent video of `client-demo.html` running, embedded as a `<video autoplay muted loop playsinline>` in a 720×480 frame, would close most of the gap. The user doesn't need to click — they see the agent process a quote in the time it takes to scan the headline.
- **V2-C4 + objection-handling copy:** add a single section answering *"Why pay $2,500/mo done-for-you when Gumloop is $97/mo self-serve?"* The right answer is in CLAUDE.md (operator confidence, "you don't have time to learn another tool, you have a business to run") but it's nowhere on the site. One section, three bullets, link to comparison page. This has the second-highest leverage.

---

## D. Heuristic-by-heuristic review (Nielsen)

| #  | Heuristic                                | State | Top fix |
|----|------------------------------------------|-------|---------|
| 1  | Visibility of system status              | 🟡 Medium | Portal phase indicator is excellent. **Public site lacks pending-action states** (e.g., post-booking, the questionnaire CTA card on `/book` confirmation has no "you have 3 minutes left" or "saves 15 minutes on the call" hook above the fold). |
| 2  | Match between system and real world      | 🔴 Issue | "Bearer token" framed as "Password" on `/admin` (V2 issue). "Phase 03 / Build" portal copy assumes the customer knows what "Build phase" means. Add 1 sentence of plain-English description per phase. |
| 3  | User control and freedom                 | 🔴 Issue | `confirmDialog` lacks Escape-to-cancel. Booking flow can't go back from confirmation to slot picker without losing form data. Portal "Confirm pause agent?" uses native `confirm()` (line 742) — inconsistent with the styled dialog elsewhere. |
| 4  | Consistency and standards                | 🔴 Issue | Tokens drift across protected pages (V2-A1). Inline `onclick` on portal vs. `addEventListener` elsewhere. Email templates use one set of inline styles, web pages another. |
| 5  | Error prevention                         | 🟡 Medium | Booking form validates well (good). `/portal` lets you click pause-agent with a native `confirm()` — fine for now but don't grow past it. Stripe-invoice "send" is gated by `confirmDialog` ✓. |
| 6  | Recognition rather than recall            | 🟢 OK | Top nav consistent across public pages (after v1 H2 fix). Portal nav minimal but recognizable. |
| 7  | Flexibility and efficiency of use         | 🔴 Issue | No keyboard shortcuts in `/admin` (Linear's strength). No bulk actions on bookings. No saved filters. |
| 8  | Aesthetic and minimalist design           | 🟡 Medium | Public pages are minimalist. Admin/portal are dense but justifiably so. Welcome banner gradient on portal feels "extra" — see V2-A5. |
| 9  | Help users recognize and recover from errors | 🟡 Medium | API endpoints return `{error: "..."}` and the UI mostly renders them — but errors are toast-style alerts (`alert(err.message)` in portal.html) instead of inline. Inline error rendering with retry CTA = standard. |
| 10 | Help and documentation                    | 🔴 Issue | No in-product help. No "what does this mean?" tooltip on tier names. No FAQ in `/portal`. The customer-facing help model is *email Jon* — that's intentional for $2,500–5,000/mo white-glove, but at scale needs a help center. |

---

## E. Prioritized v2 action plan

### 🟢 Tier A — Quick wins (do this week, no designer)

| # | Fix | File:line | Effort |
|---|---|---|---|
| A1 | Add `JetBrains Mono` to the 6 pages missing it | `admin.html:11`, `dashboard.html:11`, `pricing-onepager.html:8`, `thanks.html:20`, `privacy.html:16`, `questionnaire-preview.html:7` | 6 × 1-line edit |
| A2 | Standardize Inter loadout to `400;500;600;700;800` everywhere; JBM to `400;500` | `404.html:13`, `logo-concepts.html:8`, `questionnaire-preview.html:7`, `sales.html:11`, `pitch.html:11` | 5 edits |
| A3 | Delete `dashboard.html`; promote `/dashboard → /admin` redirect to `permanent: true` | `dashboard.html`; `vercel.json:30-33` | 5 min |
| A4 | Rewrite all empty-state copy on `/portal` from "{x} comes online" to "{action you should take}" | `portal.html:1003,1011,732,707` | 30 min |
| A5 | Make `confirmDialog` accessible: add `role="dialog"`, `aria-modal`, focus trap, Escape-to-close, return-focus | `admin.html:1058-1067` | 1 hr |
| A6 | Replace `confirm(...)` in `portal.html:742` with the styled dialog (after A5 makes it shareable) | `portal.html:742` | 10 min |
| A7 | Bump portal welcome banner from custom gradient to a flat `--ink` surface (matches `404.html`'s dark theme); keep the radial highlight if you want richness | `portal.html:44-50` | 20 min |
| A8 | Rename `/admin` "Password" label to "Admin token" + placeholder "Bearer token" | `admin.html` auth screen | 5 min |
| A9 | Drop the `box-shadow: 4px 4px 0 var(--ink)` neo-brutalist offset on auth-card; replace with subtle elevation `0 4px 16px rgba(11,18,32,0.06)` | `admin.html:52`; `dashboard.html` (delete instead per A3) | 5 min |
| A10 | Add `scripts/check-tokens.sh` and `scripts/check-fonts.sh` to run pre-commit | new files | 30 min |
| A11 | Pin `/portal` "Next call" sidebar card to top of single-column stack on ≤920px (move it via CSS `order: -1` when stacked) | `portal.html:41` `@media` block | 15 min |

**Total: ~3–4 hours, all me.**

### 🟡 Tier B — Mid-effort (you + me)

| # | Fix | Effort |
|---|---|---|
| B1 | Add a 30-second silent demo video above the fold on `/` (loop of `client-demo.html` rendering) | 4-6 hrs (record + encode + embed) |
| B2 | Add an objection-handling section *"Why $2,500/mo when self-serve is $97?"* under the pricing block | 2 hrs (copy + design) |
| B3 | Mock-up agent-UI screenshot for hero (CLAUDE-DESIGN-PROMPTS.md Prompt 5) — same as v1 B1, still unbuilt | 2-3 hrs |
| B4 | Re-flow `/admin` bookings table for narrow viewports — currently horizontal-scrolls a 7-col table | 2 hrs |
| B5 | Inline error rendering replacing `alert(...)` in `portal.html` (10 occurrences) | 1.5 hrs |
| B6 | Sticky `<thead>` + zebra striping + per-row hover on `/admin` bookings | 30 min |
| B7 | Pricing toggle: bump active-state contrast for the muted-track edge | 15 min |
| B8 | Portal "Welcome, $name" banner: pre-launch vs. post-go-live variants based on `phase_step` | 1 hr |

### 🔴 Tier C — Designer / branding (when budget unblocks)

| # | Fix |
|---|---|
| C1 | Replace four-bar logo mark with a distinctive single-letter or single-curve mark (CLAUDE-DESIGN-PROMPTS.md Prompt 2) |
| C2 | Introduce a second accent color (warm coral / amber-orange) used for "Verified" / "Live" / "Active" badges; reduce the visual monotony of all-blue accents |
| C3 | Real photography or commissioned illustration on About + Customers + Hero |
| C4 | Per-page OG images for top 4 pages (currently all share `og-image.png`) |
| C5 | Custom dark-theme treatment for `/portal` welcome banner that's part of a system, not a one-off gradient |

---

## F. v2 patches landing in this PR

For Phase 2 I'm **not** auto-applying anything — visual changes carry too many subjective calls. But all Tier A items above are scripted, low-risk, and reversible. Pick the ones to ship and I'll batch them as a focused PR.

The two **build-system / lint scripts** (A10) I'll write now since they're additive and catch regressions:

- `scripts/check-tokens.sh` — fails if a protected page declares a `--*` token outside the canonical palette.
- `scripts/check-fonts.sh` — fails if any page's Inter/JBM weight loadout doesn't match the CLAUDE.md canonical.

---

*v2 audit complete — 2026-04-29. Author: Senior Product Designer engagement. Open issue count: 19 (7 A · 7 B · 5 C). v1 closed: 11.*

---
---

# v1 audit (preserved for context — 2026-04-27)

**Comparison set:** [getviktor.com](https://getviktor.com), [whitehorseai.ai](https://www.whitehorseai.ai/), [gohighlevel.com](https://gohighlevel.com).
**Method:** loaded each above-the-fold + scrolled one fold at the same 1440×900 viewport, took screenshots, compared like-for-like.

The summary up front: **the bones are good, the surface is amateur.** Ramped's copy and information architecture are sharper than Viktor's or HighLevel's. The visual treatment is what's holding it back from feeling like Stripe / Ramp / Notion.

---

## What ramped already does well (don't change these)

1. **Headline is sharper than any of the three competitors.** "Your AI department, live in 30 days." beats Viktor's "Not a tool. A hire." on specificity and beats HighLevel's "The AI-powered business operating system" on differentiation.
2. **Visible pricing.** Viktor and WhiteHorse both hide price (gated behind "Talk to us"). Ramped has tiers, prices, and a toggle on the homepage. That's a confident move.
3. **30-day money-back guarantee.** Viktor offers `$100 in free credits, no CC required`; HighLevel offers a 14-day trial; ramped offers a refund. Refund is the most concrete commitment — keep it.
4. **Narrative structure.** Hero → Problem → How it works → Proof → Pricing → CTA is editorial and clean. Viktor goes hero → features → testimonials. Ramped's flow is better.
5. **Time-bound promise.** "Live in 30 days" is the strongest concrete claim on any of these four sites.
6. **Real testimonial with verified metrics.** Xtractor Depot quote with 14h/wk, 4h→8m, $0 ongoing — this is the kind of social proof Viktor and WhiteHorse don't have.
7. **A11y / SEO baseline.** Skip-links, JSON-LD, mobile drawers, prefers-reduced-motion, sitemap — all the boring foundations are solid. We just shipped that.

---

## What's making ramped feel amateur

### ❌ 1. The hero is flat and undersized

Viktor's hero is **centered**, headline is enormous (≈ 5rem at 1440px), with a subtle topographical line texture in the dark background and a tight three-line layout (pill → headline → subhead → CTA → trust microcopy). Total visual weight ≈ 80% of the above-the-fold.

HighLevel's hero is **left-aligned but the four metric cards under the CTA dominate** (706,563+ / 7B+ / 24M+ / $531M+) — the numbers are the visual.

Ramped's hero is **left-aligned, smaller headline (≈ 3rem), and below it a stats grid with thin blue borders, then a CTA card with a single button, then a money-back badge**. Three competing elements stacked, none of them dominant. It reads like a wireframe — like the real hero hasn't been added yet.

**Fix:** pick one approach and commit. Either (a) move the stats *into* the hero as massive numbers (HighLevel's move), or (b) center the hero, drop the stats grid here, and add a product visualization. I'd vote (a) — keeps the page short and punchy.

### ❌ 2. No customer logo bar above the fold

WhiteHorse has 11 customer logos in a "TRUSTED BY" strip in the second viewport. Viktor has "11000+ workspaces hired Viktor" + "BUILT BY ENGINEERS FROM Meta AI / Oxford / Google / Tesla / Amazon" + "BACKED BY NFDG / bek".

Ramped has nothing comparable until the proof section, which is below the fold for most visitors.

**Fix:** even with one customer (Xtractor Depot), add a "DEPLOYED IN PRODUCTION AT:" strip with the Xtractor Depot logo. It's better than zero. As you land more clients, add their logos. The empty space is not neutral — it actively reads as "no one trusts these guys yet."

### ❌ 3. Founder credibility is hidden

Viktor surfaces "BUILT BY ENGINEERS FROM Meta AI / Oxford / Google / Tesla / Amazon" *above* the third fold. That single strip answers "should I trust these people" before the prospect has to think about it.

Ramped's About page has Andrew's bio (Saint Louis University, Xtractor Depot since 2016, supplied SpaceX and Lucid Motors) — but it's *behind a click*. Most prospects will never see it.

**Fix:** add a single line under the hero CTA: "Founded by Andrew Yoon, ex-CEO of Xtractor Depot (SpaceX, Lucid Motors customer)." Or surface it as a small strip: "BUILT BY OPERATORS WHO'VE SHIPPED TO: SpaceX · Lucid Motors · 200+ other businesses." (Once verified.)

### ❌ 4. Ticker styling drifts between pages

Confirmed via DOM inspection of the live site:

- **Homepage ticker:** JetBrains Mono, 11.5px, weight 500, color rgba(255,255,255,**0.78**), green ● dot separators, 36s scroll.
- **About page ticker:** Inter (default sans), 11px, weight 600, color rgba(255,255,255,**0.55**), bullet • separators, 28s scroll.

Same content, different component. Looks like two different sites stitched together. **Fix:** pick one, delete the other, share the snippet between pages.

### ❌ 5. Section rhythm is monotonous

Every section on the homepage uses the same treatment:

```
[ small mono caps eyebrow ]
[ big bold left-aligned H2 ]
[ body content ]
[ thin border-bottom ]
```

Repeated 6 times in a row. Viktor breaks this by alternating dark/lighter backgrounds, varying compositions (centered vs. split vs. grid), and dropping in product screenshots between text-heavy sections. WhiteHorse uses numbered sections (`01 — / 02 — / 03 —`) and alternating image-on-left, image-on-right, image-on-right.

**Fix:** apply at least three different layout patterns across the homepage. E.g., Hero (centered) → Customer logos (logo strip) → Problem (3-card grid) → How it works (split layout with screenshot per step) → Proof (testimonial + case study card) → Pricing (3-card grid) → CTA (centered). And vary background: cream / white / very-light-blue / cream — not just cream / white / cream / white.

### ❌ 6. Pain section icons are generic

The three pain-icon cards on the homepage use thin stroke SVG icons (clock, dashboard, bullets) on a pale gray pill. They look like icons-from-Heroicons.com, which they probably are. Viktor and HighLevel use custom illustrations or product UI; WhiteHorse uses a custom illustrated style.

**Fix (quick):** swap to a single accent color for the icon strokes (currently `var(--muted)`, switch to `var(--accent)` for blue) and increase the stroke weight. **Fix (real):** commission three custom mini-illustrations (these can be flat / line / mono — doesn't have to be expensive).

### ❌ 7. No product visualization

Viktor hints at the product through feature cards. HighLevel uses massive numbers as the visual. WhiteHorse shows a real agent UI. Ramped shows… text. There is *zero* visual evidence that an AI agent exists.

**Fix:** even a mocked-up screenshot of an agent handling a quote intake (the Xtractor Depot use case) would be 10x more compelling than the current pain icons. A 2-minute embedded video of `client-demo.html` would be even better. This is the single highest-leverage visual change.

### ❌ 8. "Verified" badges with no source

The about-page case study has three green "Verified" badges (14 hrs/wk, 4h→8m, Zero). Nothing to click, no proof page. Reads as theater.

**Fix:** either link each badge to a downloadable case study (PDF or hidden page), or remove the badges entirely. Untrusted "trust marks" subtract trust.

### ❌ 9. Color palette is generic

Cream + ink + blue is the safe Stripe-like move, but it's not memorable. Look at:
- Viktor: dark + warm beige + subtle topographical lines
- WhiteHorse: dark + purple/orange gradient
- HighLevel: dark navy + cyan
- Stripe: actual cream + many accent colors used per-section

Ramped's accent (`#1F4FFF`) is a generic SaaS blue. The cream paper (`#FAFAF7`) is fine but utterly forgettable.

**Fix (cheap):** add subtle texture to the background — Viktor's topographical lines are SVG and small. Ramped's grid is too faint to register.
**Fix (medium):** introduce a second accent color, e.g., a warm coral for "Verified" / "Live" badges, the way Linear uses orange-500 sparingly.
**Fix (bigger):** consider darkening the brand. The 404 page is the only dark-themed page on the site and it actually looks great. A dark-themed homepage hero with the cream below would create real visual contrast.

### ❌ 10. Pricing cards are visually flat

The Growth tier has `border-color: var(--accent)` and a faint linear gradient — but it doesn't *pop*. Viktor's pricing (you have to dig to see it) has dramatic differentiation between tiers; HighLevel makes Pro 2x larger than the others.

**Fix:** make the Growth card 5% taller than Starter/Enterprise, give it a more pronounced shadow, brighten the "Most popular" pill, and consider a subtle glow on hover.

### ❌ 11. Section dividers are all the same

`border-b border-[var(--line)]` is the only transition between sections. It's a flat 1px hairline. Viktor uses gradient fades, larger whitespace, and changes of background color. WhiteHorse uses generous space with no divider needed.

**Fix:** drop the border-b on most sections; let intentional whitespace + background-color shifts do the work. Add a single subtle visual element (a fading horizontal line or a small geometric accent) where you actually want a hard break.

### ❌ 12. Logo is forgettable

The four ascending bar chart icon reads as Generic SaaS Logo #47. WhiteHorse has a custom horse mark. Viktor has a small geometric diamond. HighLevel has two upward arrows.

**Fix:** medium-priority. The wordmark ("Ramped AI") is fine; the bars-icon could go. Or commission something distinctive — even a single letter mark like Linear's "L" or Notion's "N" would be more memorable.

---

## Prioritized action plan

### 🟢 Tier A — Quick wins I can do this week (no designer needed)

| # | Fix | Why | Effort |
|---|---|---|---|
| A1 | Unify the ticker — single component used on `/` and `/about`, JetBrains Mono with green ● dots everywhere | Removes the most obvious "stitched together" signal | 30 min |
| A2 | Replace flat `border-b` section transitions with intentional whitespace + background-color shifts | Removes monotony | 1 hr |
| A3 | Move the homepage stats *into* the hero as massive numbers (HighLevel-style), drop the small stats grid | Makes the hero land harder | 1 hr |
| A4 | Add a "Founded by Andrew Yoon — operator at Xtractor Depot since 2016" line under the hero CTA | Surfaces founder credibility above the fold | 15 min |
| A5 | Add a "DEPLOYED IN PRODUCTION AT:" strip with the Xtractor Depot logo + 2 placeholder grayed-out slots | Better than zero social proof | 30 min |
| A6 | Drop the "Verified" badges on /about *or* link each to a case-study PDF | Removes trust theater | 10 min if removing |
| A7 | Drop the dashed "COO · Coming soon" placeholder on /about | Less "we don't have a team" energy | 10 min |
| A8 | Make the Growth pricing card visibly more prominent (taller, deeper shadow, brighter "Most popular" pill) | Funnels prospects to the better SKU | 30 min |
| A9 | Bump the homepage pain-section icons from `var(--muted)` to `var(--accent)` color + stroke-width 2 | Cheap polish | 10 min |
| A10 | Add subtle topographical-lines or radial-gradient texture behind the hero (replace the faint grid with something registering) | Adds depth | 30 min |

**Total: ~5 hours of work, all reversible, all me. Could ship as PR 7 in one push.**

### 🟡 Tier B — Mid-effort, design judgment required (you + me)

| # | Fix | Effort |
|---|---|---|
| B1 | Mock up an agent UI screenshot for the homepage — even a fake "Quote intake → agent draft → sent" flow. I can write the HTML/CSS for a static one. You decide what content shows. | 2-3 hrs |
| B2 | Re-render the homepage hero into a centered composition (Viktor-style). Need your call on whether to commit to centered. | 2 hrs |
| B3 | Consider darkening the brand — make the hero section dark-themed (like 404.html is now) with cream content sections below | 3-4 hrs |
| B4 | Land 2 more named testimonials. You source the quotes; I wire them in. | depends on you |
| B5 | Verify the SpaceX/Lucid Motors claim (audit C11) and either prove it visually with a logo strip or soften the language | depends on you |

### 🔴 Tier C — Needs a designer (or commissioned AI generation)

| # | Fix |
|---|---|
| C1 | Real OG image (1200×630, ~120KB) — current 5KB version looks broken in social shares |
| C2 | Real `favicon.ico` (multi-resolution from your SVG) |
| C3 | Real `apple-touch-icon.png` (180×180, branded) |
| C4 | 3 custom illustrations for the Pain section (replace generic SVG icons) |
| C5 | Optional: new logo mark (the bar chart is fine but forgettable) |

---

## My recommendation

**Today:** I'll ship Tier A as a focused PR 7 — about 5 hours of my time, no money required, all reversible. After it deploys you'll see a noticeably more polished site.

**This week or next:** we tackle Tier B together. You sourcing testimonials and verifying SpaceX/Lucid; me wiring up a mocked agent UI screenshot.

**When you're ready to invest:** Tier C requires a designer (~$500–2,000 budget for a Fiverr/Upwork pass on icons + OG image + favicon, or up to ~$5K for a real brand pass).

Stripe (PR 6) goes after Tier A. The visual cleanup directly affects every prospect who lands on the site, including the ones we'll eventually push through Stripe. Cleaning the funnel before adding payment is the right order.

---

*Last updated: 2026-04-27. Comparison snapshots at `1440×900` against ramped commit `72a388d` (post-audit-fixes deploy).*
