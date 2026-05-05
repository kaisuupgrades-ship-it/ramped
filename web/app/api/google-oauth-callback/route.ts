import { type NextRequest } from "next/server";
import { esc } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/google-oauth-callback?code=X&state=ADMIN_TOKEN
 *
 * Receives the OAuth code, exchanges it for a refresh token, and shows the
 * token in the browser so you can paste it into Vercel as
 * GOOGLE_REFRESH_TOKEN. The token is NEVER persisted server-side.
 *
 * All values that flow into HTML are HTML-escaped (audit C2-3) — CSP allows
 * 'unsafe-inline', so unescaped state/error params are a reflected-XSS sink.
 */

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_HOST = process.env.OAUTH_REDIRECT_HOST || "https://www.30dayramp.com";
const REDIRECT_URI = `${REDIRECT_HOST}/api/google-oauth-callback`;

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return htmlResponse(`<h1>Google returned an error</h1><pre>${esc(error)}</pre>`, 400);
  }
  if (!state || !ADMIN_TOKEN || state !== ADMIN_TOKEN) {
    return htmlResponse("Unauthorized (state mismatch)", 401);
  }
  if (!code) return htmlResponse("Missing code", 400);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: CLIENT_ID || "", client_secret: CLIENT_SECRET || "",
      redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json() as { refresh_token?: string; access_token?: string };

  if (!tokens.refresh_token) {
    return htmlResponse(
      `<h1>No refresh_token returned</h1>
       <p>Google may have cached prior consent. Revoke access at
       <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>
       and retry. Full response:</p>
       <pre>${esc(JSON.stringify(tokens, null, 2))}</pre>`,
      500,
    );
  }

  let whoami = "";
  try {
    const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }).then((r) => r.json() as Promise<{ email?: string }>);
    whoami = info.email || "";
  } catch { /* ignore */ }

  return htmlResponse(`<!doctype html>
<html><head><meta charset="utf-8"><title>Google Calendar Connected</title>
<style>body{font:15px system-ui,sans-serif;max-width:680px;margin:48px auto;padding:0 24px;color:#0B1220;}
code,pre{background:#F5F5F3;border:1px solid #E6E4DC;border-radius:6px;padding:10px;display:block;word-break:break-all;font:13px/1.4 ui-monospace,monospace;margin:8px 0;}
h1{font-size:22px;margin:0 0 12px;} .ok{color:#0F7A4B;font-weight:700;}
.step{margin:18px 0;padding:14px;background:#F5F8FF;border-radius:8px;}
</style></head><body>
<h1><span class="ok">✓</span> Google Calendar connected${whoami ? ` as ${esc(whoami)}` : ""}</h1>
<p>Copy the refresh token below into Vercel as <code>GOOGLE_REFRESH_TOKEN</code>, then redeploy.</p>
<div class="step">
  <strong>Refresh token:</strong>
  <pre id="rt">${esc(tokens.refresh_token)}</pre>
  <button onclick="navigator.clipboard.writeText(document.getElementById('rt').textContent);this.textContent='Copied ✓'" style="padding:8px 14px;font:inherit;border:1px solid #0B1220;background:#0B1220;color:#fff;border-radius:6px;cursor:pointer;">Copy</button>
</div>
<div class="step">
  <strong>Next steps:</strong>
  <ol style="margin:8px 0 0 22px;">
    <li>Open Vercel → Project → Settings → Environment Variables</li>
    <li>Add <code>GOOGLE_REFRESH_TOKEN</code> (Production) = token above</li>
    <li>Confirm <code>GOOGLE_CALENDAR_ID</code> is set (use <code>primary</code> if unsure)</li>
    <li>Trigger a redeploy</li>
    <li>Book a test slot at <a href="/book">/book</a> to confirm the Meet link lands</li>
  </ol>
</div>
<p style="color:#5B6272;font-size:13px;">This page won't show the token again — save it now.</p>
</body></html>`);
}
