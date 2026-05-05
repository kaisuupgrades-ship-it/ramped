import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/google-oauth-start?token=ADMIN_TOKEN
 *
 * Kicks off the Google OAuth flow for Calendar + Meet. The redirect_uri must
 * match what's registered in Google Cloud Console — set OAUTH_REDIRECT_HOST
 * env var if the deployment hostname differs from production.
 */

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_HOST = process.env.OAUTH_REDIRECT_HOST || "https://www.30dayramp.com";
const REDIRECT_URI = `${REDIRECT_HOST}/api/google-oauth-callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token || !ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!CLIENT_ID) return NextResponse.json({ error: "GOOGLE_CLIENT_ID not set" }, { status: 500 });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: token,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
