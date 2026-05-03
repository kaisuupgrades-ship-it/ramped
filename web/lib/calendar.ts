/**
 * Calendar slot logic — shared between the booking UI and /api/availability.
 *
 * Old site had this in three places that drifted from each other (the bug we
 * spent an hour debugging). Now it's one module, used by both client and
 * server.
 */

export interface AvailabilityConfig {
  days_available: string[];     // ["Mon","Tue",...]
  start_hour: number;           // 8
  end_hour: number;             // 18
  slot_duration_min: number;    // 30
  blocked_dates: string[];      // ["2026-05-25", ...]
  timezone: string;             // "America/Chicago"
}

export const defaultConfig: AvailabilityConfig = {
  days_available: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  start_hour: 8,
  end_hour: 18,
  slot_duration_min: 30,
  blocked_dates: [],
  timezone: "America/Chicago",
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Generate human-readable slot strings ("9:00 AM") for a config. */
export function generateSlotStrings(start_hour: number, end_hour: number, slot_duration_min: number): string[] {
  const out: string[] = [];
  for (let m = start_hour * 60; m < end_hour * 60; m += slot_duration_min) {
    const h = Math.floor(m / 60);
    const mn = m % 60;
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = ((h + 11) % 12) + 1;
    out.push(`${h12}:${String(mn).padStart(2, "0")} ${ampm}`);
  }
  return out;
}

/** Slots for a specific date, honoring days_available + blocked_dates. */
export function slotsForDate(date: Date, cfg: AvailabilityConfig): string[] {
  const dow = DOW[date.getDay()];
  const ymd = ymdLocal(date);
  if (!cfg.days_available.includes(dow)) return [];
  if (cfg.blocked_dates.includes(ymd)) return [];
  return generateSlotStrings(cfg.start_hour, cfg.end_hour, cfg.slot_duration_min);
}

/** Filter out slot times already in the past for today. */
export function dropPastSlots(slots: string[], date: Date, leadMinutes = 30): string[] {
  const now = new Date();
  if (date.toDateString() !== now.toDateString()) return slots;
  return slots.filter((s) => {
    const m = s.match(/(\d+):(\d+)\s*(AM|PM)/);
    if (!m) return true;
    let h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (m[3] === "PM" && h < 12) h += 12;
    else if (m[3] === "AM" && h === 12) h = 0;
    const d2 = new Date(date);
    d2.setHours(h, mm, 0, 0);
    return d2.getTime() - now.getTime() > leadMinutes * 60 * 1000;
  });
}

/** Combine a calendar date + slot string into an ISO datetime. */
export function combineDateAndSlot(date: Date, slot: string): string {
  const m = String(slot).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return date.toISOString();
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const isPM = m[3].toUpperCase() === "PM";
  if (isPM && h < 12) h += 12;
  if (!isPM && h === 12) h = 0;
  const d = new Date(date);
  d.setHours(h, mm, 0, 0);
  return d.toISOString();
}

/** Local YYYY-MM-DD (timezone-naive — uses the Date's local fields). */
export function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a Date as a slot string ("9:00 AM") in the given timezone. */
export function toSlotStringInTZ(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(d);
}

/** Format a Date as YYYY-MM-DD in the given timezone. */
export function ymdInTZ(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(d);
}

/** Given a list of booked ISO datetimes + the user's timezone, return the
 *  Set of slot-strings that are already taken on the user's selected date. */
export function bookedSlotSet(
  bookedIsos: string[],
  selectedDate: Date,
  userTimezone: string,
): Set<string> {
  const userYmd = ymdInTZ(selectedDate, userTimezone);
  const taken = new Set<string>();
  for (const iso of bookedIsos) {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) continue;
    if (ymdInTZ(dt, userTimezone) === userYmd) {
      taken.add(toSlotStringInTZ(dt, userTimezone));
    }
  }
  return taken;
}
