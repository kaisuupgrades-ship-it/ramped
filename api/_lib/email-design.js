// api/_lib/email-design.js — shared HTML template snippets for transactional emails
//
// Use these to keep visual style consistent across api/book.js, api/questionnaire.js,
// api/reminders.js, api/send-followup.js. Email clients are stuck in 2002 — everything
// uses tables, inline styles, web-safe fonts. No flexbox, no CSS variables, no
// unsupported tags.
//
// Brand tokens (hex, hand-coded since we can't use :root in emails):
//   ink:        #0B1220
//   accent:     #1F4FFF
//   accent-bg:  #EEF3FF
//   paper:      #FAFAF7
//   surface:    #F5F5F3
//   line:       #E6E4DC
//   muted:      #5B6272
//   good:       #0F7A4B
//   warn:       #B45309

const SITE_URL_DEFAULT = 'https://www.30dayramp.com';
const FROM_NAME = 'Ramped AI';
const FROM_EMAIL = 'jon@30dayramp.com';

// Bulletproof header with brand-blue R mark + wordmark on dark navy.
// Uses table layout so it renders correctly in Gmail / Outlook / Apple Mail.
export function emailHeader() {
  return `<tr><td class="ehead-pad" style="background:#0B1220;border-radius:16px 16px 0 0;padding:24px 36px;">
  <table cellpadding="0" cellspacing="0" border="0" role="presentation">
    <tr>
      <td style="vertical-align:middle;padding-right:12px;line-height:0;">
        <table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td width="36" height="36" align="center" valign="middle" style="background:#1F4FFF;border-radius:8px;color:#FFFFFF;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:900;font-size:21px;letter-spacing:-1px;line-height:36px;mso-line-height-rule:exactly;">R</td></tr></table>
      </td>
      <td style="vertical-align:middle;color:#FFFFFF;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:16px;letter-spacing:-0.2px;line-height:36px;mso-line-height-rule:exactly;">Ramped AI</td>
    </tr>
  </table>
</td></tr>`;
}

// Footer with brand info + privacy + reschedule contact.
// `siteUrl` lets callers override (matches process.env.SITE_URL).
export function emailFooter({ siteUrl = SITE_URL_DEFAULT, showPrivacy = true } = {}) {
  return `<tr><td class="efoot-pad" style="background:#FAFAF7;border-radius:0 0 16px 16px;padding:28px 36px;border-top:1px solid #E6E4DC;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
    <tr>
      <td style="vertical-align:top;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#5B6272;line-height:1.5;">
        <strong style="color:#0B1220;font-weight:600;">Ramped AI</strong><br>
        AI implementation for operating businesses.<br>
        <a href="${siteUrl}" style="color:#5B6272;text-decoration:underline;">30dayramp.com</a> &nbsp;·&nbsp; <a href="mailto:${FROM_EMAIL}" style="color:#5B6272;text-decoration:underline;">${FROM_EMAIL}</a>${showPrivacy ? ` &nbsp;·&nbsp; <a href="${siteUrl}/privacy" style="color:#5B6272;text-decoration:underline;">Privacy</a>` : ''}
      </td>
    </tr>
  </table>
</td></tr>`;
}

