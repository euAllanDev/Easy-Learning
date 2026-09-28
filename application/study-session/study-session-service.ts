import type { AvailabilityRepository } from "@/domain/availability/availability-repository";
import type { Availability } from "@/domain/availability/availability-types";
import type { StudySessionRepository } from "@/domain/study-session/study-session-repository";
import { StudySessionRuleError, sessionsOverlap, validateCompletionResult, validateNewSession } from "@/domain/study-session/study-session-rules";
import { InvalidSessionTransitionError, transitionSession } from "@/domain/study-session/study-session-state-machine";
import type { CompletionResult, CreateStudySessionInput, StudySessionAction, StudySessionPeriod } from "@/domain/study-session/study-session-types";

export class StudySessionNotFoundError extends Error {
  constructor() { super("Sessão não encontrada."); }
}

function utcTime(date: Date) {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function isInsideAvailability(start: Date, end: Date, slots: Availability[]) {
  return start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10)
    && slots.some((slot) => slot.dayOfWeek === start.getUTCDay() && slot.startTime <= utcTime(start) && slot.endTime >= utcTime(end));
}

function periodRange(period: StudySessionPeriod, now: Date) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "week") from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
  if (period === "month") from.setUTCDate(1);
  const to = new Date(from);
  if (period === "today") to.setUTCDate(to.getUTCDate() + 1);
  if (period === "week") to.setUTCDate(to.getUTCDate() + 7);
  if (period === "month") to.setUTCMonth(to.getUTCMonth() + 1);
  return { from, to };
}

export class StudySessionService {
  constructor(
    private readonly repository: StudySessionRepository,
    private readonly availabilityRepository?: AvailabilityRepository,
  ) {}

  list(userId: string) { return this.repository.findByUserId(userId); }

  async get(userId: string, id: string) {
    const session = await this.repository.findById(userId, id);
    if (!session) throw new StudySessionNotFoundError();
    return session;
  }

  async active(userId: string) { return this.repository.findActiveByUserId(userId); }

  async create(userId: string, rawInput: CreateStudySessionInput, now = new Date()) {
    const input = validateNewSession(rawInput, now);
    if (!(await this.repository.referencesBelongToUser(userId, input.objectiveId ?? null, input.areaId ?? null, input.topicId ?? null))) {
      throw new StudySessionRuleError("Objetivo, área ou tópico não pertence ao usuário.", "INVALID_RELATION");
    }
    if (input.type === "PLANNED") {
      const sessions = await this.repository.findByDateRange(userId, input.plannedStartAt, input.plannedEndAt);
      if (sessions.some((session) => ["PLANNED", "IN_PROGRESS", "PAUSED"].includes(session.status) && sessionsOverlap(input, session))) {
        throw new StudySessionRuleError("Já existe uma sessão neste horário.", "SESSION_CONFLICT");
      }
    } else {
      Object.assign(input, validateCompletionResult(input));
    }
    return this.repository.create(userId, input);
  }

  async transition(userId: string, id: string, action: Exclude<StudySessionAction, { type: "reschedule" }>) {
    const current = await this.get(userId, id);
    const next = transitionSession(current, action);
    const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, version: _version, ...changes } = next;
    const updated = await this.repository.update(userId, id, current.version, changes, action.type === "start" || action.type === "resume");
    if (!updated) throw new StudySessionRuleError("A sessão foi alterada em outro dispositivo. Atualize a página.", "CONCURRENT_CHANGE");
    return updated;
  }

  complete(userId: string, id: string, result: CompletionResult, at = new Date()) {
    return this.transition(userId, id, { type: "complete", at, result });
  }

  async reschedule(userId: string, id: string, plannedStartAt: Date, plannedEndAt: Date, at = new Date()) {
    const current = await this.get(userId, id);
    const duration = Math.floor((plannedEndAt.getTime() - plannedStartAt.getTime()) / 1000);
    if (duration <= 0 || duration !== current.plannedDurationSeconds) {
      throw new StudySessionRuleError("O reagendamento deve manter a duração e um intervalo válido.", "INVALID_INTERVAL");
    }
    if (this.availabilityRepository) {
      const slots = await this.availabilityRepository.findByUserId(userId);
      if (!isInsideAvailability(plannedStartAt, plannedEndAt, slots)) {
        throw new StudySessionRuleError("O novo horário precisa estar dentro da sua disponibilidade.", "OUTSIDE_AVAILABILITY");
      }
    }
    const sessions = await this.repository.findByDateRange(userId, plannedStartAt, plannedEndAt);
    if (sessions.some((session) => session.id !== id && ["PLANNED", "IN_PROGRESS", "PAUSED"].includes(session.status) && sessionsOverlap({ plannedStartAt, plannedEndAt }, session))) {
      throw new StudySessionRuleError("Já existe uma sessão neste horário.", "SESSION_CONFLICT");
    }
    const next = transitionSession(current, { type: "reschedule", at, plannedStartAt, plannedEndAt });
    const updated = await this.repository.update(userId, id, current.version, {
      plannedStartAt: next.plannedStartAt,
      plannedEndAt: next.plannedEndAt,
      plannedDurationSeconds: next.plannedDurationSeconds,
    });
    if (!updated) throw new StudySessionRuleError("A sessão foi alterada em outro dispositivo. Atualize a página.", "CONCURRENT_CHANGE");
    return updated;
  }

  async history(userId: string, period: StudySessionPeriod, now = new Date()) {
    const { from, to } = periodRange(period, now);
    const sessions = await this.repository.findCompletedByDateRange(userId, from, to);
    const questions = sessions.reduce((sum, session) => sum + (session.questions ?? 0), 0);
    const correctAnswers = sessions.reduce((sum, session) => sum + (session.correctAnswers ?? 0), 0);
    return {
      sessions,
      summary: {
        completedSessions: sessions.length,
        actualDurationSeconds: sessions.reduce((sum, session) => sum + (session.actualDurationSeconds ?? 0), 0),
        questions,
        correctAnswers,
        accuracy: questions ? Math.round((correctAnswers / questions) * 10_000) / 100 : null,
      },
    };
  }
}
