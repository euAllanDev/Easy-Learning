import type { Goal } from "@/domain/goals/goal";
import type { Availability } from "@/domain/availability/availability-types";
import type { StudySession } from "@/domain/study-session/study-session-types";

export function serializeGoal({ userId: _userId, ...goal }: Goal) {
  return { ...goal, createdAt: goal.createdAt.toISOString(), updatedAt: goal.updatedAt.toISOString() };
}

export function serializeAvailability({ userId: _userId, ...availability }: Availability) {
  return { ...availability, createdAt: availability.createdAt.toISOString(), updatedAt: availability.updatedAt.toISOString() };
}

export function serializeStudySession({ userId: _userId, ...session }: StudySession) {
  return {
    ...session,
    plannedStartAt: session.plannedStartAt.toISOString(),
    plannedEndAt: session.plannedEndAt.toISOString(),
    startedAt: session.startedAt?.toISOString() ?? null,
    pausedAt: session.pausedAt?.toISOString() ?? null,
    resumedAt: session.resumedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
