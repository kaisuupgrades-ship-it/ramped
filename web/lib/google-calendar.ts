/**
 * Google Calendar API helper — used by /api/book to create the actual calendar
 * event with a Google Meet link, and by /api/availability to check freeBusy.
 *
 * Tokens are auto-refreshed using the long-lived REFRESH_TOKEN. The access
 * token is cached in the serverless container's memory so back-to-back calls
 * don't burn a new exchange each time.
 */

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

export function isCalendarConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

let _accessToken: string | null = null;
let _accessExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _accessExpiresAt - 60_000) return _accessToken;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID as string,
      client_secret: CLIENT_SECRET as string,
      refresh_token: REFRESH_TOKEN as string,
      grant_type: "refresh_token",
    }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error("Google token exchange failed: " + JSON.stringify(data));
  _accessToken = data.access_token as string;
  _accessExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return _accessToken;
}

export interface BusyRange { start: string; end: string }

export async function getBusyRanges(startIso: string, endIso: string): Promise<BusyRange[]> {
  if (!isCalendarConfigured()) return [];
  const token = await getAccessToken();
  const r = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: startIso,
      timeMax: endIso,
      items: [{ id: CALENDAR_ID }],
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    console.error("freeBusy error:", r.status, JSON.stringify(data));
    return [];
  }
  const cal = data.calendars && data.calendars[CALENDAR_ID];
  return (cal && cal.busy) || [];
}

export interface MeetEvent { eventId: string; htmlLink: string; meetLink: string }

export async function createMeetEvent({
  startIso, endIso, summary, description, guestEmail, guestName,
}: {
  startIso: string; endIso: string; summary: string; description: string;
  guestEmail: string; guestName?: string;
}): Promise<MeetEvent | null> {
  if (!isCalendarConfigured()) return null;
  const token = await getAccessToken();
  const body = {
    summary,
    description,
    start: { dateTime: startIso, timeZone: "UTC" },
    end: { dateTime: endIso, timeZone: "UTC" },
    attendees: guestEmail ? [{ email: guestEmail, displayName: guestName || undefined }] : [],
    conferenceData: {
      createRequest: {
        requestId: `ramped-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: { useDefault: true },
  };
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await r.json();
  if (!r.ok) {
    console.error("calendar insert error:", r.status, JSON.stringify(data));
    return null;
  }
  const meet = ((data.conferenceData && data.conferenceData.entryPoints) || []).find(
    (e: { entryPointType?: string; uri?: string }) => e.entryPointType === "video",
  );
  return {
    eventId: data.id,
    htmlLink: data.htmlLink || "",
    meetLink: (meet && meet.uri) || "",
  };
}
