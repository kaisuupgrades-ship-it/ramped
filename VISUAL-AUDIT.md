# Ramped AI — Visual / Brand Audit

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
