export const STUDY_SESSION_TYPES = ["PLANNED", "MANUAL"] as const;
export const STUDY_SESSION_STATUSES = ["PLANNED", "IN_PROGRESS", "PAUSED", "COMPLETED", "SKIPPED", "CANCELLED"] as const;
export const STUDY_SESSION_DIFFICULTIES = ["EASY", "NORMAL", "HARD"] as const;
export const POMODORO_CYCLE_KINDS = ["FOCUS", "SHORT_BREAK", "LONG_BREAK"] as const;

export type StudySessionType = (typeof STUDY_SESSION_TYPES)[number];
export type StudySessionStatus = (typeof STUDY_SESSION_STATUSES)[number];
export type StudySessionDifficulty = (typeof STUDY_SESSION_DIFFICULTIES)[number];
export type PomodoroCycleKind = (typeof POMODORO_CYCLE_KINDS)[number];

export type StudySession = {
  id: string;
  userId: string;
  objectiveId: string | null;
  areaId: string | null;
  topicId: string | null;
  title: string | null;
  objectiveName: string | null;
  areaName: string | null;
  topicName: string | null;
  type: StudySessionType;
  status: StudySessionStatus;
  plannedStartAt: Date;
  plannedEndAt: Date;
  startedAt: Date | null;
  pausedAt: Date | null;
  resumedAt: Date | null;
  completedAt: Date | null;
  plannedDurationSeconds: number;
  actualDurationSeconds: number | null;
  focusedSeconds: number;
  pausedSeconds: number;
  questions: number | null;
  correctAnswers: number | null;
  accuracy: number | null;
  difficulty: StudySessionDifficulty | null;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateStudySessionInput = {
  objectiveId?: string | null;
  areaId?: string | null;
  topicId?: string | null;
  title?: string | null;
  type: StudySessionType;
  plannedStartAt?: Date;
  plannedEndAt?: Date;
  plannedDurationSeconds: number;
  actualDurationSeconds?: number;
  questions?: number | null;
  correctAnswers?: number | null;
  difficulty?: StudySessionDifficulty | null;
  notes?: string | null;
};

export type CompletionResult = {
  actualDurationSeconds?: number;
  questions?: number | null;
  correctAnswers?: number | null;
  difficulty?: StudySessionDifficulty | null;
  notes?: string | null;
};

export type StudySessionAction =
  | { type: "start"; at: Date }
  | { type: "pause"; at: Date }
  | { type: "resume"; at: Date }
  | { type: "complete"; at: Date; result?: CompletionResult }
  | { type: "cancel"; at: Date }
  | { type: "skip"; at: Date; notes?: string | null }
  | { type: "reschedule"; at: Date; plannedStartAt: Date; plannedEndAt: Date };

export type StudySessionPeriod = "today" | "week" | "month";

export type StudySessionSummary = {
  completedSessions: number;
  actualDurationSeconds: number;
  questions: number;
  correctAnswers: number;
  accuracy: number | null;
};

export type PomodoroConfiguration = {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  cycles: number;
};
