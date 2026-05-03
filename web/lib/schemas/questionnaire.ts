import { z } from "zod";

/**
 * Questionnaire schemas. These drive the post-booking qualification flow that
 * feeds the Anthropic automation-map prompt.
 */

export const questionnairePayloadSchema = z.object({
  booking_id: z.string().uuid(),
  email: z.string().email().toLowerCase().optional(),
  business_description: z.string().max(2000).optional().default(""),
  revenue: z.string().max(40).optional().default(""),
  team_size: z.string().max(20).optional().default(""),
  pain_points: z.array(z.string()).default([]),
  hours_lost: z.string().max(20).optional().default(""),
  stack: z.string().max(2000).optional().default(""),    // joined "HubSpot, Slack, ..."
  prior_attempts: z.string().max(80).optional().default(""),
  prior_notes: z.string().max(2000).optional().default(""),
  success_definition: z.string().max(2000).optional().default(""),
  budget: z.string().max(40).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
});

export type QuestionnairePayload = z.infer<typeof questionnairePayloadSchema>;
