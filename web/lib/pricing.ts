/**
 * Pricing — single source of truth.
 *
 * Old site had this duplicated across index.html, book.html, comparison.html,
 * one-pager.html, pricing-onepager.html — five files that had to be updated
 * in lockstep. Now it's one file. Marketing renders from this. Stripe products
 * point at this. Admin reads this.
 */

export type BillingCadence = "monthly" | "annual";

export interface TierPrice {
  monthly: number;          // USD/mo if paid monthly
  annual: number;           // effective USD/mo if paid annually (12mo at discount)
  annualSavings: number;    // total $ saved over the year vs monthly
  onboarding: number;       // one-time onboarding fee
}

export interface Tier {
  id: "starter" | "growth" | "enterprise";
  name: string;
  badge?: string;           // e.g. "Most popular"
  bestFor: string;          // employee count blurb
  price: TierPrice | null;  // null = "Custom" (Enterprise)
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
}

export const tiers: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    bestFor: "Best for 5–30 employees",
    price: {
      monthly: 2_500,
      annual: 2_083,
      annualSavings: 5_000,
      onboarding: 2_500,
    },
    features: [
      "Custom AI agent trained to your business",
      "Up to 5 workflow automations",
      "3–5 software integrations",
      "Monthly check-in call",
      "All compute & hosting included",
    ],
    cta: { label: "Get started →", href: "/book?tier=starter" },
  },
  {
    id: "growth",
    name: "Growth",
    badge: "Most popular",
    bestFor: "Best for 30–100 employees",
    price: {
      monthly: 5_000,
      annual: 4_167,
      annualSavings: 10_000,
      onboarding: 3_500,
    },
    features: [
      "Custom AI agent — expanded scope",
      "Up to 15 workflow automations",
      "10+ software integrations",
      "Weekly check-ins + monthly strategy call",
      "All compute & hosting included",
    ],
    cta: { label: "Get started →", href: "/book?tier=growth" },
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    bestFor: "Best for 100+ employees",
    price: null,
    features: [
      "Full AI operations buildout",
      "Unlimited workflow automations",
      "Custom development & integrations",
      "Dedicated support + QBRs",
      "White-label option available",
    ],
    cta: { label: "Let's talk", href: "/book?tier=enterprise" },
  },
];

export const enterpriseFloor = 10_000; // shown as "From $10K/mo"

export function formatPrice(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function tierByName(name: string): Tier | undefined {
  return tiers.find((t) => t.id === name.toLowerCase());
}
