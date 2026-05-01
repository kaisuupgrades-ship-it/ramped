# Higgsfield Prompt Guide — Ramped AI

How to write prompts that actually produce premium video on Higgsfield. Based on official Higgsfield prompting docs + community-tested patterns. Use this every time we generate.

**Last updated:** 2026-04-30 — after our first batch produced mediocre results from over-long prompts.

---

## The 8 rules (in order of impact)

### 1. Stay under 100 words.

This is the single biggest unlock. From the official Higgsfield docs:
> "Prompts under 100 words yield the best results — overly long ones dilute the Soul signal."

Our first-batch prompts were 250-350 words. That's why they came out muddy.

### 2. Start with shot structure.

The first line of every prompt should be:
```
[N shots, T seconds total, A:B aspect ratio]
```

Example: `1 shot, 8 seconds, 16:9` or `3 shots, 15 seconds, 9:16`.

### 3. Number each shot.

If multi-shot, give each its own beat:
```
Shot 1: [action + camera move]
Shot 2: [action + camera move]
Shot 3: [action + camera move]
```

### 4. One action per beat.

For each shot, tie ONE camera move to ONE character action. No multi-tasking. Bad: "He smiles, then types, then looks up while the camera pans." Good: "Shot 1 — slow dolly-in as he closes the laptop and exhales."

### 5. Use active verbs only.

| Vague | Active |
|---|---|
| Looks at | Stares, glares, locks eyes on |
| Moves | Darts, strides, glides |
| Camera goes | Slowly dolly-in, racks focus, whip-pans |
| Light is on | Golden rim-light catches, shadows pool |

### 6. Mood first, details after.

Decide tense / serene / chaotic / cinematic / playful at the top. Build everything else around it.

### 7. VFX in brackets, inline.

Specify visual effects with bracket notation in the action description:
```
He closes the laptop. [VFX: warm rim-light catches the steam from his mug]
```

Don't separately describe VFX outside the action.

### 8. For ultra-realism, demand it.

If results look plasticky / cartoony, add:
```
no 3D, no cartoon, no VFX, photorealistic
```

---

## The Ramped formula

Combine the above into our brand-specific template:

```
[1 shot, 8 seconds, 16:9, photorealistic]

Mood: {tense/serene/aspirational}.

Subject: {who, mid-thirties, business casual, specific clothing detail}.

Action: {one active verb describing what they do}.

Camera: {one specific move — push-in, pull-back, rack focus, etc.}.

Lighting: {golden hour / overhead fluorescent / cool moonlight / etc.}.

Audio: {one or two specific ambient sounds}.

[no 3D, no cartoon, no VFX, no text on screens, no logos]
```

Target: ~70 words. Never exceed 100.

---

## Ramped prompt library (use these as-is)

### A. Pain-state hook (commercial opener)
```
1 shot, 6 seconds, 16:9, photorealistic.

Mood: tense, exhausted.

Subject: mid-thirties operator in a wrinkled white button-down, dark circles under his eyes, slumped at a cluttered desk past midnight.

Action: he rubs his eyes with both hands, then drops them defeated.

Camera: slow dolly-in from medium to tight close-up on his face.

Lighting: cold white-blue from off-screen monitors, deep amber warmth from a desk lamp behind. High contrast.

Audio: faint clock ticking, distant traffic, soft fan hum.

[no 3D, no cartoon, no text on screens, no logos]
```

### B. Relief scene (commercial close — the "after")
```
1 shot, 6 seconds, 16:9, photorealistic.

Mood: serene, aspirational.

Subject: same mid-thirties operator, now in a fresh light-blue button-down at a clean wooden desk.

Action: he exhales, leans back, and closes the laptop.

Camera: slow pull-back from close-up to wide.

Lighting: golden hour light streams through a window behind him, warm rim-light on his shoulders.

Audio: faint birdsong, distant city, soft ambient pad.

[no 3D, no cartoon, no text on screens, no logos]
```

### C. Brand logo reveal (closing card)
```
1 shot, 4 seconds, 16:9, photorealistic, macro.

Mood: clean, premium, Apple-keynote.

Subject: four vertical royal-blue (#1F4FFF) rectangular bars on an off-white background, ascending in height left to right.

Action: bars assemble crisply from a wash of blue particles that swirl in from off-screen, then settle with a single soft pulse.

Camera: locked-off, very shallow macro depth-of-field.

Lighting: soft studio key from above, gentle bounce.

Audio: subtle whoosh, then one warm chime.

[no 3D cartoon style, no text, no words, no extra logos]
```

