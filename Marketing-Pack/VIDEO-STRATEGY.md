# Video Strategy — Ramped AI

What we learned from the first ChatCut/Seedance attempt + the path forward to actually-good Ramped video assets.

## What went wrong on attempt #1 (ChatCut + Seedance, April 2026)

1. **TTS pronounced "Slack" as "slap"** — auto-TTS doesn't know brand names. Real recording or premium TTS (ElevenLabs with brand tag) fixes this.
2. **Text on laptop / phone screens was gibberish** — every AI video model in 2026 generates text as squiggles. Universal limitation.
3. **Voice pacing was rushed** — script was crammed into 15s. Should have been 25-30s.
4. **"Looks AI"** — the visual aesthetic was clearly AI-generated, which is fine for some channels but a credibility hit for premium B2B.

## What's actually possible with AI video in 2026

| Capability | Quality |
|---|---|
| Cinematic b-roll (no text, no specific brands) | ✅ Very good |
| Stylized motion / atmospheric scenes | ✅ Very good |
| Human emotion / facial expressions | ✅ Good |
| Native audio (ambient, music) | ✅ Good |
| Dialogue / spoken brand names | ⚠️ Use a real human or premium TTS |
| Text on screens, signs, products | ❌ Don't ask the model to render text |
| Specific product UI recreations | ❌ Use real screenshots or HTML overlays |
| Anything resembling "your actual product" | ❌ Use real screen recordings |

Conclusion: **AI video is excellent for cinematic atmosphere, terrible for product accuracy.**

## Three video strategies for Ramped

### Strategy 1: Pure AI video (Higgsfield + Seedance 2.0)

**Best for:** Social ads (Reels, TikTok, LinkedIn), where AI aesthetics are accepted

**Workflow:**
1. Sign up for Higgsfield
2. Generate 3-4 cinematic clips (5-10s each) — operator at desk, golden hour, relief moment, premium feel
3. NO text on screens, NO spoken brand names in the prompt
4. Stitch in CapCut or ChatCut
5. Add real-human voiceover OR ElevenLabs Premium TTS with brand pronunciations tagged
6. Add captions for every brand mention (Slack, HubSpot, etc.)

**Cost estimate:** $34/mo Higgsfield + ~3 hours of editing

**Output:** 15-30s social ad

**Use case:** LinkedIn paid, Instagram Reels, TikTok ads

---

### Strategy 2: Real product video (HTML mockup + screen record)

**Best for:** Homepage hero embed, /demo page, sales emails, conference demos

**Workflow:**
1. Use existing pixel-perfect HTML Slack mockup we built on 30dayramp.com hero
2. Screen-record it animating (Loom, ScreenFlow, OBS — any screen recorder)
3. Real human voiceover (Andrew or hire a VO artist on Voices.com)
4. Edit in CapCut or Descript (Descript handles voiceover better)
5. Add captions, end card with CTA

**Cost estimate:** $0 (we already have the HTML) + $50-200 if hiring a VO artist + ~2 hours editing

**Output:** 30-60s product demo

**Use case:** Homepage embed, sales process, customer testimonials, evergreen content

**This is what Stripe / Linear / Notion all do.** Not because they can't afford AI video — because their real product looks better than AI.

---

### Strategy 3: Hybrid (recommended)

**Best for:** Premium B2B ad spots that need both cinematic feel AND product credibility

**Workflow:**
1. **0:00-0:03** — Seedance b-roll: cinematic shot of operator at desk, hands hovering over keyboard, soft golden light. No screens visible. (Atmosphere)
2. **0:03-0:12** — Screen recording of HTML Slack mockup: customer message → bot reply → ✓ Replied confirmation. Crystal clear product accuracy.
3. **0:12-0:15** — Seedance b-roll: pull back, operator leans back, slight smile. "Live in 30 days. Or it's free." caption appears. Logo + URL.
4. **Voiceover throughout:** Real human (Andrew or VO actor)
5. **Captions:** Every brand name + key claim

**Cost estimate:** $34 Higgsfield + ~$100-200 VO + ~3-5 hours editing = **~$150-300 total**

**Output:** 15-second polished hybrid ad that looks both premium and real

**Use case:** LinkedIn paid sponsored content, conference reels, sales decks

## Prompt template for Higgsfield Seedance 2.0 (NO failure modes)

When you sign up for Higgsfield and we generate the first clip, this is the prompt we'll use:

```
Cinematic close-up shot of a person sitting at a clean modern desk with a 
glowing laptop. Soft golden hour light through a window behind them. 
Hands hover over the keyboard, then relax. The person's expression shifts 
from tension to relief. Camera slowly pushes in from medium-shot to close-up 
on their face. Shallow depth of field, premium B2B brand aesthetic. 
Color palette: warm whites, soft blues, muted shadows. 5 seconds. 
Smooth dolly motion, 4K cinematic feel. Native ambient audio: 
soft keyboard tap once, then quiet office ambience.
NO TEXT visible on any surface. NO logos. NO product UI. 
Empty laptop screen or screen turned away from camera.
```

The key constraints in this prompt:
- "NO TEXT visible" — prevents gibberish
- "NO logos / NO product UI" — prevents fake-product confusion
- "Empty laptop screen or screen turned away" — gives Seedance a pass on the screen content
- Specific cinematic direction — gives it a clear stylistic target

## What about ChatCut?

ChatCut is fine for **editing existing footage** — it's a video editor with AI shortcuts. The "URL to Ad Video" template is a one-click pipeline that's good enough for ecommerce ads but too lossy for premium B2B.

**Use ChatCut for:**
- Cutting and assembling clips
- Auto-captions
- Color matching across clips
- Quickly editing talking-head footage

**Don't use ChatCut for:**
- Brand-critical product demos
- Anything where text accuracy matters
- The hero video on a $5K/mo SaaS homepage

## ElevenLabs for voice (the TTS fix)

If we're using TTS instead of a real human voiceover:

- **ElevenLabs** (elevenlabs.io) — best-in-class TTS, can clone Andrew's voice with 60s of audio sample
- **Brand pronunciation:** ElevenLabs supports IPA (phonetic) overrides per word
- **Cost:** $5-22/mo

For the Slack pronunciation fix:
- In ElevenLabs, tag "Slack" with phonetic override `/slæk/`
- Tag "HubSpot" with `/ˈhʌbspɒt/`
- Tag "Ramped Bot" with `/ræmpt bɒt/`

These overrides last across all generations once set.

## Going forward

1. **Don't run another ChatCut auto-pipeline** unless we explicitly want a quick-and-dirty social ad
2. **Sign up for Higgsfield** (or fal.ai with B2B verification) to access Seedance 2.0 directly
3. **Sign up for ElevenLabs** (or hire a VO artist) for the voice
4. **Use the HTML Slack mockup** for product shots — that's our real differentiator
5. **Always combine** Seedance for atmosphere with real screen content for accuracy

## Asset roadmap (next 60 days)

| Asset | Tool | Length | Use |
|---|---|---|---|
| Hero homepage video | HTML mockup screen-record | 30s | Embed below the fold |
| LinkedIn ad (cinematic) | Seedance hybrid | 15s | Paid LinkedIn |
| LinkedIn ad (founder) | Webcam + ElevenLabs captions | 30s | Paid LinkedIn |
| TikTok/Reels (Day 1-30) | Seedance + transitions | 30s | Organic reach |
| Customer story | Real customer interview | 60s | About + sales |
| Founder origin story | Real Andrew interview | 90s | About + content |

After 60 days, evaluate engagement and double down on the format that converts.

---

*Strategy doc last updated 2026-04-30. Update after first Higgsfield generation lands.*
