import { z } from "zod";

/**
 * Validated server-side environment variables. Importing from here gives you
 * autocomplete + crashes the app at boot if a required var is missing — much
 * better than discovering missing config at request time.
 *
 * Add a var: 1) put it in .env.example, 2) add to schema below, 3) reference
 * via `serverEnv.YOUR_VAR`.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().default("jon@30dayramp.com"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5"),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  MAP_LINK_SECRET: z.string().min(16).optional(),
  IP_HASH_SALT: z.string().min(8).optional(),
  CRON_SECRET: z.string().optional(),
  SITE_URL: z.string().url().default("https://www.30dayramp.com"),
  SENTRY_DSN: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://www.30dayramp.com"),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
});

function parse<T extends z.ZodTypeAny>(schema: T, source: Record<string, string | undefined>): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    console.error("Environment variable validation failed:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration. Check .env.local against .env.example.");
  }
  return result.data;
}

// Build a plain object from process.env so Zod can walk it.
const rawServer: Record<string, string | undefined> = {
  DATABASE_URL: process.env.DATABASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  MAP_LINK_SECRET: process.env.MAP_LINK_SECRET,
  IP_HASH_SALT: process.env.IP_HASH_SALT,
  CRON_SECRET: process.env.CRON_SECRET,
  SITE_URL: process.env.SITE_URL,
  SENTRY_DSN: process.env.SENTRY_DSN,
};

const rawClient: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
};

// Lazy: only validate server env when first accessed (so the build doesn't
// crash if you're previewing without all secrets set).
let _server: z.infer<typeof serverSchema> | null = null;
let _client: z.infer<typeof clientSchema> | null = null;

export function serverEnv() {
  if (_server === null) _server = parse(serverSchema, rawServer);
  return _server;
}

export function clientEnv() {
  if (_client === null) _client = parse(clientSchema, rawClient);
  return _client;
}
