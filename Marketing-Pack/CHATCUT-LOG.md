# ChatCut Generation Log — Ramped AI Marketing Pack

Running log of every video generated in ChatCut (uses Seedance 2.0 under the hood). Each entry: prompt + project + status + use case + lessons learned.

ChatCut account: kaisuupgrades@gmail.com (Free tier, 1,098.1 starting credits)
Project workspace: https://app.chatcut.io/projects

---

## ❌ Generation 1: URL-to-Ad Auto-Pipeline (failed quality bar)

**Project:** Untitled (8b5856b5-d2f4-4b1b-8e5d-283efca221b7)
**Template:** "URL to Ad Video" (Seedance 2.0)
**Prompt:** Create a 15s UGC ad video for https://www.30dayramp.com/. Analyze product images and key selling points from the page, write a persuasive script, and generate a scroll-stopping native ad.
**Output:** "Ramped AI — UGC Ad 15s" — 0:15 9:16 vertical clip
**Credits used:** ~9
**Status:** Generated, but quality below standard for premium B2B

**What went wrong:**
1. TTS voice pronounced "Slack" as "slap"
2. Text on laptop/phone screens rendered as gibberish
3. Voice pacing was rushed — 4 scenes crammed into 15s
4. Auto-script squeezed too much into too little time

**Lessons learned:**
- Don't use auto-pipelines for premium B2B — they sacrifice quality for speed
- TTS engines can't pronounce brand names without manual phonetic overrides
- AI video models (Seedance, Sora, Kling, Veo) all struggle with text on screens
- Need to split: Seedance for visuals (no text), real human voice for audio, captions added in post

---

## 🔄 Generation 2: Direct Seedance — Exhausted Operator (in progress)

**Project:** Untitled (7f10bf9f-60da-4c4a-b980-2400960acca4)
**Template:** Seedance 2.0 (direct, "Custom" preset)
**Length:** 10 seconds
**Resolution:** 1080p, 16:9
**Prompt:**
> Cinematic close-up of an exhausted operator (mid-30s, business casual, hair slightly disheveled) at a cluttered desk late at night. Three monitors glow with white-blue light, casting reflections on the operator's tired face. They rub their eyes with one hand and stare blankly at the screens. Empty coffee cups, scattered papers, a half-eaten sandwich. Dark moody cinematography, deep blue and amber color palette, high contrast with deep shadows. Camera slowly pushes in from a wide medium shot to a tight close-up on their weary expression. Apple keynote style production value. Native audio: faint ticking clock, distant city ambience through window, the soft hum of a laptop fan. NO text visible on any screens (screens show abstract glowing patterns only). NO logos. NO product UI. 24fps cinematic, photorealistic, 4K quality, shallow depth of field with bokeh on the screens behind.

**Credits used:** -6 (approved)
**Status:** Job ID e51dc7 submitted. "Downloading from provider..." (latest status)

**Use case:** "Hook" scene for a 30-day Ramped commercial — emotional pain-state opening that the audience identifies with. Pairs with the "relief scene" (Generation 3, planned) and "logo close" (Generation 4, planned).

---

## 🔜 Queued generations (next prompts)

### Generation 3: Direct Seedance — Relief / Aspiration (planned)

**Prompt outline:** Same operator from Gen 2, but in a different setting — bright morning, clean desk, relaxed. Hands away from keyboard, slight smile, a coffee cup. Soft golden hour light. Camera pulls back to reveal the desk is mostly empty (the work is done). Native audio: birds, soft ambient music, peace.

**Use case:** "After" scene for the commercial — visual contrast to Gen 2.

### Generation 4: Cinematic Logo Animation (planned)

**Approach options:**
- A) Use Cinematic Logo Animation preset (requires logo upload)
- B) Custom prompt describing the bar-chart logo assembling from particles

Going with B since uploading SVG is tricky.

**Prompt outline:** 4 vertical blue bar charts ascending in height, assembling from glowing blue particles on a clean white background. Particles swirl, then settle into formation. Subtle bounce as bars lock. Native audio: soft whoosh, soft chime when complete. NO text.

**Use case:** Closing logo reveal. 5 seconds.

### Generation 5: Slack-style Screen (no readable text)

**Prompt outline:** Clean tabletop with a tablet/screen showing an abstract chat interface — colored bubbles, dots indicating activity, but no readable text. Soft blue glow. Camera slow drift. Native audio: notification chime.

**Use case:** Mid-commercial visual to suggest "AI working in chat" without rendering broken text.

---

## Total credit budget tracking

| Generation | Credits | Running total |
|---|---|---|
| Starting balance | — | 1,098.1 |
| Gen 1 (URL-to-Ad) | -9 | 1,089.1 |
| (Free regen of edits + retries) | ~-2 | 1,087 |
| (Gen 2 setup) | -1 | 1,086 |
| Gen 2 (Exhausted operator 10s) | -6 (approved) | ~1,080 (estimated) |
| Gen 3-5 (planned) | -6 each ~= -18 | ~1,062 |

Budget allowed: 200-300 credits used. Currently estimated: ~36 credits = well under budget. Plenty of room for iteration.

---

## How to assemble the final commercial

When all generations are landed, combine in ChatCut:

1. **Open a new ChatCut project** (or existing one)
2. **Drag the 4 clips** into the timeline:
   - 0:00-0:03 — Gen 2 (exhausted operator) — opens with pain
   - 0:03-0:08 — Gen 3 (relief / aspiration) — shows the "after"
   - 0:08-0:13 — Gen 5 (Slack-style abstract chat) — implies the AI doing work
   - 0:13-0:15 — Gen 4 (logo reveal) — closes with brand
3. **Add captions** in ChatCut for every brand mention (Slack, HubSpot, Ramped) so the brand pronunciation issue from Gen 1 is fixed
4. **Add a real human voiceover** (Andrew) OR ElevenLabs Premium TTS with Slack/HubSpot pronunciation tagged
5. **Add background music** — calm, premium B2B feel (search ChatCut's library for "minimalist tech")
6. **Add a CTA end card** — "Live in 30 days. Or it's free. → 30dayramp.com"
7. **Export at 9:16 for TikTok/Reels** AND 16:9 for LinkedIn / YouTube / web

---

## Best practice notes (from research, applied here)

- **Subject + Action + Camera + Style + Timeline** — formula used in every prompt
- **Stylistic anchors** ("Apple keynote style") — used in Gen 2
- **No text on screens** rule — used in every prompt to avoid gibberish
- **No spoken brand names in TTS** — voiceover added in post (real human or ElevenLabs)
- **Native audio over voice** — every Seedance generation includes soft ambient sound, no spoken dialogue
- **Specific camera movements** — every prompt names the camera move (push-in, pull-back, slow drift)

---

## Lessons for future generations

1. **Direct Seedance > URL-to-Ad pipeline** for quality
2. **5-10 second clips, multiple of them, stitched in post** > one long generation
3. **Budget for 3-5 generations before getting a usable take** — first attempt isn't always great
4. **Prompts that AVOID known failure modes** (text, brand names spoken) outperform prompts that try to handle them

---

*Log last updated 2026-04-30. Add new generation entries as we run them.*
