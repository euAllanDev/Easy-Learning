import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudySessionRuleError } from "@/domain/study-session/study-session-rules";
import type { CreateStudySessionInput, StudySession, StudySessionStatus } from "@/domain/study-session/study-session-types";

const USER_A = "00000000-0000-4000-8000-00000000000a";
const USER_B = "00000000-0000-4000-8000-00000000000b";
const OBJECTIVE_A = "10000000-0000-4000-8000-00000000000a";

const state = vi.hoisted(() => ({ userId: "00000000-0000-4000-8000-00000000000a" as string | null, records: [] as StudySession[], nextId: 1 }));

vi.mock("@/infrastructure/auth/session", async () => {
  const { AuthenticationError } = await import("@/infrastructure/auth/auth-service");
  return { requireUser: async () => {
    if (!state.userId) throw new AuthenticationError();
    return { id: state.userId, name: "Test", email: "test@example.com" };
  } };
});

vi.mock("@/infrastructure/repositories/drizzle-availability-repository", () => ({
  DrizzleAvailabilityRepository: class {
    async findByUserId() { return [{ id: "slot", userId: USER_A, dayOfWeek: 1, startTime: "00:00", endTime: "23:59", createdAt: new Date(), updatedAt: new Date() }]; }
  },
}));

vi.mock("@/infrastructure/repositories/drizzle-study-session-repository", () => ({
  DrizzleStudySessionRepository: class {
    async findById(userId: string, id: string) { return state.records.find((record) => record.userId === userId && record.id === id) ?? null; }
    async findByUserId(userId: string) { return state.records.filter((record) => record.userId === userId); }
    async findActiveByUserId(userId: string) { return state.records.find((record) => record.userId === userId && ["IN_PROGRESS", "PAUSED"].includes(record.status)) ?? null; }
    async findByDateRange(userId: string, from: Date, to: Date) { return state.records.filter((record) => record.userId === userId && record.plannedStartAt < to && record.plannedEndAt >= from); }
    async findCompletedByDateRange(userId: string, from: Date, to: Date) { return state.records.filter((record) => record.userId === userId && record.status === "COMPLETED" && record.completedAt && record.completedAt >= from && record.completedAt < to); }
    async findByObjective(userId: string, objectiveId: string) { return state.records.filter((record) => record.userId === userId && record.objectiveId === objectiveId); }
    async findByStatus(userId: string, status: StudySessionStatus) { return state.records.filter((record) => record.userId === userId && record.status === status); }
    async referencesBelongToUser(userId: string, objectiveId: string | null) { return !objectiveId || (userId === USER_A && objectiveId === OBJECTIVE_A); }
    async create(userId: string, input: CreateStudySessionInput & { plannedStartAt: Date; plannedEndAt: Date }) {
      const now = new Date("2026-09-28T06:00:00.000Z");
      const manual = input.type === "MANUAL";
      const record: StudySession = {
        id: `session-${state.nextId++}`, userId, objectiveId: input.objectiveId ?? null, areaId: input.areaId ?? null, topicId: input.topicId ?? null,
        title: input.title ?? null, objectiveName: input.objectiveId ? "Concurso" : null, areaName: null, topicName: null, type: input.type,
        status: manual ? "COMPLETED" : "PLANNED", plannedStartAt: input.plannedStartAt, plannedEndAt: input.plannedEndAt,
        startedAt: manual ? input.plannedStartAt : null, pausedAt: null, resumedAt: null, completedAt: manual ? input.plannedEndAt : null,
        plannedDurationSeconds: input.plannedDurationSeconds, actualDurationSeconds: manual ? input.actualDurationSeconds ?? null : null,
        focusedSeconds: manual ? input.actualDurationSeconds ?? 0 : 0, pausedSeconds: 0, questions: input.questions ?? null,
        correctAnswers: input.correctAnswers ?? null, accuracy: input.questions ? Math.round(((input.correctAnswers ?? 0) / input.questions) * 10_000) / 100 : null,
        difficulty: input.difficulty ?? null, notes: input.notes ?? null, version: 1, createdAt: now, updatedAt: now,
      };
      state.records.push(record); return record;
    }
    async update(userId: string, id: string, expectedVersion: number, changes: Partial<StudySession>, requireNoOtherActive = false) {
      const record = state.records.find((candidate) => candidate.userId === userId && candidate.id === id && candidate.version === expectedVersion);
      if (!record) return null;
      if (requireNoOtherActive && state.records.some((candidate) => candidate.userId === userId && candidate.id !== id && ["IN_PROGRESS", "PAUSED"].includes(candidate.status))) {
        throw new StudySessionRuleError("Você já possui outra sessão ativa.", "ACTIVE_SESSION_EXISTS");
      }
      Object.assign(record, changes, { version: expectedVersion + 1 }); return record;
    }
  },
}));

