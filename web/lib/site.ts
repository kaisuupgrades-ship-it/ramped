/**
 * Site-wide constants. The single source of truth for anything that's
 * displayed in more than one place: contact email, social URLs, the legal
 * company name, the tagline, etc.
 */
export const site = {
  name: "Ramped AI",
  domain: "30dayramp.com",
  tagline: "Your AI department, live in 30 days.",
  description:
    "Done-for-you AI implementation. We build, deploy, and run AI agents inside your operating business — automating your highest-friction workflows on a flat monthly fee.",
  email: "jon@30dayramp.com",
  callDuration: "30-min",
  guaranteeDays: 30,
  copyrightYear: new Date().getFullYear(),
} as const;

export const cta = {
  primary: "Book a discovery call →",
  secondary: "Get your free roadmap",
  pricing: "Get started →",
  enterprise: "Let's talk",
} as const;

export const navLinks = [
  { href: "/about", label: "About" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/comparison", label: "Compare" },
  { href: "/resources", label: "Resources" },
] as const;

export const footerLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/comparison", label: "Compare" },
  { href: "/resources", label: "Resources" },
  { href: "/agent-library", label: "Agent library" },
  { href: "/book", label: "Book a call" },
  { href: "/free-roadmap", label: "Free roadmap" },
  { href: "/privacy", label: "Privacy" },
] as const;

export const tickerItems = [
  "Save 40+ hours per week",
  "30-day go-live guarantee",
  "3× faster lead response time",
  "Avg. $12,000+ / mo saved vs. staffing",
  "5× avg. ROI in year 1",
  "24/7 AI coverage — no sick days",
] as const;
