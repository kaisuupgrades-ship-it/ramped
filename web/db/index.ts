import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Drizzle DB client. Uses DATABASE_URL (Supabase pooler URL recommended in
 * serverless contexts so we don't blow connection limits).
 *
 * Usage:
 *   import { db, schema } from "@/db";
 *   const rows = await db.select().from(schema.bookings).where(...);
 */
const url = process.env.DATABASE_URL;

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

const client = url
  ? (globalThis.__pgClient ?? postgres(url, { prepare: false, max: 1 }))
  : null;

if (process.env.NODE_ENV !== "production" && client) {
  globalThis.__pgClient = client;
}

export const db = client ? drizzle(client, { schema }) : (null as never);
export { schema };
