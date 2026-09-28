import type { CreateStudySessionInput, StudySession, StudySessionStatus } from "./study-session-types";

export type StudySessionChanges = Partial<Omit<StudySession, "id" | "userId" | "createdAt" | "updatedAt" | "version">>;

export interface StudySessionRepository {
  findById(userId: string, id: string): Promise<StudySession | null>;
  findByUserId(userId: string): Promise<StudySession[]>;
  findActiveByUserId(userId: string): Promise<StudySession | null>;
  findByDateRange(userId: string, from: Date, to: Date): Promise<StudySession[]>;
  findCompletedByDateRange(userId: string, from: Date, to: Date): Promise<StudySession[]>;
  findByObjective(userId: string, objectiveId: string): Promise<StudySession[]>;
  findByStatus(userId: string, status: StudySessionStatus): Promise<StudySession[]>;
  referencesBelongToUser(userId: string, objectiveId: string | null, areaId: string | null, topicId: string | null): Promise<boolean>;
  create(userId: string, input: CreateStudySessionInput & { plannedStartAt: Date; plannedEndAt: Date }): Promise<StudySession>;
  update(userId: string, id: string, expectedVersion: number, changes: StudySessionChanges, requireNoOtherActive?: boolean): Promise<StudySession | null>;
}
