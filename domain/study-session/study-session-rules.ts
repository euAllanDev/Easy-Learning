import type { CompletionResult, CreateStudySessionInput, StudySession } from "./study-session-types";

export type StudySessionRuleCode =
  | "INVALID_DURATION"
  | "INVALID_INTERVAL"
  | "INVALID_RESULT"
  | "INVALID_RELATION"
  | "SESSION_CONFLICT"
  | "OUTSIDE_AVAILABILITY"
  | "ACTIVE_SESSION_EXISTS"
  | "CONCURRENT_CHANGE";

export class StudySessionRuleError extends Error {
  constructor(message: string, readonly code: StudySessionRuleCode) {
    super(message);
  }
}

export function calculateAccuracy(questions: number | null, correctAnswers: number | null) {
  if (!questions) return null;
  return Math.round(((correctAnswers ?? 0) / questions) * 10_000) / 100;
}

export function validateCompletionResult(result: CompletionResult) {
  const actualDurationSeconds = result.actualDurationSeconds;
  const questions = result.questions ?? null;
  const correctAnswers = result.correctAnswers ?? null;
  if (actualDurationSeconds !== undefined && (!Number.isInteger(actualDurationSeconds) || actualDurationSeconds < 0)) {
    throw new StudySessionRuleError("A duração estudada não pode ser negativa.", "INVALID_RESULT");
  }
  if (questions !== null && (!Number.isInteger(questions) || questions < 0)) {
    throw new StudySessionRuleError("A quantidade de questões deve ser um inteiro não negativo.", "INVALID_RESULT");
  }
  if (correctAnswers !== null && (!Number.isInteger(correctAnswers) || correctAnswers < 0)) {
    throw new StudySessionRuleError("A quantidade de acertos deve ser um inteiro não negativo.", "INVALID_RESULT");
  }
  if (questions === null && correctAnswers !== null) {
    throw new StudySessionRuleError("Informe a quantidade de questões antes dos acertos.", "INVALID_RESULT");
  }
  if (questions === 0 && correctAnswers !== null && correctAnswers !== 0) {
    throw new StudySessionRuleError("Sem questões, a quantidade de acertos deve ser zero.", "INVALID_RESULT");
  }
  if (questions !== null && correctAnswers !== null && correctAnswers > questions) {
    throw new StudySessionRuleError("A quantidade de acertos não pode superar a de questões.", "INVALID_RESULT");
  }
  if (questions !== null && questions > 0 && correctAnswers === null) {
    throw new StudySessionRuleError("Informe a quantidade de acertos.", "INVALID_RESULT");
  }
  return {
    ...result,
    questions,
    correctAnswers: questions === null ? null : (correctAnswers ?? 0),
    accuracy: calculateAccuracy(questions, questions === null ? null : (correctAnswers ?? 0)),
    notes: result.notes?.trim() || null,
  };
}

export function validateNewSession(input: CreateStudySessionInput, now: Date = new Date()) {
  if (!Number.isInteger(input.plannedDurationSeconds) || input.plannedDurationSeconds <= 0) {
    throw new StudySessionRuleError("A duração planejada deve ser maior que zero.", "INVALID_DURATION");
  }
  const plannedStartAt = input.plannedStartAt ?? now;
  const plannedEndAt = input.plannedEndAt ?? new Date(plannedStartAt.getTime() + input.plannedDurationSeconds * 1000);
  if (plannedEndAt <= plannedStartAt) {
    throw new StudySessionRuleError("O término planejado deve ser posterior ao início.", "INVALID_INTERVAL");
  }
  if (Math.floor((plannedEndAt.getTime() - plannedStartAt.getTime()) / 1000) !== input.plannedDurationSeconds) {
    throw new StudySessionRuleError("O intervalo deve corresponder à duração planejada.", "INVALID_INTERVAL");
  }
  if (input.type === "MANUAL" && input.actualDurationSeconds === undefined) {
    throw new StudySessionRuleError("Informe a duração da atividade manual.", "INVALID_DURATION");
  }
  if (input.type === "MANUAL" && !input.topicId && !input.title?.trim()) {
    throw new StudySessionRuleError("Informe a atividade estudada.", "INVALID_RELATION");
  }
  if (input.areaId && !input.objectiveId) {
    throw new StudySessionRuleError("Uma área precisa estar vinculada a um objetivo.", "INVALID_RELATION");
  }
  if (input.topicId && !input.areaId) {
    throw new StudySessionRuleError("Um tópico precisa estar vinculado a uma área.", "INVALID_RELATION");
  }
  return { ...input, plannedStartAt, plannedEndAt };
}

export function sessionsOverlap(left: Pick<StudySession, "plannedStartAt" | "plannedEndAt">, right: Pick<StudySession, "plannedStartAt" | "plannedEndAt">) {
  return left.plannedStartAt < right.plannedEndAt && right.plannedStartAt < left.plannedEndAt;
}
