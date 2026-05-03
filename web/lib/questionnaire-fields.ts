/**
 * Questionnaire schema — single source of truth for the v2 app.
 *
 * This is the typed mirror of /lib/questionnaire-schema.js (the legacy site's
 * source of truth). Both versions stay in lockstep — when one changes the
 * other has to change. (In a future cleanup we'll pick one home — currently
 * Next.js can't reach outside its app root, so we duplicate.)
 *
 * Renaming a field updates the form (which renders from FIELDS), the prompt
 * (which builds via buildPromptContext), and the validator (validatePayload).
 * Field-name drift is structurally impossible.
 */

export type FieldType =
  | "textarea"
  | "text"
  | "radio_pills"
  | "checkbox_pills"
  | "brand_pills"
  | "brand_radio";

export interface FieldOption {
  value: string;
  label?: string;
  /** Simple Icons CDN slug — used by brand_pills + brand_radio */
  icon?: string | null;
  /** Brand color hex — also used by Simple Icons CDN white-on-color URL */
  color?: string;
}

export interface OtherTextField {
  id: string;
  placeholder: string;
}

export interface Field {
  id: string;
  type: FieldType;
  title: string;
  sub?: string;
  placeholder?: string;
  rows?: number;
  options?: FieldOption[];
  otherField?: OtherTextField;
  promptLabel: string;
}

export const FIELDS: Field[] = [
  {
    id: "pain_points",
    type: "checkbox_pills",
    title: "What's eating your team's time?",
    sub: "Select all that apply — we'll prioritize the biggest wins.",
    options: [
      { value: "Lead follow-up",           label: "Lead follow-up & nurturing" },
      { value: "Answering repetitive Qs",  label: "Answering repetitive questions" },
      { value: "Scheduling",               label: "Scheduling & calendar" },
      { value: "Quotes & proposals",       label: "Quotes & proposals" },
      { value: "Order/invoice processing", label: "Order / invoice processing" },
      { value: "Customer support",         label: "Customer support tickets" },
      { value: "Data entry & reporting",   label: "Data entry & reporting" },
      { value: "Employee onboarding",      label: "Employee onboarding" },
    ],
    promptLabel: "Where the team is losing time",
  },
  {
    id: "industry",
    type: "text",
    title: "What industry are you in?",
    sub: "Be specific — this shapes the AI persona and workflows we design.",
    placeholder: "e.g. Cannabis retail, Real estate, Healthcare, E-commerce…",
    promptLabel: "Industry",
  },
  {
    id: "team_size",
    type: "radio_pills",
    title: "How big is your team?",
    sub: "Full-time employees including yourself.",
    options: [{ value: "1–10" }, { value: "11–25" }, { value: "26–50" }, { value: "51–100" }, { value: "100+" }],
    promptLabel: "Team size",
  },
  {
    id: "revenue",
    type: "radio_pills",
    title: "Annual revenue?",
    sub: "Helps us right-size the deployment and pricing tier.",
    options: [
      { value: "Under $300K" }, { value: "$300K–$1M" }, { value: "$1M–$5M" },
      { value: "$5M–$20M" }, { value: "$20M+" },
    ],
    promptLabel: "Annual revenue",
  },
  {
    id: "customer_channel",
    type: "checkbox_pills",
    title: "How do customers reach you?",
    sub: "These are the channels your AI coworker will live in.",
    options: [
      { value: "Phone/Voice",       label: "Phone / Voice" },
      { value: "Email" },
      { value: "Website/Form",      label: "Website / Form" },
      { value: "Walk-in" },
      { value: "Instagram DM" },
      { value: "WhatsApp" },
      { value: "Multiple channels" },
    ],
    promptLabel: "How customers reach them",
  },
  {
    id: "tools",
    type: "brand_pills",
    title: "Which platforms does your business use?",
    sub: "We'll wire integrations in order of impact.",
    options: [
      { value: "Slack",            icon: "slack",            color: "#4A154B" },
      { value: "Shopify",          icon: "shopify",          color: "#95BF47" },
      { value: "HubSpot",          icon: "hubspot",          color: "#FF7A59" },
      { value: "Salesforce",       icon: "salesforce",       color: "#00A1E0" },
      { value: "Gmail",            icon: "gmail",            color: "#EA4335" },
      { value: "Outlook",          icon: "microsoftoutlook", color: "#0078D4" },
      { value: "Google Calendar",  icon: "googlecalendar",   color: "#4285F4" },
      { value: "Airtable",         icon: "airtable",         color: "#FCB400" },
      { value: "QuickBooks",       icon: "quickbooks",       color: "#2CA01C" },
      { value: "NetSuite",         icon: "oracle",           color: "#C74634" },
      { value: "Zapier",           icon: "zapier",           color: "#FF4F00" },
      { value: "Notion",           icon: "notion",           color: "#000000" },
    ],
    otherField: {
      id: "tools_other",
      placeholder: "Anything else? Custom tools, internal portals, ERPs we missed…",
    },
    promptLabel: "Tools / platforms in use",
  },
  {
    id: "device_os",
    type: "radio_pills",
    title: "What OS does your team use?",
    sub: "Affects how we set up local integrations and onboarding.",
    options: [
      { value: "Mac" }, { value: "Windows" },
      { value: "Linux/Server", label: "Linux / Server" }, { value: "Mix" },
    ],
    promptLabel: "Team OS",
  },
  {
    id: "crm",
    type: "brand_radio",
    title: "Do you have a CRM?",
    sub: "We'll connect your AI coworker here first.",
    options: [
      { value: "HubSpot",     icon: "hubspot",    color: "#FF7A59" },
      { value: "Salesforce",  icon: "salesforce", color: "#00A1E0" },
      { value: "Pipedrive",   icon: "pipedrive",  color: "#1A1A1A" },
      { value: "Other CRM",   icon: null },
      { value: "No CRM yet",  icon: null,         label: "No CRM yet" },
    ],
    promptLabel: "CRM",
  },
  {
    id: "email_provider",
    type: "radio_pills",
    title: "Email system?",
    sub: "Your primary business email — this is often the first integration.",
    options: [
      { value: "Google Workspace/Gmail", label: "Google Workspace / Gmail" },
      { value: "Outlook/M365",           label: "Outlook / Microsoft 365" },
      { value: "Both" },
      { value: "Other" },
    ],
    promptLabel: "Email provider",
  },
  {
    id: "ai_tools",
    type: "radio_pills",
    title: "Are you using AI today?",
    sub: "We'll build on what's already working — not replace it.",
    options: [
      { value: "ChatGPT/OpenAI",     label: "ChatGPT / OpenAI" },
      { value: "Claude/Anthropic",   label: "Claude / Anthropic" },
      { value: "Google Gemini" },
      { value: "Microsoft Copilot" },
      { value: "Make AI / Zapier AI", label: "Make AI / Zapier AI" },
      { value: "Not yet",            label: "Not using AI yet" },
    ],
    promptLabel: "AI tools already in use",
  },
  {
    id: "bottleneck",
    type: "textarea",
    title: "Anything else we should know?",
    sub: "Optional — constraints, deadlines, internal politics, related projects, anything that would change how we approach the call.",
    placeholder: "e.g. We're hiring fast and need to ramp the new team without doubling our admin time…",
    rows: 4,
    promptLabel: "Additional context / bottleneck",
  },
];

