# Onboarding Email Sequence — Ramped AI

The drip sequence for new prospects who've booked a discovery call (or submitted /free-roadmap) but haven't signed yet. Goal: nurture warm leads through education + social proof until they're ready to engage further.

7 emails over 21 days. Stop sending if they sign or unsubscribe.

---

## Email 1 — Booking confirmation (immediate)

**Subject:** Confirmed — your call with Andrew on {{date}}

**Body:**

Hey {{first_name}},

Confirmed for {{date}} at {{time}}. Calendar invite + Google Meet link is in your inbox.

Quick prep:
- Bring 2-3 specific workflows that are draining your team. The more concrete the better.
- Have your stack list handy (CRM, email, accounting, Slack, etc.)
- Block an extra 15 min after the call for rough scoping

If anything comes up before then — even just questions you'd rather we cover live — reply to this email. I read every one.

Looking forward to it.

— Andrew

P.S. If you have a recent customer support thread or ops question that drove you crazy this week, screenshot and send it. The discovery call is way more useful when we work from real examples.

---

## Email 2 — Day 0 (immediate, separate from confirmation)

**Subject:** What to expect on your discovery call

**Body:**

Hey {{first_name}},

Quick rundown so the call uses the full 30 minutes:

**Minutes 0-2** — Quick context on your business
**Minutes 2-12** — We'll map your workflows together. List of every place ops VAs / your team / yourself are doing repetitive work.
**Minutes 12-22** — I'll show you 1-2 real customer cases relevant to what you're describing.
**Minutes 22-27** — We'll scope a 30-day plan. First 1-2 agents we'd ship.
**Minutes 27-30** — Confirm next step.

Worth knowing: even prospects who don't end up working with us tell me the workflow audit alone was worth the call. So whether or not we're a fit, you walk away with a list and rough time/cost estimates.

See you at {{time}}.

— Andrew

---

## Email 3 — Day 2 after call (if no decision yet)

**Subject:** {{first_name}}, the 3 agents I'd build for you first

**Body:**

Hey {{first_name}},

Following up on our call. From what we discussed, here's the rough scope I'd propose:

**Agent 1: {{agent_1_name}}** — handles {{workflow_1}} from end to end. Connects to {{tools}}. Estimated time saved: {{hours}}/week.

**Agent 2: {{agent_2_name}}** — {{description}}. Connects to {{tools}}. Estimated time saved: {{hours}}/week.

**Agent 3: {{agent_3_name}}** — {{description}}. Connects to {{tools}}. Estimated time saved: {{hours}}/week.

Total estimated hours saved: ~{{total_hours}}/week.
At ~$28/hr fully-loaded, that's ~${{total_savings}}/month.

The Growth tier ($5,000/mo) covers all 3 agents and ongoing operations.

What's the right next step?
- Want a deeper proposal? I can send a 2-pager.
- Want to start a 30-day pilot? We can kick off Monday.
- Want me to refine the scope? Reply with what's missing.

— Andrew

---

## Email 4 — Day 7 (if still no decision)

**Subject:** Story you might find useful, {{first_name}}

**Body:**

Hey {{first_name}},

Thinking about your situation, reminded me of a customer that started with us in October.

They're a {{vertical}} company at {{revenue_band}}. Same kind of workflows you described — {{specific_workflow}}.

Three things they were worried about going in:
1. "Will the agent really handle our specific edge cases?"
2. "What happens when third-party APIs change?"
3. "How do we explain this to the team without freaking them out?"

Where they ended up after 30 days:
1. Yes — but only because we narrow-scoped the first agent to one workflow, validated it, then expanded
2. We absorb that — we monitor and fix, they don't see breakage
3. They reframed the team conversation as "promotion" — VAs who became agent supervisors

If any of those concerns are on your mind too, happy to walk through how we addressed each one. 30 minutes if you want it: [calendar link]

— Andrew

---

## Email 5 — Day 14

**Subject:** Quick benchmark, {{first_name}}

**Body:**

Hey {{first_name}},

Two weeks since we talked. Wanted to share a benchmark we put together this week.