// Outer wrapper — the boilerplate every email shares.
export function wrapEmail({ subject, preheader, innerRows, siteUrl }) {
  // Preheader is the hidden preview text shown in inbox previews.
  const pre = preheader
    ? `<div style="display:none;font-size:1px;color:#FAFAF7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${subject}</title>
<style>
/* Mobile-only overrides — modern Gmail / Apple Mail / iOS Outlook respect these.
   Older clients fall back to inline styles, which are intentionally desktop-first. */
@media only screen and (max-width:480px) {
  table.outer-pad { padding:18px 8px !important; }
  td.ep { padding-left:20px !important; padding-right:20px !important; }
  td.ep-top { padding-top:24px !important; }
  td.ep-bot { padding-bottom:18px !important; }
  td.ehead-pad { padding:18px 20px !important; }
  td.efoot-pad { padding:20px 20px !important; }
  h1.ehero-h1 { font-size:21px !important; line-height:1.25 !important; }
  td.ecta-pad-in, td.einfo-pad-in { padding:20px 18px !important; }
  td.estat-cell { padding:14px 4px !important; }
  div.estat-num { font-size:21px !important; }
  div.estat-lab { font-size:9px !important; letter-spacing:0.06em !important; }
  td.eagent-pad-in { padding:14px 16px !important; }
  span.eagent-name { font-size:14px !important; }
  span.eagent-pill { font-size:10px !important; padding:2px 7px !important; white-space:nowrap; }
  td.eagent-pill-cell { display:block !important; padding:6px 0 0 0 !important; text-align:left !important; }
  td.eagent-name-cell { display:block !important; width:100% !important; }
  div.eagent-icon { width:28px !important; height:28px !important; line-height:28px !important; font-size:12px !important; }
  td.eagent-icon-cell { width:36px !important; padding-right:10px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0B1220;">
${pre}
<table class="outer-pad" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#F5F5F3;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:580px;background:#FFFFFF;border-radius:16px;box-shadow:0 1px 0 rgba(11,18,32,0.04), 0 12px 36px -16px rgba(11,18,32,0.10);">
${emailHeader()}
${innerRows}
${emailFooter({ siteUrl })}
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Hero band inside the email body (the eyebrow + big headline + supporting line).
export function emailHero({ eyebrow, headline, sub }) {
  return `<tr><td class="ep ep-top" style="background:#FFFFFF;padding:36px 36px 12px;">
  ${eyebrow ? `<p style="margin:0 0 10px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#1F4FFF;">${eyebrow}</p>` : ''}
  <h1 class="ehero-h1" style="margin:0 0 ${sub ? '12px' : '0'};font-family:'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:#0B1220;">${headline}</h1>
  ${sub ? `<p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.6;color:#5B6272;">${sub}</p>` : ''}
</td></tr>`;
}

// Body copy block with clean type and consistent padding.
export function emailBody(html) {
  return `<tr><td class="ep" style="background:#FFFFFF;padding:12px 36px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14.5px;line-height:1.65;color:#374151;">${html}</td></tr>`;
}

// Primary CTA card — light blue bg, centered, single button.
export function emailCtaCard({ eyebrow, title, body, ctaHref, ctaLabel }) {
  return `<tr><td class="ep" style="background:#FFFFFF;padding:0 36px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#EEF3FF;border-radius:12px;">
    <tr><td class="ecta-pad-in" style="padding:24px 28px;text-align:center;">
      ${eyebrow ? `<p style="margin:0 0 6px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#1F4FFF;">${eyebrow}</p>` : ''}
      ${title ? `<p style="margin:0 0 12px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:16px;color:#0B1220;line-height:1.3;">${title}</p>` : ''}
      ${body ? `<p style="margin:0 0 18px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13.5px;color:#5B6272;line-height:1.6;">${body}</p>` : ''}
      <a href="${ctaHref}" style="display:inline-block;background:#1F4FFF;color:#FFFFFF;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:10px;mso-padding-alt:0;">${ctaLabel}</a>
    </td></tr>
  </table>
</td></tr>`;
}

// Inline info card — white with border. Used for things like "your call link".
export function emailInfoCard({ eyebrow, title, body, ctaHref, ctaLabel }) {
  return `<tr><td class="ep" style="background:#FFFFFF;padding:0 36px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border:1px solid #E6E4DC;border-radius:12px;">
    <tr><td class="einfo-pad-in" style="padding:18px 22px;">
      ${eyebrow ? `<p style="margin:0 0 4px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5B6272;">${eyebrow}</p>` : ''}
      ${title ? `<p style="margin:0 0 ${(body || ctaHref) ? '10px' : '0'};font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:15px;color:#0B1220;line-height:1.3;">${title}</p>` : ''}
      ${body ? `<p style="margin:0 0 ${ctaHref ? '12px' : '0'};font-family:'Helvetica Neue',Arial,sans-serif;font-size:13.5px;color:#374151;line-height:1.55;">${body}</p>` : ''}
      ${ctaHref ? `<a href="${ctaHref}" style="display:inline-block;background:#0B1220;color:#FFFFFF;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13.5px;font-weight:600;text-decoration:none;padding:9px 18px;border-radius:8px;">${ctaLabel}</a>` : ''}
    </td></tr>
  </table>
</td></tr>`;
}

// Sign-off block — "— Jon @ Ramped AI" with the founder's mention.
export function emailSignoff({ name = 'Jon', extra = '' } = {}) {
  return `<tr><td class="ep" style="background:#FFFFFF;padding:0 36px 32px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#5B6272;">
  ${extra ? `<p style="margin:0 0 14px;">${extra}</p>` : ''}
  <p style="margin:0;">— <strong style="color:#0B1220;font-weight:600;">${name}</strong> &nbsp;·&nbsp; Ramped AI</p>
</td></tr>`;
}

// Spacer row — for explicit vertical breathing inside the body.
export function emailSpacer(height = 16) {
  return `<tr><td style="background:#FFFFFF;height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr>`;
}
