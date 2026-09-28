import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dayOfWeekSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]);

export const createAvailabilityRequestSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  startTime: timeSchema,
  endTime: timeSchema,
}).strict();

export const updateAvailabilityRequestSchema = createAvailabilityRequestSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Informe ao menos um campo para atualizar." },
);

export const availabilityResponseSchema = z.object({
  id: z.uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeSchema,
  endTime: timeSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const availabilityListResponseSchema = z.array(availabilityResponseSchema);
