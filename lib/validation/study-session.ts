import { z } from "zod";
import { STUDY_SESSION_DIFFICULTIES, STUDY_SESSION_TYPES } from "@/domain/study-session/study-session-types";

const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const optionalId = z.uuid().nullable().optional();
const resultFields = {
  actualDurationSeconds: z.number().int().nonnegative().optional(),
  questions: z.number().int().nonnegative().nullable().optional(),
  correctAnswers: z.number().int().nonnegative().nullable().optional(),
  difficulty: z.enum(STUDY_SESSION_DIFFICULTIES).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
};

export const createStudySessionRequestSchema = z.object({
  objectiveId: optionalId,
  areaId: optionalId,
  topicId: optionalId,
  title: z.string().trim().min(1).max(160).nullable().optional(),
  type: z.enum(STUDY_SESSION_TYPES),
  plannedStartAt: isoDate.optional(),
  plannedEndAt: isoDate.optional(),
  plannedDurationSeconds: z.number().int().positive(),
  ...resultFields,
}).strict();

export const completeStudySessionRequestSchema = z.object(resultFields).strict();

export const skipStudySessionRequestSchema = z.object({ notes: z.string().max(2000).nullable().optional() }).strict();

export const rescheduleStudySessionRequestSchema = z.object({
  plannedStartAt: isoDate,
  plannedEndAt: isoDate,
}).strict();