### D. Hands typing macro (versatile B-roll)
```
1 shot, 5 seconds, 16:9, photorealistic, macro close-up.

Mood: focused, calm.

Subject: a man's hands resting on a clean mechanical keyboard, mug of black coffee just out of frame.

Action: hands lift slightly, then settle without typing.

Camera: locked-off macro, shallow depth of field, focus on the knuckles.

Lighting: golden hour from the left, warm bokeh in the background.

Audio: distant office hum, single soft keyboard click.

[no 3D, no cartoon, no text on screens, no logos]
```

### E. Dawn establishing shot (opening B-roll)
```
1 shot, 5 seconds, 16:9, photorealistic.

Mood: peaceful, anticipatory.

Subject: an empty modern desk near a tall window, no person visible.

Action: morning light slowly creeps across the desk surface as the sun rises.

Camera: locked-off wide shot, very subtle parallax drift.

Lighting: warm gold dawn light gradient, deep shadows in the room.

Audio: ambient room tone, distant birds, soft city wake-up.

[no 3D, no cartoon, no text on screens, no logos]
```

### F. Slack-style notification animation (abstract)
```
1 shot, 4 seconds, 16:9, photorealistic, macro.

Mood: clean, modern.

Subject: a soft glowing rectangle floating on a dark gradient background, simulating a notification card with no readable text.

Action: card slides in from the right with a gentle bounce, then a soft pulse of light passes across it.

Camera: locked-off, slight parallax.

Lighting: cool blue ambient, single warm key light.

Audio: subtle Slack-like ping (single soft chime).

[no 3D cartoon style, no text, no logos]
```

---

## Multi-shot template (when you want a 12-15s mini-commercial)

For longer hero videos, use multi-shot syntax with explicit numbering:

```
3 shots, 12 seconds total, 16:9, photorealistic.

Mood: pain → relief → confidence.

Shot 1 (4s) — tense pain state:
Mid-thirties operator slumps at cluttered desk past midnight.
Action: rubs eyes, drops hands.
Camera: slow dolly-in.
Lighting: cold blue + amber.
Audio: clock ticking.

Shot 2 (4s) — golden-hour relief:
Same operator at a clean desk.
Action: leans back, closes laptop.
Camera: slow pull-back.
Lighting: warm golden hour through window.
Audio: birds, ambient pad.

Shot 3 (4s) — empty calm aftermath:
Wide shot of the desk, no person.
Action: morning light gradient drifts across.
Camera: locked-off wide.
Lighting: golden dawn.
Audio: peaceful room tone.

[no 3D cartoon style, no text on screens, no logos, no product UI]
```

---

## What we got wrong on Round 1 (post-mortem)

| Mistake | Fix |
|---|---|
| Prompts were 250-350 words | Cap at 70-100 words |
| Tried to specify everything | Trust the model — give 1 mood, 1 action, 1 camera move |
| Wrote prose paragraphs | Use structured format with line breaks |
| Buried the camera move at the end | Lead with `Camera:` after action |
| Didn't number multi-element shots | Always number when there's more than one beat |
| Didn't say "photorealistic" | Always state it explicitly when we want non-stylized |

---

## Cost discipline

| Action | Approx credits |
|---|---|
| Seedance 2.0, 5-8s, 1080p | ~50-65 |
| Soul Cast image | ~10-15 |
| Marketing Studio video (URL-driven UGC) | ~150-200 |
| Cinematic Studio top-tier | ~150-300 |

**Rule:** never run a 4th iteration of the same prompt. If the third try is bad, the prompt is wrong, not the model. Rewrite.

---

## Sources

- [Seedance 2.0 — Complete Prompting Guide (Higgsfield official)](https://higgsfield.ai/blog/seedance-prompting-guide)
- [Prompt Guide to Cinematic AI Videos (Higgsfield)](https://higgsfield.ai/blog/Prompt-Guide-to-Cinematic-AI-Videos)
- [Sora 2 Prompt Guide — Higgsfield](https://higgsfield.ai/sora-2-prompt-guide)
- [Higgsfield Soul 2.0: Custom Character Prompts Guide — selfielab](https://selfielab.me/blog/higgsfield-soul-20-custom-character-prompts-guide-20260330)
- [Seedance 2.0 × Higgsfield Skills (15 Claude prompt templates) — GitHub](https://github.com/beshuaxian/higgsfield-seedance2-jineng)
- [Higgsfield AI Prompt Skill for Claude — GitHub](https://github.com/OSideMedia/higgsfield-ai-prompt-skill)
- [Seedance 2.0 Prompt Library — seedance2prompt.com](https://www.seedance2prompt.com/)

---

*Update this guide whenever a prompt pattern wins or fails consistently. Reference before every new generation.*
