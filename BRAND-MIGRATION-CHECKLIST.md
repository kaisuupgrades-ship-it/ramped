# Brand Migration Checklist — v2 Arrow Swoop

**Source of truth:** `/favicon.svg` (ChatGPT-authoritative SVG path)
**Migration date:** 2026-04-30 → 2026-05-01

---

## ✅ Done in this codebase (will deploy on next push)

### Core asset files
- [x] `/favicon.svg` — authoritative SVG, navy → cyan gradient
- [x] `/apple-touch-icon.png` — 180×180, regenerated from SVG
- [x] `/android-chrome-192.png` — Android Chrome icon
- [x] `/android-chrome-512.png` — Android Play Store icon
- [x] `/logo-master-1024.png` — App-store / high-res master
- [x] `/logo-lockup.svg` — wordmark lockup, light mode
- [x] `/logo-lockup-dark.svg` — wordmark lockup, dark mode
- [x] `/og-image.png` — **1200×630 link preview** (shows on Slack / LinkedIn / iMessage / X when anyone shares a 30dayramp.com link)
- [x] `/assets/email-logo-bars.png` — transactional email header logo (white-fill arrow on transparent, sized for the dark navy email header)

### Inline-SVG instances on HTML pages (81 total replacements)
- [x] `index.html` — masthead, footer, 5 Slack mockup nano-avatars, 2 mini avatars
- [x] `about.html` — masthead
- [x] `book.html` — masthead, footer
- [x] `comparison.html` — masthead, footer
- [x] `resources.html` — masthead, footer
- [x] `privacy.html` — masthead, footer
- [x] `client-demo.html` — masthead, footer
- [x] `free-roadmap.html` — masthead
- [x] `agent-library.html` — masthead, footer, 4 Slack mockup PFPs (Ops/Sales/Finance/Support), 8 message avatars
- [x] `404.html` — top-left logo
- [x] `questionnaire.html` — nav logo
- [x] `thanks.html` — header logo
- [x] `one-pager.html` — letterhead logo
- [x] `pricing-onepager.html` — letterhead logo
- [x] `portal.html` — client portal nav
- [x] `admin.html` — both auth screen and dashboard

### Brand documentation
- [x] `Marketing-Pack/BRAND-STYLE-GUIDE.md` — v2 path documented as source of truth
- [x] `api/_lib/email-design.js` — email header background updated to new navy `#0A2540`, image dims squared up

---

## ⏭ Intentionally skipped (low priority / different design language)

| File | Why skipped | What it shows now |
|---|---|---|
| `customers/xtractor-depot.html` | Slated for deletion per your earlier instruction | Old bars logo |
| `Marketing-Pack/MARKETING-VISUALS.html` | Internal HTML mock of ad creatives, will be replaced by Higgsfield-generated assets | Old bars logo |
| `sales.html`, `pitch.html` | Internal sales/pitch decks use a stylized "R" letter on blue gradient — different visual treatment from the masthead, intentional for slide format | "R" letter brand-mark |
| `heroes.html` | Inline SVG was a checkmark icon, not a brand logo | Already correct |
| `dashboard.html`, `questionnaire-preview.html`, `roadmap.html`, `map-result.html` | Text-only branding or redirects, no SVG logo to update | Text only |

If you want any of these updated later, ping me — they're 5-10 min of work each.

---

## ❌ NOT in the codebase — you need to update these manually

These live in external dashboards that I can't touch from here. Listed in priority order. Estimated 15-30 minutes total.

### 🔴 Highest priority — visible to customers

