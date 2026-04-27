# Deploy checklist — PR 1.5 + PR 2 + PR 3 + PR 5

This is the one-shot deploy guide. Three commits, two GUI steps, then verify.

---

## 1. Commit & push the code

From inside the project folder in Git Bash:

```bash
# PR 1.5 — about.html layout fixes (ticker placement, grid balance, section-wrap parity)
git add about.html
git commit -m "PR 1.5: about.html — ticker below nav, 7fr/5fr origin grid with sticky aside, section-wrap parity (1120px), kill mobile-CTA leak"

# PR 2 — pricing tier sync (book.html + index.html toggle hrefs)
git add book.html index.html
git commit -m "PR 2: pricing tier sync — book.html reads ?billing=, index.html toggle updates CTA hrefs, prices match across surfaces"

# PR 3 — backend security (signed URLs, booking_id, idempotent reminders, send-followup auth)
git add api/ db/ map-result.html questionnaire.html book.html
git commit -m "PR 3: backend security — HMAC-signed map/roadmap URLs (audit C1), questionnaire requires booking_id (C2), reminders idempotent (H3), send-followup uses ADMIN_TOKEN (H4), bookings UNIQUE(datetime) migration (H11)"

# PR 5 — a11y/SEO (prefers-reduced-motion, JSON-LD Service, sitemap rebuild, font weights)
git add index.html book.html sitemap.xml
git commit -m "PR 5: a11y/SEO — prefers-reduced-motion, JSON-LD Service on /book, full sitemap, Inter weight 800 on book.html"

# Push everything
git push
```

If you'd rather ship as one commit instead of four, run `git add .` then a single
`git commit -m "Audit fixes: PR 1.5 + PR 2 + PR 3 + PR 5"` and push.

---

## 2. Vercel — add `MAP_LINK_SECRET` env var

PR 3 requires a new env var. Without it, the IDOR-fixed endpoints fail closed
(503) and customer roadmap emails will omit the link rather than ship an unsigned
one.

**Generate a secret** (run this in Git Bash to get a 64-char hex string):

```bash
openssl rand -hex 32
```

Copy the output. It looks like: `3a8f2e...` (64 hex chars).

**Add it to Vercel:**

1. Go to <https://vercel.com/dashboard>.
2. Open your `ramped` project.
3. Settings → Environment Variables.
4. **Key**: `MAP_LINK_SECRET`. **Value**: paste the 64-char hex string.
5. **Environments**: tick **Production**, **Preview**, **Development**.
6. Save.
7. Redeploy: Deployments tab → top deployment → ⋯ menu → **Redeploy**. (Required so the new env var is read.)

---

## 3. Supabase — run the migration

The new file `db/migrations/002_bookings_constraints.sql` adds the `UNIQUE(datetime)`
constraint and the `reminded_24h_at` / `reminded_1h_at` columns the cron now expects.

1. Go to <https://supabase.com/dashboard>.
2. Open the project that backs `30dayramp.com`.
3. Left sidebar → **SQL Editor** → **New query**.
4. Paste the entire contents of `db/migrations/002_bookings_constraints.sql`.
5. Click **Run** (or `Cmd/Ctrl + Enter`).
6. Verify zero errors. If you get `ERROR: could not create unique index ... duplicate key`, two existing bookings share a datetime — run this first to find them:

   ```sql
   select datetime, count(*) from bookings group by 1 having count(*) > 1;
   ```
   Delete or reschedule the duplicates, then re-run the migration.

---

## 4. Verify on the live site

After step 1 deploys (~2 min), step 2's redeploy (~2 min), and step 3 finishes:

| Check | Where | Expected |
|---|---|---|
| Hard-refresh `/about` on desktop | `https://www.30dayramp.com/about` | Ticker is **below** the nav (was above). No duplicate Get-started + hamburger on desktop. Origin section's case-study card sits next to the relevant body text and stays visible while you scroll past the long left column. |
| Hard-refresh `/about` on phone width | DevTools → mobile preview | Hamburger appears top-right. Tap → drawer with About / Demo / VA-vs-AI / Get started. Single-column origin section. |
| Hard-refresh `/comparison` on phone | `/comparison` mobile | Hamburger appears, drawer works. |
| Pricing FOUC | `/` desktop | Pricing card shows `$2,083/mo` instantly on first paint. No flash of `/yr`. |
| Pricing tier sync | Click "Get started →" on Starter card while annual toggle is on | URL becomes `/book?tier=starter&billing=annual`. The booking page tier badge says **`Starter · $2,083/mo (billed annually · save $5,000)`**. Toggle to Monthly first → click Starter → badge says `Starter · $2,500/mo`. |
| OG image on `/about` | Paste `https://www.30dayramp.com/about` into a Slack DM to yourself | Preview card with title, description, OG image (note: image quality is still PR 4's problem). |
| IDOR is patched | Hit a stale unsigned URL like `https://www.30dayramp.com/api/get-map?id=00000000-0000-0000-0000-000000000000` | 403 (`This link is invalid or has expired…`) instead of 404 or 200. |
| Reminder cron health | Vercel → project → Logs → filter `api/reminders` | Should run every 30 min without errors. Log line `Cron reminders complete:` with `sent_24h` and `sent_1h` arrays. |
| Smoke test | Local Git Bash | `bash scripts/e2e-test.sh` against the deployed Vercel URL — should pass. |

---

## 5. If anything explodes

Roll back the most recent commit:

```bash
git revert HEAD
git push
```

Site reverts in ~2 min. If the issue was specifically with PR 3 backend changes,
you can also disable the IDOR check temporarily by removing `MAP_LINK_SECRET`
from Vercel — the endpoints will return 503, which is safe (fails closed) but
blocks customer roadmap viewing until you re-add the secret.

---

## Open items NOT in this batch (PR 4 — assets + content)

These were called out in `AUDIT.md` and need human work:

- **`og-image.png`** — current is 5 KB; needs a real 1200×630, ~120 KB design.
- **`favicon.ico`** — file is referenced everywhere but doesn't exist. Generate a multi-resolution `.ico` from `favicon.svg` (16/32/48 px).
- **`apple-touch-icon.png`** — currently 1.5 KB, looks blank on iOS install. Needs a real 180×180.
- **Verify the SpaceX / Lucid Motors claim** on `about.html` line ~149 ("clients ranging from cannabis operators to SpaceX and Lucid Motors"). Either confirm and add proof, or soften the language.
- **2 more named testimonials** (today the entire social-proof pillar is one quote from Andrew at Xtractor Depot).
- **Drop the dashed "COO · Coming soon" placeholder** on `about.html` until the role is filled, or reframe as "Founder + advisors."
- **Drop or source the "Verified" badges** next to case-study metrics on `about.html`.
- **Set up a real testimonial / case-study one-pager** so the Verified badges link to something.

When you're ready for any of these, ping me with what you've got (asset file, confirmed claim, new quote) and I'll wire it in.
