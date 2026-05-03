import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // We do NOT run migrations from drizzle-kit against the existing Supabase —
  // that's still managed via /db/migrations/*.sql at the repo root. This config
  // exists so we can `drizzle-kit generate` types from the schema for queries.
  strict: true,
} satisfies Config;
