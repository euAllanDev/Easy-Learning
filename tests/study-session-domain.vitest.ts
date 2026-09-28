import { describe, expect, it } from "vitest";
import { calculateFocusedSeconds } from "@/domain/study-session/study-session-duration";
import { calculateAccuracy, validateCompletionResult } from "@/domain/study-session/study-session-rules";
import { InvalidSessionTransitionError, transitionSession } from "@/domain/study-session/study-session-state-machine";
import type { StudySession, StudySessionAction, StudySessionStatus } from "@/domain/study-session/study-session-types";

const at = (time: string) => new Date(`2026-09-28T${time}:00.000Z`);
const session = (status: StudySessionStatus = "PLANNED"): StudySession => ({
  id: "session-1",
  userId: "user-1",
  objectiveId: "objective-1",
  areaId: null,
  topicId: null,
  title: null,
  objectiveName: "Concurso",
  areaName: null,
  topicName: null,
  type: "PLANNED",
  status,
  plannedStartAt: at("08:00"),
  plannedEndAt: at("08:50"),
  startedAt: null,
  pausedAt: null,
  resumedAt: null,
  completedAt: null,
  plannedDurationSeconds: 3000,
  actualDurationSeconds: null,
  focusedSeconds: 0,
  pausedSeconds: 0,
  questions: null,
  correctAnswers: null,
  accuracy: null,
  difficulty: null,
  notes: null,
  version: 1,
  createdAt: at("07:00"),
  updatedAt: at("07:00"),
});

describe("study session state machine", () => {
  it("supports every valid lifecycle transition", () => {
    const planned = session();
    const running = transitionSession(planned, { type: "start", at: at("08:00") });
    expect(running.status).toBe("IN_PROGRESS");
    const paused = transitionSession(running, { type: "pause", at: at("08:20") });
    expect(paused.status).toBe("PAUSED");
    expect(transitionSession(paused, { type: "resume", at: at("08:25") }).status).toBe("IN_PROGRESS");
    expect(transitionSession(running, { type: "complete", at: at("08:50") }).status).toBe("COMPLETED");
    expect(transitionSession(paused, { type: "complete", at: at("08:50") }).status).toBe("COMPLETED");
    expect(transitionSession(planned, { type: "skip", at: at("08:00") }).status).toBe("SKIPPED");
    expect(transitionSession(planned, { type: "cancel", at: at("08:00") }).status).toBe("CANCELLED");
    expect(transitionSession(running, { type: "cancel", at: at("08:10") }).status).toBe("CANCELLED");
    expect(transitionSession(paused, { type: "cancel", at: at("08:30") }).status).toBe("CANCELLED");
  });

  it("rejects every action not declared for the current state", () => {
    const actions: StudySessionAction[] = [
      { type: "start", at: at("09:00") },
      { type: "pause", at: at("09:00") },
      { type: "resume", at: at("09:00") },
      { type: "complete", at: at("09:00") },
      { type: "cancel", at: at("09:00") },
      { type: "skip", at: at("09:00") },
      { type: "reschedule", at: at("09:00"), plannedStartAt: at("10:00"), plannedEndAt: at("10:50") },
    ];
    const allowed: Record<StudySessionStatus, string[]> = {
      PLANNED: ["start", "skip", "cancel", "reschedule"],
      IN_PROGRESS: ["pause", "complete", "cancel"],
      PAUSED: ["resume", "complete", "cancel"],
      COMPLETED: [], SKIPPED: [], CANCELLED: [],
    };
    for (const status of Object.keys(allowed) as StudySessionStatus[]) {
      for (const action of actions.filter((candidate) => !allowed[status].includes(candidate.type))) {
        expect(() => transitionSession(session(status), action)).toThrow(InvalidSessionTransitionError);
      }
    }
  });
});

describe("study session duration", () => {
  function start() { return transitionSession(session(), { type: "start", at: at("08:00") }); }

  it("counts a session without pauses exactly", () => {
    const completed = transitionSession(start(), { type: "complete", at: at("08:50") });
    expect(completed.actualDurationSeconds).toBe(3000);
  });

  it("excludes one pause exactly", () => {
    const paused = transitionSession(start(), { type: "pause", at: at("08:20") });
    const resumed = transitionSession(paused, { type: "resume", at: at("08:35") });
    const completed = transitionSession(resumed, { type: "complete", at: at("09:00") });
    expect(completed.actualDurationSeconds).toBe(2700);
    expect(completed.pausedSeconds).toBe(900);
  });

  it("excludes two pauses exactly", () => {
    let current = start();
    current = transitionSession(current, { type: "pause", at: at("08:10") });
    current = transitionSession(current, { type: "resume", at: at("08:15") });
    current = transitionSession(current, { type: "pause", at: at("08:30") });
    current = transitionSession(current, { type: "resume", at: at("08:40") });
    current = transitionSession(current, { type: "complete", at: at("09:00") });
    expect(current.actualDurationSeconds).toBe(2700);
    expect(current.pausedSeconds).toBe(900);
  });

  it("keeps accumulating through multiple pauses and derives running time from timestamps", () => {
    let current = start();
    for (const [pauseAt, resumeAt] of [["08:05", "08:07"], ["08:12", "08:15"], ["08:20", "08:24"]]) {
      current = transitionSession(current, { type: "pause", at: at(pauseAt) });
      current = transitionSession(current, { type: "resume", at: at(resumeAt) });
    }
    expect(calculateFocusedSeconds(current, at("08:30"))).toBe(1260);
    expect(current.pausedSeconds).toBe(540);
  });
});

describe("study session results", () => {
  it("calculates server-side accuracy to two decimals", () => {
    expect(calculateAccuracy(18, 12)).toBe(66.67);
    expect(calculateAccuracy(0, 0)).toBeNull();
  });

  it("rejects negative values and more correct answers than questions", () => {
    expect(() => validateCompletionResult({ actualDurationSeconds: -1 })).toThrow();
    expect(() => validateCompletionResult({ questions: -1 })).toThrow();
    expect(() => validateCompletionResult({ questions: 10, correctAnswers: 11 })).toThrow();
  });
});
