import type { StudySession } from "./study-session-types";

function elapsedSeconds(from: Date | null, to: Date) {
  if (!from) return 0;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
}

export function calculateFocusedSeconds(session: StudySession, at: Date = new Date()) {
  if (session.status !== "IN_PROGRESS") return session.focusedSeconds;
  return session.focusedSeconds + elapsedSeconds(session.resumedAt ?? session.startedAt, at);
}

export function calculatePausedSeconds(session: StudySession, at: Date = new Date()) {
  if (session.status !== "PAUSED") return session.pausedSeconds;
  return session.pausedSeconds + elapsedSeconds(session.pausedAt, at);
}

export function calculateRemainingSeconds(session: StudySession, at: Date = new Date()) {
  return Math.max(0, session.plannedDurationSeconds - calculateFocusedSeconds(session, at));
}
