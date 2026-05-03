import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";
import { defaultConfig, type AvailabilityConfig } from "@/lib/calendar";

export const runtime = "nodejs";
export const revalidate = 0;

/**
 * GET /api/availability                    → config only
 * GET /api/availability?date=YYYY-MM-DD    → config + booked[] (ISO datetimes)
 *
 * Used by the calendar to render slots and grey out taken ones.
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

  // If date is provided, attach booked datetimes for that date (±1 day window
  // covers any user timezone offset; the client filters by local TZ).
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const baseMs = Date.parse(`${dateParam}T00:00:00.000Z`);
    if (!Number.isNaN(baseMs)) {
      const dayMs = 24 * 60 * 60 * 1000;
      const startISO = new Date(baseMs - dayMs).toISOString();
      const endISO = new Date(baseMs + 2 * dayMs).toISOString();
      const url = `/bookings?datetime=gte.${encodeURIComponent(startISO)}&datetime=lt.${encodeURIComponent(endISO)}&select=datetime`;
      const r = await supabaseRest<{ datetime: string }[]>("GET", url);
      config.booked = r.ok && Array.isArray(r.data) ? r.data.map((b) => b.datetime).filter(Boolean) : [];
    }
  }

  return NextResponse.json(config);
}
