// api/google-oauth-start.js — Kick off Google OAuth flow for Calendar + Meet
// GET /api/google-oauth-start?token=ADMIN_TOKEN
//
// Requires env vars:
//   ADMIN_TOKEN         — admin password (same as admin dashboard)
//   GOOGLE_CLIENT_ID    — from Google Cloud Console OAuth 2.0 Client
//   GOOGLE_CLIENT_SECRET
//
// Redirect URI must match the one you register in Google Cloud Console:
//   https://www.30dayramp.com/api/google-oauth-callback

const ADMIN_TOKEN   = process.env.ADMIN_TOKEN;
const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_HOST = process.env.OAUTH_REDIRECT_HOST || 'https://www.30dayramp.com';
const REDIRECT_URI  = `${REDIRECT_HOST}/api/google-oauth-callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token || !ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!CLIENT_ID) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not set' });
  }

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',  // force consent so we always get a refresh_token
    state:         token,      // admin token used to re-auth the callback
  });

  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  res.end();
}
