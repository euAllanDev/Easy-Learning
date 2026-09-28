import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GoalNotFoundError, GoalRuleError } from "@/application/goals/goal-service";
import { AvailabilityNotFoundError } from "@/application/availability/availability-services";
import { StudySessionNotFoundError } from "@/application/study-session/study-session-service";
import { AvailabilityRuleError } from "@/domain/availability/availability-rules";
import { StudySessionRuleError } from "@/domain/study-session/study-session-rules";
import { InvalidSessionTransitionError } from "@/domain/study-session/study-session-state-machine";
import { AuthenticationError, EmailAlreadyUsedError } from "@/infrastructure/auth/auth-service";

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "INVALID_REQUEST", issues: error.issues }, { status: 400 });
  }
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (error instanceof EmailAlreadyUsedError) {
    return NextResponse.json({ error: "EMAIL_ALREADY_USED" }, { status: 409 });
  }
  if (error instanceof GoalNotFoundError) {
    return NextResponse.json({ error: "GOAL_NOT_FOUND" }, { status: 404 });
  }
  if (error instanceof GoalRuleError) {
    return NextResponse.json({ error: "GOAL_RULE_VIOLATION", message: error.message }, { status: 422 });
  }
  if (error instanceof AvailabilityNotFoundError) {
    return NextResponse.json({ error: "AVAILABILITY_NOT_FOUND" }, { status: 404 });
  }
  if (error instanceof AvailabilityRuleError) {
    return NextResponse.json({ error: error.code === "OVERLAP" ? "AVAILABILITY_CONFLICT" : "AVAILABILITY_RULE_VIOLATION", message: error.message }, { status: 422 });
  }
  if (error instanceof StudySessionNotFoundError) {
    return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
  }
  if (error instanceof InvalidSessionTransitionError) {
    return NextResponse.json({ error: "INVALID_SESSION_TRANSITION", message: error.message }, { status: 409 });
  }
  if (error instanceof StudySessionRuleError) {
    const conflict = ["SESSION_CONFLICT", "ACTIVE_SESSION_EXISTS", "CONCURRENT_CHANGE"].includes(error.code);
    return NextResponse.json({ error: error.code, message: error.message }, { status: conflict ? 409 : 422 });
  }
  console.error(error);
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

export async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ZodError([{ code: "custom", path: [], message: "Malformed JSON" }]);
  }
}