Across our customer base, the average time-to-first-savings is **18 days from contract.** That means: by day 18, the agents are running and the customer has measurably saved hours that week.

If you start a deployment Monday, you'd be at the savings line by mid-month. Just for context on how the calendar pencils out.

Couple of follow-up questions while you mull it over:

1. Did the sticking point land on price, scope, or timing?
2. Is there someone else internally who needs to weigh in? (Happy to do a 3-way call.)
3. Want me to send a 2-pager with the proposal in writing for internal alignment?

Reply with whatever's most useful.

— Andrew

---

## Email 6 — Day 18 (re-engagement)

**Subject:** Worth dropping this thread, {{first_name}}?

**Body:**

Hey {{first_name}},

Honest check: should I drop this thread, or is there still interest?

Totally fine either way — I'd rather know than keep poking.

If yes, what would help you move forward — proposal, demo with someone on your team, or just more time?
If no, I'll close the loop and you'll only hear from me if you reach out.

— Andrew

---

## Email 7 — Day 21 (break-up / final)

**Subject:** Closing the loop, {{first_name}}

**Body:**

Hey {{first_name}},

Closing the loop on this thread — won't follow up further unless you reach out.

If anything changes (timing, scope, internal alignment), I'm at andrew@30dayramp.com. The discovery call writeup is yours regardless of whether we work together — it's a useful audit even if you DIY.

Cheering you on either way.

— Andrew

P.S. If Ramped isn't a fit but you want to follow my thinking on operations + AI, I write occasionally on LinkedIn → [linkedin.com/in/andrewyoon]

---

## Customization rules

| Token | What to fill |
|---|---|
| `{{first_name}}` | Their first name |
| `{{date}}` | Booking date |
| `{{time}}` | Booking time + timezone |
| `{{vertical}}` | Their industry |
| `{{revenue_band}}` | "$5-15M", "$15-50M", etc. |
| `{{specific_workflow}}` | A workflow they mentioned on the call |
| `{{agent_X_name}}` | Specific agent name (e.g. "Quote Intake Bot") |
| `{{workflow_X}}` | The workflow that agent handles |
| `{{tools}}` | The tools their agent connects to |
| `{{hours}}` | Estimated hours saved/week (per agent) |
| `{{total_hours}}` | Sum across all proposed agents |
| `{{total_savings}}` | hours × hourly rate × 4 weeks |

---

## Triggers (when to start sequence)

| Trigger | Sequence |
|---|---|
| Booked a discovery call | Email 1 (immediate) → Email 2 (immediate) → Email 3 (Day 2 after call) |
| Did /free-roadmap but no call yet | Different sequence — see WARM-LEAD-NURTURE.md (todo) |
| No-show on discovery call | Skip to Email 6 (re-engagement) immediately |
| Signed contract | Stop sequence, switch to onboarding sequence (TODO: write CUSTOMER-ONBOARDING-EMAILS.md) |

---

## What to ALWAYS personalize

- The {{specific_workflow}} from their call notes
- The customer story in Email 4 — pick the most analogous customer
- The proposed agents in Email 3 — actually scope based on what they told us

If you can't personalize, don't send. Generic drip emails are worse than no email.

---

## What NOT to do

1. **Send all 7 emails on autopilot.** Step in if anything changes.
2. **Apologize for following up.** Self-deprecating openers tank reply rates.
3. **Use "checking in"** as the body. Be useful or stop sending.
4. **Add deadlines that don't exist.** "Limited capacity" lies kill trust.
5. **Forward the sequence to the same prospect twice.** Track in CRM.

---

## Reply rate goals

| Email | Target reply rate |
|---|---|
| 1 (confirmation) | 15-20% |
| 2 (prep) | 5-10% |
| 3 (post-call follow-up) | 25-35% |
| 4 (story) | 10-15% |
| 5 (benchmark) | 8-12% |
| 6 (re-engagement) | 20-30% |
| 7 (break-up) | 5-10% (often the highest unexpected reply rate — break-ups bring out the truth) |

Track weekly. If any email drops below half its target rate, rewrite the subject line first.
