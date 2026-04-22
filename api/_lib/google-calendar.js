// api/_google-calendar.js — Internal helper; not a Vercel endpoint (underscore prefix)
// Called from api/book.js to (a) query freebusy and (b) create a Meet event.

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const CALENDAR_ID   = process.env.GOOGLE_CALENDAR_ID || 'primary';

export function isConfigured() {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

// Cache the access token in memory for the life of the serverless container
let _accessToken = null;
let _accessExpiresAt = 0;

async function getAccessToken() {
  if (_accessToken && Date.now() < _accessExpiresAt - 60_000) return _accessToken;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('Google token exchange failed: ' + JSON.stringify(data));
  _accessToken = data.access_token;
  _accessExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return _accessToken;
}

// Returns an array of {start, end} UTC ISO strings for busy blocks on the given UTC date range.
export async function getBusyRanges(startIso, endIso) {
  if (!isConfigured()) return [];
  const token = await getAccessToken();
  const r = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: startIso,
      timeMax: endIso,
      items:   [{ id: CALENDAR_ID }],
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    console.error('freeBusy error:', r.status, JSON.stringify(data));
    return [];
  }
  const cal = data.calendars && data.calendars[CALENDAR_ID];
  return (cal && cal.busy) || [];
}

// Creates a calendar event with Google Meet link and invites the guest.
// startIso/endIso are UTC ISO strings. Returns { htmlLink, meetLink, eventId } or null on failure.
export async function createMeetEvent({ startIso, endIso, summary, description, guestEmail, guestName }) {
  if (!isConfigured()) return null;
  const token = await getAccessToken();
  const body = {
    summary,
    description,
    start: { dateTime: startIso, timeZone: 'UTC' },
    end:   { dateTime: endIso,   timeZone: 'UTC' },
    attendees: guestEmail ? [{ email: guestEmail, displayName: guestName || undefined }] : [],
    conferenceData: {
      createRequest: {
        requestId: `ramped-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: { useDefault: true },
  };
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const data = await r.json();
  if (!r.ok) {
    console.error('calendar insert error:', r.status, JSON.stringify(data));
    return null;
  }
  const meet = (data.conferenceData && data.conferenceData.entryPoints || [])
    .find(e => e.entryPointType === 'video');
  return {
    eventId:  data.id,
    htmlLink: data.htmlLink || '',
    meetLink: (meet && meet.uri) || '',
  };
}
