/**
 * Pain-point options shown in the questionnaire. Single source of truth so
 * any new option flows through to every form + the Anthropic prompt context.
 */
export const painPoints = [
  { value: "Lead intake",     label: "Lead intake / qualification" },
  { value: "Quoting",         label: "Quoting / proposals" },
  { value: "Order ops",       label: "Order processing" },
  { value: "Inventory",       label: "Inventory / reorders" },
  { value: "Finance",         label: "Finance / reporting" },
  { value: "Customer support", label: "Customer support" },
  { value: "Recruiting",      label: "Recruiting / HR" },
] as const;

export const painPointValues = painPoints.map((p) => p.value);
export type PainPoint = typeof painPointValues[number];

export const teamSizes = ["1-10", "11-50", "51-200", "200+"] as const;
export const revenueBands = ["<$1M", "$1-5M", "$5-20M", "$20-100M", "$100M+"] as const;
export const budgetBands = ["<$2.5K", "$2.5-5K", "$5-10K", "$10K+", "exploring"] as const;
export const industries = [
  { value: "Distribution", label: "Distribution / Wholesale" },
  { value: "Ecommerce",    label: "E-commerce" },
  { value: "Services",     label: "Professional services" },
  { value: "SaaS",         label: "SaaS / Software" },
  { value: "Other",        label: "Other" },
] as const;
export const roles = [
  { value: "Founder/CEO", label: "Founder / CEO" },
  { value: "COO/Ops",     label: "COO / Head of Ops" },
  { value: "CFO/Finance", label: "CFO / Finance lead" },
  { value: "CRO/Sales",   label: "CRO / Sales lead" },
  { value: "Other",       label: "Other" },
] as const;
export const hoursLost = ["<10", "10-25", "25-50", "50+"] as const;
export const priorAttempts = [
  "Never", "Zapier/Make", "ChatGPT", "Internal build", "Consultant",
] as const;