#### 1. **Vercel project icon + Open Graph preview**
- Where: [vercel.com/dashboard](https://vercel.com/dashboard) → 30dayramp project → Settings → General
- Upload: `/logo-master-1024.png` as the project avatar
- Vercel will use this in the dashboard, Slack notifications, deployment emails
- **Note:** OG image previews on shared URLs come from `/og-image.png` (already updated in code) — no Vercel action needed for that

#### 2. **Stripe checkout branding**
- Where: [dashboard.stripe.com](https://dashboard.stripe.com) → Settings → Branding
- Upload: `/logo-master-1024.png` as logo, `/apple-touch-icon.png` as icon
- Set primary color: `#006BD6` (royal blue) or `#00D4FF` (cyan accent)
- Background color: `#0A2540` (deep navy) for dark mode, `#FAFAF7` (paper) for light
- This shows on every checkout page + email receipt

#### 3. **Resend email avatar / from-name**
- Where: [resend.com/domains](https://resend.com/domains) → 30dayramp.com → Settings
- Upload favicon: `/apple-touch-icon.png`
- Verify `From Name`: "Ramped AI" (already set per your `email-design.js`)
- Some inboxes (Apple Mail, Outlook iOS) show this avatar next to the sender name

#### 4. **GitHub repo social preview**
- Where: github.com/[your-org]/[your-repo] → Settings → General → Social preview
- Upload: `/og-image.png` (the same 1200×630 file)
- Shows when the repo URL is shared on LinkedIn, Twitter, Slack

### 🟡 Medium priority — visible to team / on internal tools

#### 5. **Google Workspace email signature**
- If you use Gmail's signature feature, update the inline image to `/assets/email-logo-bars.png` (or the lockup PNG)
- Path: Gmail → Settings → See all settings → Signature
- Each Ramped team member needs this updated individually

#### 6. **Calendly / scheduling tool branding**
- Where: Whichever scheduling tool the `/book` flow uses (looks like a custom calendar in `book.html` per the code, but if you have Calendly integration somewhere)
- Upload favicon, set brand colors
- Affects the booking confirmation page customers see

#### 7. **Slack workspace avatar (if Ramped has one for client comms)**
- Slack → Settings → Workspace → Workspace icon
- Upload: `/logo-master-1024.png`

### 🟢 Low priority — internal only

#### 8. **Supabase project icon**
- Internal admin only, not visible to customers
- supabase.com → Project → Settings → Project icon

#### 9. **Anthropic console / API key labels**
- If your console has a project icon for the Ramped API key
- Internal only

#### 10. **Personal LinkedIn / X profile**
- Update banner to match new brand (`/og-image.png` works as a starting point)
- Update profile picture if it's the company avatar

---

## 🎬 Asset re-generations (Higgsfield)

The 22 Higgsfield-generated assets from earlier rounds (PFPs, banners, b-roll videos) used:
- The OLD bars symbol in some cases
- A verbal description of the "arrow swoop" that doesn't exactly match the authoritative path

**Status:** the Higgsfield MCP disconnected mid-session. Round 4 (6 generations queued, ~120 credits) results are retrievable from the Higgsfield dashboard at [higgsfield.ai/projects](https://higgsfield.ai/projects).

**Recommendation:** When you next sit down with Higgsfield, fire one more round using your new authoritative SVG as a reference upload. That'll get pixel-aligned PFPs, banners, and a logo-reveal video. Estimate: 150-200 credits for a clean set.

Old assets in `HIGGSFIELD-ASSET-MANIFEST.md` should be marked `(deprecated, pre-v2 brand)` rather than deleted — they're still usable for "nostalgic" / brand-neutral b-roll where the bars don't appear (e.g. dawn cityscape, hands typing).

---

## Pushing the migration

```bash
cd "/c/Users/Hado/Documents/Claude/Projects/4.29.26 nanoclaw help"
git add -A
git commit -m "Brand identity v2: arrow swoop logo + OG image + email logo migration"
git push origin main
```

After push:
1. Wait ~60s for Vercel to deploy
2. Hard refresh `30dayramp.com` (Ctrl+Shift+R)
3. Test the OG preview by pasting any link into Slack/Discord — should show the new arrow + tagline
4. Send yourself a test booking email to verify the email header looks right

---

*Update this file as you knock things off the list.*
