/**
 * Questionnaire schema — single source of truth.
 *
 * Imported by both:
 *   - /questionnaire.html (browser, <script type="module">) — to render the form
 *   - /api/questionnaire.js (Node) — to validate the payload + build the
 *     Anthropic prompt context
 *
 * Field IDs here are the EXACT keys posted to the API and stored in the
 * bookings.questionnaire JSONB column. Renaming a field here updates both the
 * form and the prompt automatically — no more drift.
 *
 * The question set was restored from /_archive/v3-pre-redesign/questionnaire.html
 * (commit before the brand v3 rebrand), which is the version Andrew preferred
 * for prepping calls. Brand-logo pickers replace text-only options for tools,
 * CRM, and email-provider questions.
 *
 * Plain ES module (no TypeScript) so the browser loads it directly via
 * <script type="module"> and Node imports it the same way. No build step.
 */

export const FIELD_TYPES = Object.freeze({
  TEXTAREA:        'textarea',
  TEXT:            'text',
  RADIO_PILLS:     'radio_pills',
  CHECKBOX_PILLS:  'checkbox_pills',
  BRAND_PILLS:     'brand_pills',  // checkbox pills with Simple Icons CDN logos
  BRAND_RADIO:     'brand_radio',  // single-choice version of brand pills
});

/* ---------------------------------------------------------------------------
   FIELDS — ordered list of questions. Order = display order. Each entry:
     id           snake_case key, the EXACT key posted to /api/questionnaire
                  AND read by the prompt builder.
     type         one of FIELD_TYPES.
     title        question shown to the user.
     sub          optional helper text shown beneath the question.
     placeholder  for text / textarea inputs.
     rows         textarea height (default 3).
     options      [{ value, label?, icon?, color? }] for pill types.
     otherField   { id, placeholder } — optional free-text "anything we missed"
                  textarea for brand pickers.
     promptLabel  human-friendly label used in the Anthropic prompt block.
                  Independent of UI title so we can reword the form without
                  affecting prompt cohesion.
   --------------------------------------------------------------------------- */
