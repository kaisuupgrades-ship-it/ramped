import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, unique } from "drizzle-orm/pg-core";

/**
 * Drizzle schema mirroring the existing Supabase tables. We're NOT migrating
 * the schema — these definitions just give us type-safe queries against the
 * tables that the original /db/migrations/*.sql files already created.
 *
 * Add columns here when the SQL schema gets new ones (or run drizzle-kit
 * introspect later to auto-sync).
 */

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  datetime: timestamp("datetime", { withTimezone: true }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  notes: text("notes"),
  timezone: text("timezone"),
  tier: text("tier"),
  billing: text("billing"),

  // Set by /api/questionnaire after the user fills it out
  questionnaire: jsonb("questionnaire"),
  automation_map: jsonb("automation_map"),

  // Stripe + onboarding (existing)
  stripe_customer_id: text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  stripe_invoice_id: text("stripe_invoice_id"),
  payment_status: text("payment_status"),
  subscription_started_at: timestamp("subscription_started_at", { withTimezone: true }),
  subscription_cancelled_at: timestamp("subscription_cancelled_at", { withTimezone: true }),
  onboarding_paid_at: timestamp("onboarding_paid_at", { withTimezone: true }),
  billing_cadence: text("billing_cadence"),
  contract_amount_cents: integer("contract_amount_cents"),
  onboarding_data: jsonb("onboarding_data"),
  onboarding_completed_at: timestamp("onboarding_completed_at", { withTimezone: true }),

  // Portal tracking
  portal_last_seen_at: timestamp("portal_last_seen_at", { withTimezone: true }),
  portal_visit_count: integer("portal_visit_count").default(0).notNull(),

  // Profile / preferences (mig 005)
  phone: text("phone"),
  notification_prefs: jsonb("notification_prefs"),
  profile_updated_at: timestamp("profile_updated_at", { withTimezone: true }),

  status: text("status"),
  meet_link: text("meet_link"),

  // Optional URL captured on the booking form. Powers the auto-generated
  // prep deck (see prospectDecks below). Optional — if absent, the deck
  // generator falls back to deriving it from the email domain.
  company_url: text("company_url"),

  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueDatetime: unique("bookings_datetime_unique").on(t.datetime),
}));

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  role: text("role"),
  team_size: text("team_size"),
  pain_points: jsonb("pain_points"),
  stack: jsonb("stack"),
  notes: text("notes"),
  source: text("source"),
  ip_hash: text("ip_hash"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const automationMaps = pgTable("automation_maps", {
  id: uuid("id").primaryKey().defaultRandom(),
  lead_id: uuid("lead_id").references(() => leads.id),
  booking_id: uuid("booking_id").references(() => bookings.id),
  email: text("email"),
  payload: jsonb("payload"),
  generated_at: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  delivered_at: timestamp("delivered_at", { withTimezone: true }),
});

export const availabilitySettings = pgTable("availability_settings", {
  id: integer("id").primaryKey(),
  days_available: jsonb("days_available").notNull(),
  start_hour: integer("start_hour").notNull(),
  end_hour: integer("end_hour").notNull(),
  slot_duration_min: integer("slot_duration_min").notNull(),
  blocked_dates: jsonb("blocked_dates").notNull(),
  timezone: text("timezone").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Per-booking auto-generated prep deck. Built by lib/deck/generator.ts:
 * scrape company URL → Claude extracts signals → pptxgenjs renders deck →
 * upload to Supabase Storage. Jon reviews + downloads from /admin before
 * each call.
 *
 * Status lifecycle: pending → researching → generating → ready | failed.
 * On failure, error_message + generation_log are populated so we can debug
 * without re-running the whole pipeline.
 */
export const prospectDecks = pgTable("prospect_decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  booking_id: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),  // pending | researching | generating | ready | failed
  company_url: text("company_url"),                     // resolved URL (from booking field or email-domain fallback)
  company_url_source: text("company_url_source"),       // "form" | "email_domain" | null
  research: jsonb("research"),                          // { industry, icp, pains, founder, voice_samples, ... }
  research_confidence: text("research_confidence"),     // "high" | "medium" | "low"
  deck_storage_path: text("deck_storage_path"),         // bucket/key for the generated .pptx
  deck_filename: text("deck_filename"),                 // human-readable filename
  template_version: text("template_version"),           // e.g. "v3.0" so we can re-roll when the template moves
  generation_log: jsonb("generation_log"),              // chronological steps + timings (for debugging)
  error_message: text("error_message"),
  reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type AutomationMap = typeof automationMaps.$inferSelect;
export type ProspectDeck = typeof prospectDecks.$inferSelect;
export type NewProspectDeck = typeof prospectDecks.$inferInsert;
