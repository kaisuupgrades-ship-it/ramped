// api/_lib/phase.js — Single source of truth for "what phase is this customer in?"
// Used by /api/portal-data (drives portal.html banner + timeline) and /api/admin (so the
// admin sees the same phase the customer sees).
//
// 5 phases — matches portal.html timeline visuals:
//   01 Kickoff    — discovery call window (day -∞ → +0)
//   02 Discovery  — questionnaire + roadmap delivery (day 1 → 4)
//   03 Build      — agent prototyping + integrations (day 5 → 21)
//   04 QA         — UAT against real data (day 22 → 27)
//   05 Live       — agents in production (day 28+)
//
// `kickoffISO` is the discovery-call datetime (`bookings.datetime`).

export function computePhase(kickoffISO) {
  if (!kickoffISO) {
    return { phase: 'Pre-kickoff', dayOfThirty: null, eyebrow: 'Pre-kickoff', step: 0 };
  }
  const kickoff = new Date(kickoffISO);
  if (isNaN(kickoff)) {
    return { phase: 'Pre-kickoff', dayOfThirty: null, eyebrow: 'Pre-kickoff', step: 0 };
  }
  const now = new Date();
  const rawDay = Math.floor((now - kickoff) / 86400000);

  // Pre-kickoff (call hasn't happened yet)
  if (rawDay < 0) {
    const daysUntil = Math.abs(rawDay);
    return {
      phase: 'Pre-kickoff',
      dayOfThirty: 0,
      eyebrow: daysUntil === 1 ? 'Discovery call tomorrow' : `Discovery call in ${daysUntil} days`,
      step: 0,
    };
  }

  const dayOfThirty = Math.min(30, rawDay);

  let phase, step, weekN;
  if (dayOfThirty <= 0)       { phase = 'Kickoff';   step = 1; weekN = 1; }
  else if (dayOfThirty <= 4)  { phase = 'Discovery'; step = 2; weekN = 1; }
  else if (dayOfThirty <= 21) { phase = 'Build';     step = 3; weekN = Math.min(4, Math.ceil(dayOfThirty / 7)); }
  else if (dayOfThirty <= 27) { phase = 'QA';        step = 4; weekN = 4; }
  else                        { phase = 'Live';      step = 5; weekN = 5; }

  let eyebrow;
  if (phase === 'Live') eyebrow = 'Live · Hours saved this month';
  else if (phase === 'Kickoff') eyebrow = 'Day 1 · Kickoff';
  else eyebrow = `Week ${weekN} of 4 · ${phase} phase`;

  return { phase, dayOfThirty, eyebrow, step };
}
