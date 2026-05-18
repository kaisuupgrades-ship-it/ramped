import { z } from "zod";

/**
 * Booking schemas — shared between client form + server API route.
 *
 * Frontend imports `bookingFormSchema` for react-hook-form validation.
 * Backend imports `bookingPayloadSchema` for request body validation.
 * They're the same shape, with the frontend adding the slot/date fields that
 * get combined into `datetime` before sending.
 */

// Optional URL — accepts bare domains ("portocol.com") or full URLs.
// Empty string is treated as "not provided" so it survives form submission
// without forcing required-validation. Server falls back to email-domain
// derivation when this is empty (lib/deck/scraper.ts: deriveUrlFromEmail).
const optionalUrl = z.string().trim().max(500).optional().or(z.literal(""));

export const bookingPayloadSchema = z.object({
  datetime: z.string().datetime(),       // ISO
  name: z.string().min(1).max(120).trim(),
  email: z.string().email().toLowerCase(),
  company: z.string().min(1).max(180).trim(),
  company_url: optionalUrl,              // optional — powers the auto deck generator
  notes: z.string().max(2000).optional().default(""),
  timezone: z.string().min(1).max(80),   // user's browser TZ
  tier: z.enum(["starter", "growth", "enterprise"]).optional(),
  billing: z.enum(["monthly", "annual"]).optional(),
});

export type BookingPayload = z.infer<typeof bookingPayloadSchema>;

/** Form-level schema for the BookingForm React component. */
export const bookingFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Enter a valid email"),
  company: z.string().min(1, "Company is required").max(180),
  company_url: optionalUrl,
  notes: z.string().max(2000).optional(),
});

export type BookingFormData = z.infer<typeof bookingFormSchema>;

export const bookingResponseSchema = z.object({
  ok: z.boolean(),
  booking_id: z.string().uuid().optional(),
  error: z.string().optional(),
});

export type BookingResponse = z.infer<typeof bookingResponseSchema>;
