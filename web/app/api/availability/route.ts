import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";
import { defaultConfig, type AvailabilityConfig } from "@/lib/calendar";
import { getBusyRanges, isCalendarConfigured } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const revalidate = 0;

/**
 * GET /api/availability                    → config only
 * GET /api/availability?date=YYYY-MM-DD    → config + booked[] (ISO datetimes)
 *
 * `booked[]` merges Supabase bookings AND Google Calendar busy ranges so the
 * picker greys out everything that's actually unavailable, not just rows in our
 * DB. Calendar busy ranges are expanded to 30-minute aligned slots.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date") ?? "";

  const cfgRes = await supabaseRest<AvailabilityConfig[]>(
    "GET",
    "/availability_settings?id=eq.1&select=days_available,start_hour,end_hour,slot_duration_min,blocked_dates,timezone",
  );
  const config: AvailabilityConfig & { booked?: string[] } =
    cfgRes.ok && Array.isArray(cfgRes.data) && cfgRes.data.length > 0
      ? { ...cfgRes.data[0] }
      : { ...defaultConfig };

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const baseMs = Date.parse(`${dateParam}T00:00:00.000Z`);
    if (!Number.isNaN(baseMs)) {
      const dayMs = 24 * 60 * 60 * 1000;
      const startISO = new Date(baseMs - dayMs).toISOString();
      const endISO = new Date(baseMs + 2 * dayMs).toISOString();

      const booked: string[] = [];

      // 1. Supabase bookings
      const url = `/bookings?datetime=gte.${encodeURIComponent(startISO)}&datetime=lt.${encodeURIComponent(endISO)}&select=datetime`;
      const r = await supabaseRest<{ datetime: string }[]>("GET", url);
      if (r.ok && Array.isArray(r.data)) {
        for (const b of r.data) if (b.datetime) booked.push(b.datetime);
      }

      // 2. Google Calendar busy ranges (expanded to 30-min slots aligned to busy.start)
      if (isCalendarConfigured()) {
        try {
          const busy = await getBusyRanges(startISO, endISO);
          for (const b of busy) {
            const s = new Date(b.start).getTime();
            const e = new Date(b.end).getTime();
            for (let t = s; t < e; t += 30 * 60_000) booked.push(new Date(t).toISOString());
          }
        } catch (err) {
          console.error("Google freeBusy failed:", (err as Error).message);
        }
      }

      config.booked = booked;
    }
  }

  return NextResponse.json(config);
}
