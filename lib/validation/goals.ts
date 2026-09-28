import { z } from "zod";
import { GOAL_PRIORITIES, GOAL_STATUSES } from "@/domain/goals/goal";

export const createGoalRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  priority: z.enum(GOAL_PRIORITIES).default("MEDIUM"),
  idealMinutesPerDay: z.number().int().min(1).max(1440),
  minimumMinutesPerDay: z.number().int().min(1).max(1440),
}).strict();

export const updateGoalRequestSchema = createGoalRequestSchema.partial().extend({
  status: z.enum(GOAL_STATUSES).optional(),
}).strict();

export const goalResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  priority: z.enum(GOAL_PRIORITIES),
  idealMinutesPerDay: z.number().int(),
  minimumMinutesPerDay: z.number().int(),
  status: z.enum(GOAL_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const goalsResponseSchema = z.array(goalResponseSchema);
