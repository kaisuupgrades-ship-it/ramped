import { z } from "zod";

/** API payload for /api/free-roadmap.
 *  Intake fields (name/email/company) are required. Everything else is the
 *  11-question questionnaire data — variable shape, validated downstream by
 *  validatePayload from questionnaire-fields. We accept passthrough so we
 *  don't have to mirror every questionnaire field here. */
export const freeRoadmapPayloadSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  email: z.string().email().toLowerCase(),
  company: z.string().min(1).max(180).trim(),
}).passthrough();

export type FreeRoadmapPayload = z.infer<typeof freeRoadmapPayloadSchema>;

/** Form schema used by the intake step on /free-roadmap (just the contact
 *  block — the 11-question step is handled by QuestionnaireForm). */
export const freeRoadmapFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  company: z.string().min(1, "Company is required"),
});
export type FreeRoadmapFormData = z.infer<typeof freeRoadmapFormSchema>;
