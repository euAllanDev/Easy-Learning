import { calculateFocusedSeconds, calculatePausedSeconds } from "./study-session-duration";
import { validateCompletionResult } from "./study-session-rules";
import type { StudySession, StudySessionAction, StudySessionStatus } from "./study-session-types";

const ALLOWED_ACTIONS: Record<StudySessionStatus, StudySessionAction["type"][]> = {
  PLANNED: ["start", "skip", "cancel", "reschedule"],
  IN_PROGRESS: ["pause", "complete", "cancel"],
  PAUSED: ["resume", "complete", "cancel"],
  COMPLETED: [],
  SKIPPED: [],
  CANCELLED: [],
};

export class InvalidSessionTransitionError extends Error {
  constructor(readonly status: StudySessionStatus, readonly action: StudySessionAction["type"]) {
    super(`A ação ${action} não é permitida para uma sessão ${status}.`);
  }
}

export function transitionSession(session: StudySession, action: StudySessionAction): StudySession {
  if (!ALLOWED_ACTIONS[session.status].includes(action.type)) {
    throw new InvalidSessionTransitionError(session.status, action.type);
  }
  const base = { ...session, updatedAt: action.at };
  switch (action.type) {
    case "start":
      return { ...base, status: "IN_PROGRESS", startedAt: action.at, resumedAt: action.at, pausedAt: null, focusedSeconds: 0, pausedSeconds: 0 };
    case "pause":
      return { ...base, status: "PAUSED", focusedSeconds: calculateFocusedSeconds(session, action.at), pausedAt: action.at };
    case "resume":
      return { ...base, status: "IN_PROGRESS", pausedSeconds: calculatePausedSeconds(session, action.at), pausedAt: null, resumedAt: action.at };
    case "complete": {
      const result = validateCompletionResult(action.result ?? {});
      const calculatedDuration = calculateFocusedSeconds(session, action.at);
      return {
        ...base,
        status: "COMPLETED",
        completedAt: action.at,
        pausedAt: null,
        focusedSeconds: calculatedDuration,
        actualDurationSeconds: result.actualDurationSeconds ?? calculatedDuration,
        questions: result.questions,
        correctAnswers: result.correctAnswers,
        accuracy: result.accuracy,
        difficulty: result.difficulty ?? null,
        notes: result.notes,
      };
    }
    case "skip":
      return { ...base, status: "SKIPPED", notes: action.notes?.trim() || session.notes };
    case "cancel":
      return { ...base, status: "CANCELLED", pausedAt: null, focusedSeconds: calculateFocusedSeconds(session, action.at) };
    case "reschedule":
      return {
        ...base,
        plannedStartAt: action.plannedStartAt,
        plannedEndAt: action.plannedEndAt,
        plannedDurationSeconds: Math.floor((action.plannedEndAt.getTime() - action.plannedStartAt.getTime()) / 1000),
      };
  }
}