export const TOTAL_QUESTIONS = FIELDS.length;
export const FIELD_BY_ID: Record<string, Field> =
  Object.freeze(FIELDS.reduce((acc, f) => { acc[f.id] = f; return acc; }, {} as Record<string, Field>));

/* ────────────────────────────────────────────────────────────────────────── */

const LEGACY_KEY_MAP: Record<string, string[]> = {
  pain_points:      ["time_sinks"],
  customer_channel: ["channels", "inbound"],
  tools:            ["integrations", "platforms", "stack"],
  device_os:        ["os"],
  ai_tools:         ["existing_ai"],
  bottleneck:       ["notes"],
};

function readField(qData: Record<string, unknown> | null | undefined, fieldId: string): string | null {
  if (!qData) return null;
  const candidates = [fieldId, ...(LEGACY_KEY_MAP[fieldId] ?? [])];
  for (const k of candidates) {
    const v = qData[k];
    if (Array.isArray(v) && v.length) return v.join(", ");
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v != null && typeof v !== "object" && typeof v !== "undefined") return String(v);
  }
  return null;
}

export interface PromptBooking {
  name?: string | null;
  company?: string | null;
  tier?: string | null;
  notes?: string | null;
}

export function buildPromptContext(qData: Record<string, unknown>, booking: PromptBooking): string {
  const lines: string[] = [
    `- Name: ${booking.name ?? "—"}`,
    `- Company: ${booking.company ?? "—"}`,
  ];
  for (const f of FIELDS) {
    const v = readField(qData, f.id);
    let line = `- ${f.promptLabel}: ${v ?? "—"}`;
    if (f.otherField) {
      const other = readField(qData, f.otherField.id);
      if (other) line += ` (other: ${other})`;
    }
    lines.push(line);
  }
  if (booking.tier)  lines.push(`- Tier interest: ${booking.tier}`);
  if (booking.notes) lines.push(`- Booking-time notes: ${booking.notes}`);
  return lines.join("\n");
}

export function validatePayload(data: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) return { ok: false, errors: ["Payload must be an object"] };
  const d = data as Record<string, unknown>;
  for (const f of FIELDS) {
    const v = d[f.id];
    if (v == null || v === "") continue;
    if (f.type === "checkbox_pills" || f.type === "brand_pills") {
      if (!Array.isArray(v) && typeof v !== "string") errors.push(`${f.id}: expected array`);
    } else if (typeof v !== "string") {
      errors.push(`${f.id}: expected string`);
    }
    if (f.otherField && d[f.otherField.id] != null && typeof d[f.otherField.id] !== "string") {
      errors.push(`${f.otherField.id}: expected string`);
    }
  }
  return { ok: errors.length === 0, errors };
}
