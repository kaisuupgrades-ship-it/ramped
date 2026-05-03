import { z } from "zod";

export const freeRoadmapPayloadSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  email: z.string().email().toLowerCase(),
  company: z.string().min(1).max(180).trim(),
  role: z.string().max(80).optional().default(""),
  team_size: z.string().max(20).optional().default(""),
  pain_points: z.array(z.string()).default([]),
  stack: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional().default(""),
});

export type FreeRoadmapPayload = z.infer<typeof freeRoadmapPayloadSchema>;

export const freeRoadmapFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  company: z.string().min(1, "Company is required"),
  role: z.string().optional(),
  team_size: z.string().optional(),
  notes: z.string().optional(),
});
export type FreeRoadmapFormData = z.infer<typeof freeRoadmapFormSchema>;
