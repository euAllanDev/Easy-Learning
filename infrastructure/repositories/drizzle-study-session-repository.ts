import { and, asc, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import type { StudySessionChanges, StudySessionRepository } from "@/domain/study-session/study-session-repository";
import { StudySessionRuleError } from "@/domain/study-session/study-session-rules";
import type { CreateStudySessionInput, StudySession, StudySessionDifficulty, StudySessionStatus } from "@/domain/study-session/study-session-types";
import { getDatabase } from "@/infrastructure/database/client";
import { goalAreas, goals, studySessions, topics } from "@/infrastructure/database/schema";

type RecordWithNames = {
  session: typeof studySessions.$inferSelect;
  objectiveName: string | null;
  areaName: string | null;
  topicName: string | null;
};

function toDomain(record: RecordWithNames): StudySession {
  const { session } = record;
  return {
    id: session.id,
    userId: session.userId,
    objectiveId: session.goalId,
    areaId: session.areaId,
    topicId: session.topicId,
    title: session.title,
    objectiveName: record.objectiveName,
    areaName: record.areaName,
    topicName: record.topicName,
    type: session.source === "MANUAL" ? "MANUAL" : "PLANNED",
    status: session.status as StudySessionStatus,
    plannedStartAt: session.plannedStart,
    plannedEndAt: session.plannedEnd,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    resumedAt: session.resumedAt,
    completedAt: session.endedAt,
    plannedDurationSeconds: session.plannedDuration,
    actualDurationSeconds: session.actualDuration,
    focusedSeconds: session.focusedSeconds,
    pausedSeconds: session.pausedSeconds,
    questions: session.questions,
    correctAnswers: session.correctAnswers,
    accuracy: session.accuracy,
    difficulty: session.difficulty as StudySessionDifficulty | null,
    notes: session.note,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function selection() {
  return { session: studySessions, objectiveName: goals.name, areaName: goalAreas.name, topicName: topics.name };
}

function withNames<T extends { from: (table: typeof studySessions) => unknown }>(_query: T) {
  return _query;
}

function toDatabaseChanges(changes: StudySessionChanges) {
  return {
    goalId: changes.objectiveId,
    areaId: changes.areaId,
    topicId: changes.topicId,
    title: changes.title,
    source: changes.type === undefined ? undefined : changes.type === "MANUAL" ? "MANUAL" : "ROUTINE",
    status: changes.status,
    plannedStart: changes.plannedStartAt,
    plannedEnd: changes.plannedEndAt,
    startedAt: changes.startedAt,
    pausedAt: changes.pausedAt,
    resumedAt: changes.resumedAt,
    endedAt: changes.completedAt,
    plannedDuration: changes.plannedDurationSeconds,
    actualDuration: changes.actualDurationSeconds,
    focusedSeconds: changes.focusedSeconds,
    pausedSeconds: changes.pausedSeconds,
    questions: changes.questions,
    correctAnswers: changes.correctAnswers,
    accuracy: changes.accuracy,
    difficulty: changes.difficulty,
    note: changes.notes,
  };
}

export class DrizzleStudySessionRepository implements StudySessionRepository {
  private query() {
    return getDatabase().select(selection()).from(studySessions)
      .leftJoin(goals, eq(studySessions.goalId, goals.id))
      .leftJoin(goalAreas, eq(studySessions.areaId, goalAreas.id))
      .leftJoin(topics, eq(studySessions.topicId, topics.id));
  }

  async findById(userId: string, id: string) {
    const [record] = await this.query().where(and(eq(studySessions.userId, userId), eq(studySessions.id, id))).limit(1);
    return record ? toDomain(record) : null;
  }

  async findByUserId(userId: string) {
    const records = await this.query().where(eq(studySessions.userId, userId)).orderBy(asc(studySessions.plannedStart));
    return records.map(toDomain);
  }

  async findActiveByUserId(userId: string) {
    const [record] = await this.query().where(and(eq(studySessions.userId, userId), inArray(studySessions.status, ["IN_PROGRESS", "PAUSED"]))).limit(1);
    return record ? toDomain(record) : null;
  }

  async findByDateRange(userId: string, from: Date, to: Date) {
    const records = await this.query().where(and(eq(studySessions.userId, userId), lt(studySessions.plannedStart, to), gte(studySessions.plannedEnd, from))).orderBy(asc(studySessions.plannedStart));
    return records.map(toDomain);
  }

  async findCompletedByDateRange(userId: string, from: Date, to: Date) {
    const records = await this.query().where(and(
      eq(studySessions.userId, userId),
      eq(studySessions.status, "COMPLETED"),
      gte(studySessions.endedAt, from),
      lt(studySessions.endedAt, to),
    )).orderBy(asc(studySessions.endedAt));
    return records.map(toDomain);
  }

  async findByObjective(userId: string, objectiveId: string) {
    const records = await this.query().where(and(eq(studySessions.userId, userId), eq(studySessions.goalId, objectiveId))).orderBy(asc(studySessions.plannedStart));
    return records.map(toDomain);
  }

  async findByStatus(userId: string, status: StudySessionStatus) {
    const records = await this.query().where(and(eq(studySessions.userId, userId), eq(studySessions.status, status))).orderBy(asc(studySessions.plannedStart));
    return records.map(toDomain);
  }

  async referencesBelongToUser(userId: string, objectiveId: string | null, areaId: string | null, topicId: string | null) {
    if (objectiveId) {
      const [objective] = await getDatabase().select({ id: goals.id }).from(goals).where(and(eq(goals.id, objectiveId), eq(goals.userId, userId))).limit(1);
      if (!objective) return false;
    }
    if (areaId) {
      const [area] = await getDatabase().select({ id: goalAreas.id }).from(goalAreas).where(and(eq(goalAreas.id, areaId), eq(goalAreas.userId, userId), objectiveId ? eq(goalAreas.goalId, objectiveId) : sql`false`)).limit(1);
      if (!area) return false;
    }
    if (topicId) {
      const [topic] = await getDatabase().select({ id: topics.id }).from(topics).where(and(eq(topics.id, topicId), eq(topics.userId, userId), areaId ? eq(topics.areaId, areaId) : sql`false`)).limit(1);
      if (!topic) return false;
    }
    return true;
  }

  async create(userId: string, input: CreateStudySessionInput & { plannedStartAt: Date; plannedEndAt: Date }) {
    const isManual = input.type === "MANUAL";
    const [created] = await getDatabase().insert(studySessions).values({
      userId,
      goalId: input.objectiveId,
      areaId: input.areaId,
      topicId: input.topicId,
      title: input.title?.trim() || null,
      source: isManual ? "MANUAL" : "ROUTINE",
      status: isManual ? "COMPLETED" : "PLANNED",
      plannedStart: input.plannedStartAt,
      plannedEnd: input.plannedEndAt,
      plannedDuration: input.plannedDurationSeconds,
      actualDuration: isManual ? input.actualDurationSeconds : null,
      focusedSeconds: isManual ? (input.actualDurationSeconds ?? 0) : 0,
      startedAt: isManual ? input.plannedStartAt : null,
      endedAt: isManual ? input.plannedEndAt : null,
      questions: input.questions,
      correctAnswers: input.correctAnswers,
      accuracy: isManual && input.questions ? Math.round(((input.correctAnswers ?? 0) / input.questions) * 10_000) / 100 : null,
      difficulty: input.difficulty,
      note: input.notes?.trim() || null,
    }).returning();
    return toDomain({ session: created, objectiveName: null, areaName: null, topicName: null });
  }

  async update(userId: string, id: string, expectedVersion: number, changes: StudySessionChanges, requireNoOtherActive = false) {
    return getDatabase().transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      if (requireNoOtherActive) {
        const [active] = await transaction.select({ id: studySessions.id }).from(studySessions).where(and(
          eq(studySessions.userId, userId), ne(studySessions.id, id), inArray(studySessions.status, ["IN_PROGRESS", "PAUSED"]),
        )).limit(1);
        if (active) throw new StudySessionRuleError("Você já possui outra sessão ativa.", "ACTIVE_SESSION_EXISTS");
      }
      const [record] = await transaction.update(studySessions).set({
        ...toDatabaseChanges(changes), version: expectedVersion + 1, updatedAt: new Date(),
      }).where(and(eq(studySessions.userId, userId), eq(studySessions.id, id), eq(studySessions.version, expectedVersion))).returning();
      if (!record) return null;
      const [names] = await transaction.select({ objectiveName: goals.name, areaName: goalAreas.name, topicName: topics.name }).from(studySessions)
        .leftJoin(goals, eq(studySessions.goalId, goals.id)).leftJoin(goalAreas, eq(studySessions.areaId, goalAreas.id)).leftJoin(topics, eq(studySessions.topicId, topics.id))
        .where(eq(studySessions.id, id)).limit(1);
      return toDomain({ session: record, ...names });
    });
  }
}