export const FIELDS = [
  {
    id: 'pain_points',
    type: FIELD_TYPES.CHECKBOX_PILLS,
    title: "What's eating your team's time?",
    sub: "Select all that apply — we'll prioritize the biggest wins.",
    options: [
      { value: 'Lead follow-up',           label: 'Lead follow-up & nurturing' },
      { value: 'Answering repetitive Qs',  label: 'Answering repetitive questions' },
      { value: 'Scheduling',               label: 'Scheduling & calendar' },
      { value: 'Quotes & proposals',       label: 'Quotes & proposals' },
      { value: 'Order/invoice processing', label: 'Order / invoice processing' },
      { value: 'Customer support',         label: 'Customer support tickets' },
      { value: 'Data entry & reporting',   label: 'Data entry & reporting' },
      { value: 'Employee onboarding',      label: 'Employee onboarding' },
    ],
    promptLabel: 'Where the team is losing time',
  },
  {
    id: 'industry',
    type: FIELD_TYPES.TEXT,
    title: 'What industry are you in?',
    sub: 'Be specific — this shapes the AI persona and workflows we design.',
    placeholder: 'e.g. Cannabis retail, Real estate, Healthcare, E-commerce…',
    promptLabel: 'Industry',
  },
  {
    id: 'team_size',
    type: FIELD_TYPES.RADIO_PILLS,
    title: 'How big is your team?',
    sub: 'Full-time employees including yourself.',
    options: [
      { value: '1–10' },
      { value: '11–25' },
      { value: '26–50' },
      { value: '51–100' },
      { value: '100+' },
    ],
    promptLabel: 'Team size',
  },
  {
    id: 'revenue',
    type: FIELD_TYPES.RADIO_PILLS,
    title: 'Annual revenue?',
    sub: 'Helps us right-size the deployment and pricing tier.',
    options: [
      { value: 'Under $300K' },
      { value: '$300K–$1M' },
      { value: '$1M–$5M' },
      { value: '$5M–$20M' },
      { value: '$20M+' },
    ],
    promptLabel: 'Annual revenue',
  },
  {
    id: 'customer_channel',
    type: FIELD_TYPES.CHECKBOX_PILLS,
    title: 'How do customers reach you?',
    sub: 'These are the channels your AI coworker will live in.',
    options: [
      { value: 'Phone/Voice',       label: 'Phone / Voice' },
      { value: 'Email' },
      { value: 'Website/Form',      label: 'Website / Form' },
      { value: 'Walk-in' },
      { value: 'Instagram DM' },
      { value: 'WhatsApp' },
      { value: 'Multiple channels' },
    ],
    promptLabel: 'How customers reach them',
  },
  {
    id: 'tools',
    type: FIELD_TYPES.BRAND_PILLS,
    title: 'Which platforms does your business use?',
    sub: "We'll wire integrations in order of impact.",
    options: [
      { value: 'Slack',             icon: 'slack',           color: '#4A154B' },
      { value: 'Shopify',           icon: 'shopify',         color: '#95BF47' },
      { value: 'HubSpot',           icon: 'hubspot',         color: '#FF7A59' },
      { value: 'Salesforce',        icon: 'salesforce',      color: '#00A1E0' },
      { value: 'Gmail',             icon: 'gmail',           color: '#EA4335' },
      { value: 'Outlook',           icon: 'microsoftoutlook', color: '#0078D4' },
      { value: 'Google Calendar',   icon: 'googlecalendar',  color: '#4285F4' },
      { value: 'Airtable',          icon: 'airtable',        color: '#FCB400' },
      { value: 'QuickBooks',        icon: 'quickbooks',      color: '#2CA01C' },
      { value: 'NetSuite',          icon: 'oracle',          color: '#C74634' },
      { value: 'Zapier',            icon: 'zapier',          color: '#FF4F00' },
      { value: 'Notion',            icon: 'notion',          color: '#000000' },
    ],
    otherField: {
      id: 'tools_other',
      placeholder: 'Anything else? Custom tools, internal portals, ERPs we missed…',
    },
    promptLabel: 'Tools / platforms in use',
  },
  {
    id: 'device_os',
    type: FIELD_TYPES.RADIO_PILLS,
    title: 'What OS does your team use?',
    sub: 'Affects how we set up local integrations and onboarding.',
    options: [
      { value: 'Mac' },
      { value: 'Windows' },
      { value: 'Linux/Server', label: 'Linux / Server' },
      { value: 'Mix' },
    ],
    promptLabel: 'Team OS',
  },
  {
    id: 'crm',
    type: FIELD_TYPES.BRAND_RADIO,
    title: 'Do you have a CRM?',
    sub: "We'll connect your AI coworker here first.",
    options: [
      { value: 'HubSpot',     icon: 'hubspot',     color: '#FF7A59' },
      { value: 'Salesforce',  icon: 'salesforce',  color: '#00A1E0' },
      { value: 'Pipedrive',   icon: 'pipedrive',   color: '#1A1A1A' },
      { value: 'Other CRM',   icon: null },
      { value: 'No CRM yet',  icon: null,          label: 'No CRM yet' },
    ],
    promptLabel: 'CRM',
  },
  {
    id: 'email_provider',
    type: FIELD_TYPES.RADIO_PILLS,
    title: 'Email system?',
    sub: 'Your primary business email — this is often the first integration.',
    options: [
      { value: 'Google Workspace/Gmail', label: 'Google Workspace / Gmail' },
      { value: 'Outlook/M365',           label: 'Outlook / Microsoft 365' },
      { value: 'Both' },
      { value: 'Other' },
    ],
    promptLabel: 'Email provider',
  },
  {
    id: 'ai_tools',
    type: FIELD_TYPES.RADIO_PILLS,
    title: 'Are you using AI today?',
    sub: "We'll build on what's already working — not replace it.",
    options: [
      { value: 'ChatGPT/OpenAI',     label: 'ChatGPT / OpenAI' },
      { value: 'Claude/Anthropic',   label: 'Claude / Anthropic' },
      { value: 'Google Gemini' },
      { value: 'Microsoft Copilot' },
      { value: 'Make AI / Zapier AI', label: 'Make AI / Zapier AI' },
      { value: 'Not yet',            label: 'Not using AI yet' },
    ],
    promptLabel: 'AI tools already in use',
  },
  {
    id: 'bottleneck',
    type: FIELD_TYPES.TEXTAREA,
    title: 'Anything else we should know?',
    sub: 'Optional — constraints, deadlines, internal politics, related projects, anything that would change how we approach the call.',
    placeholder: "e.g. We're hiring fast and need to ramp the new team without doubling our admin time…",
    rows: 4,
    promptLabel: 'Additional context / bottleneck',
  },
];