import { GET as list, POST as create } from "@/app/api/v1/sessions/route";
import { GET as get } from "@/app/api/v1/sessions/[id]/route";
import { POST as action } from "@/app/api/v1/sessions/[id]/[action]/route";

const planned = (start = "2026-09-28T08:00:00.000Z") => ({
  objectiveId: OBJECTIVE_A, type: "PLANNED", plannedStartAt: start,
  plannedEndAt: new Date(new Date(start).getTime() + 3000_000).toISOString(), plannedDurationSeconds: 3000,
});
const request = (method: string, body?: unknown) => new Request("http://localhost/api/v1/sessions", { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const idContext = (id: string) => ({ params: Promise.resolve({ id }) });
const actionContext = (id: string, operation: string) => ({ params: Promise.resolve({ id, action: operation }) });
async function createPlanned(start?: string) { return (await create(request("POST", planned(start)))).json() as Promise<{ id: string }>; }
async function run(id: string, operation: string, body: object = {}) { return action(request("POST", body), actionContext(id, operation)); }

beforeEach(() => { state.userId = USER_A; state.records.length = 0; state.nextId = 1; });

describe("study sessions API", () => {
  it("requires authentication", async () => {
    state.userId = null;
    expect((await list()).status).toBe(401);
    expect((await create(request("POST", planned()))).status).toBe(401);
    expect((await get(request("GET"), idContext("missing"))).status).toBe(401);
    expect((await run("missing", "start")).status).toBe(401);
  });

  it("creates, lists and gets an owned session", async () => {
    const created = await createPlanned();
    expect(created.id).toBe("session-1");
    expect(await (await list()).json()).toMatchObject([{ id: "session-1", status: "PLANNED" }]);
    expect(await (await get(request("GET"), idContext(created.id))).json()).toMatchObject({ objectiveName: "Concurso" });
  });

  it("rejects client ownership and foreign relations", async () => {
    expect((await create(request("POST", { ...planned(), userId: USER_B }))).status).toBe(400);
    expect((await create(request("POST", { ...planned(), objectiveId: USER_B }))).status).toBe(422);
  });

  it("runs start, pause, resume and complete with server-calculated accuracy", async () => {
    const { id } = await createPlanned();
    expect((await run(id, "start")).status).toBe(200);
    expect((await run(id, "pause")).status).toBe(200);
    expect((await run(id, "resume")).status).toBe(200);
    const response = await run(id, "complete", { actualDurationSeconds: 2520, questions: 18, correctAnswers: 12, difficulty: "HARD" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "COMPLETED", actualDurationSeconds: 2520, accuracy: 66.67 });
  });

  it("supports skip, cancel and in-place reschedule", async () => {
    const skipped = await createPlanned();
    expect(await (await run(skipped.id, "skip", { notes: "Sem tempo" })).json()).toMatchObject({ status: "SKIPPED", notes: "Sem tempo" });
    const cancelled = await createPlanned("2026-09-28T10:00:00.000Z");
    expect(await (await run(cancelled.id, "cancel")).json()).toMatchObject({ status: "CANCELLED" });
    const rescheduled = await createPlanned("2026-09-28T12:00:00.000Z");
    const response = await run(rescheduled.id, "reschedule", { plannedStartAt: "2026-09-28T14:00:00.000Z", plannedEndAt: "2026-09-28T14:50:00.000Z" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: rescheduled.id, status: "PLANNED", plannedStartAt: "2026-09-28T14:00:00.000Z" });
  });

  it("creates a completed manual activity", async () => {
    const response = await create(request("POST", { type: "MANUAL", title: "Alemão", plannedDurationSeconds: 2520, actualDurationSeconds: 2520, questions: 20, correctAnswers: 17 }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ type: "MANUAL", status: "COMPLETED", title: "Alemão", accuracy: 85 });
  });

  it("rejects missing sessions, cross-user reads and invalid transitions", async () => {
    const { id } = await createPlanned();
    state.userId = USER_B;
    expect((await get(request("GET"), idContext(id))).status).toBe(404);
    expect((await run(id, "start")).status).toBe(404);
    state.userId = USER_A;
    expect((await run(id, "pause")).status).toBe(409);
    expect((await get(request("GET"), idContext("missing"))).status).toBe(404);
  });

  it("allows only one active session under concurrent starts", async () => {
    const first = await createPlanned();
    const second = await createPlanned("2026-09-28T10:00:00.000Z");
    const responses = await Promise.all([run(first.id, "start"), run(second.id, "start")]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(state.records.filter((record) => ["IN_PROGRESS", "PAUSED"].includes(record.status))).toHaveLength(1);
  });

  it("makes a double start idempotent with one transition and one conflict", async () => {
    const { id } = await createPlanned();
    const responses = await Promise.all([run(id, "start"), run(id, "start")]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(state.records.filter((record) => record.status === "IN_PROGRESS")).toHaveLength(1);
  });
});
