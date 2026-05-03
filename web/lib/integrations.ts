/**
 * Supported tool integrations — single source of truth.
 *
 * Used by:
 *  - /questionnaire stack picker (brand-color pills)
 *  - "Connected to: ..." footer in homepage Slack demo
 *  - Anthropic prompt context when generating automation maps
 *
 * Logos load from the Simple Icons CDN (open-source brand SVGs). If a slug
 * 404s, the <img> falls back to a colored letter chip.
 */

export interface Integration {
  /** Display name */
  name: string;
  /** Simple Icons CDN slug — see https://simpleicons.org */
  iconSlug: string;
  /** Brand color (hex) for fallback chip + mention in copy */
  color: string;
  /** Single-letter / 2-letter fallback if the icon fails to load */
  fallback: string;
  /** Category (used for grouping in the UI later) */
  category: "crm" | "erp" | "comms" | "ecommerce" | "support" | "ops" | "other";
}

export const integrations: Integration[] = [
  { name: "HubSpot",          iconSlug: "hubspot",          color: "#FF7A59", fallback: "H",  category: "crm" },
  { name: "Salesforce",       iconSlug: "salesforce",       color: "#00A1E0", fallback: "SF", category: "crm" },
  { name: "NetSuite",         iconSlug: "oracle",           color: "#C74634", fallback: "N",  category: "erp" },
  { name: "QuickBooks",       iconSlug: "quickbooks",       color: "#2CA01C", fallback: "Q",  category: "erp" },
  { name: "Shopify",          iconSlug: "shopify",          color: "#95BF47", fallback: "S",  category: "ecommerce" },
  { name: "Slack",            iconSlug: "slack",            color: "#4A154B", fallback: "#",  category: "comms" },
  { name: "Gong",             iconSlug: "gong",             color: "#9333EA", fallback: "G",  category: "ops" },
  { name: "Zendesk",          iconSlug: "zendesk",          color: "#03363D", fallback: "Z",  category: "support" },
  { name: "Notion",           iconSlug: "notion",           color: "#000000", fallback: "N",  category: "ops" },
  { name: "Asana",            iconSlug: "asana",            color: "#F06A6A", fallback: "A",  category: "ops" },
  { name: "Airtable",         iconSlug: "airtable",         color: "#FCB400", fallback: "At", category: "ops" },
  { name: "Google Workspace", iconSlug: "googleworkspace",  color: "#4285F4", fallback: "G",  category: "comms" },
];

/** Used by the questionnaire — a flat list of just names. */
export const integrationNames = integrations.map((i) => i.name);

export function integrationByName(name: string): Integration | undefined {
  return integrations.find((i) => i.name.toLowerCase() === name.toLowerCase());
}

/** CDN URL for a brand logo. White-on-color works well on dark UI. */
export function iconUrl(slug: string, color?: string): string {
  if (color) return `https://cdn.simpleicons.org/${slug}/${color.replace("#", "")}`;
  return `https://cdn.simpleicons.org/${slug}`;
}