export const FIELD_BY_ID = Object.freeze(
  FIELDS.reduce((acc, f) => { acc[f.id] = f; return acc; }, /** @type {Record<string,any>} */({})),
);

export const TOTAL_QUESTIONS = FIELDS.length;

/* ---------------------------------------------------------------------------
   Validation — runs server-side. Tolerant: nothing is strictly required, since
   the questionnaire allows skipping. Just type-checks so we don't crash the
   prompt builder on wonky data.
   --------------------------------------------------------------------------- */
export function validatePayload(data) {
  /** @type {string[]} */
  const errors = [];
  if (typeof data !== 'object' || data === null) {
    return { ok: false, errors: ['Payload must be an object'] };
  }
  for (const f of FIELDS) {
    const v = data[f.id];
    if (v == null || v === '') continue;
    if (f.type === FIELD_TYPES.CHECKBOX_PILLS || f.type === FIELD_TYPES.BRAND_PILLS) {
      if (!Array.isArray(v) && typeof v !== 'string') {
        errors.push(`${f.id}: expected array`);
      }
    } else if (typeof v !== 'string') {
      errors.push(`${f.id}: expected string`);
    }
    if (f.otherField && data[f.otherField.id] != null && typeof data[f.otherField.id] !== 'string') {
      errors.push(`${f.otherField.id}: expected string`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/* ---------------------------------------------------------------------------
   Build the prospect-summary block of the Anthropic prompt from a payload.
   Tolerant of post-rebrand field names so any rows submitted between the
   rebrand and this fix can still be re-graded without erroring.
   --------------------------------------------------------------------------- */
const LEGACY_KEY_MAP = {
  // Restored-original key  →  fallback names from the post-rebrand schema
  pain_points:      ['time_sinks'],
  customer_channel: ['channels', 'inbound'],
  tools:            ['integrations', 'platforms', 'stack'],
  device_os:        ['os'],
  ai_tools:         ['existing_ai'],
  bottleneck:       ['notes'],
};

function readField(qData, fieldId) {
  if (!qData) return null;
  const candidates = [fieldId, ...(LEGACY_KEY_MAP[fieldId] || [])];
  for (const k of candidates) {
    const v = qData[k];
    if (Array.isArray(v) && v.length) return v.join(', ');
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v != null && typeof v !== 'object' && typeof v !== 'undefined') return String(v);
  }
  return null;
}

export function buildPromptContext(qData, booking) {
  const lines = [
    `- Name: ${(booking && booking.name) || '—'}`,
    `- Company: ${(booking && booking.company) || '—'}`,
  ];
  for (const f of FIELDS) {
    const v = readField(qData, f.id);
    let line = `- ${f.promptLabel}: ${v || '—'}`;
    // If a brand picker has an "other" textarea filled in, append inline.
    if (f.otherField) {
      const other = readField(qData, f.otherField.id);
      if (other) line += ` (other: ${other})`;
    }
    lines.push(line);
  }
  if (booking && booking.tier) lines.push(`- Tier interest: ${booking.tier}`);
  if (booking && booking.notes) lines.push(`- Booking-time notes: ${booking.notes}`);
  return lines.join('\n');
}
