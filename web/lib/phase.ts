/**
 * Single source of truth for "what phase is this customer in?" — drives both
 * the admin bookings table and the customer portal banner so they always agree.
 *
 * 5 phases:
 *   01 Kickoff    day -∞ → +0
 *   02 Discovery  day 1  → 4
 *   03 Build      day 5  → 21
 *   04 QA         day 22 → 27
 *   05 Live       day 28+
 */

export interface PhaseInfo {
  phase: "Pre-kickoff" | "Kickoff" | "Discovery" | "Build" | "QA" | "Live";
  dayOfThirty: number | null;
  eyebrow: string;
  step: number;
}

export function computePhase(kickoffISO: string | null | undefined): PhaseInfo {
  if (!kickoffISO) return { phase: "Pre-kickoff", dayOfThirty: null, eyebrow: "Pre-kickoff", step: 0 };
  const kickoff = new Date(kickoffISO);
  if (isNaN(kickoff.getTime())) return { phase: "Pre-kickoff", dayOfThirty: null, eyebrow: "Pre-kickoff", step: 0 };
  const now = new Date();
  const rawDay = Math.floor((now.getTime() - kickoff.getTime()) / 86400000);

  if (rawDay < 0) {
    const daysUntil = Math.abs(rawDay);
    return {
      phase: "Pre-kickoff",
      dayOfThirty: 0,
      eyebrow: daysUntil === 1 ? "Discovery call tomorrow" : `Discovery call in ${daysUntil} days`,
      step: 0,
    };
  }

  const dayOfThirty = Math.min(30, rawDay);

  let phase: PhaseInfo["phase"], step: number, weekN: number;
  if (dayOfThirty <= 0)        { phase = "Kickoff";   step = 1; weekN = 1; }
  else if (dayOfThirty <= 4)   { phase = "Discovery"; step = 2; weekN = 1; }
  else if (dayOfThirty <= 21)  { phase = "Build";     step = 3; weekN = Math.min(4, Math.ceil(dayOfThirty / 7)); }
  else if (dayOfThirty <= 27)  { phase = "QA";        step = 4; weekN = 4; }
  else                         { phase = "Live";      step = 5; weekN = 5; }

  let eyebrow: string;
  if (phase === "Live") eyebrow = "Live · Hours saved this month";
  else if (phase === "Kickoff") eyebrow = "Day 1 · Kickoff";
  else eyebrow = `Week ${weekN} of 4 · ${phase} phase`;

  return { phase, dayOfThirty, eyebrow, step };
}
