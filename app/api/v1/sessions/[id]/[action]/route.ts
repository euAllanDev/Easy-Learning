import { NextResponse } from "next/server";
import { StudySessionService } from "@/application/study-session/study-session-service";
import { StudySessionRuleError } from "@/domain/study-session/study-session-rules";
import { requireUser } from "@/infrastructure/auth/session";
import { DrizzleAvailabilityRepository } from "@/infrastructure/repositories/drizzle-availability-repository";
import { DrizzleStudySessionRepository } from "@/infrastructure/repositories/drizzle-study-session-repository";
import { apiError, parseJson } from "@/lib/api/response";
import { serializeStudySession } from "@/lib/api/serialize";
import { completeStudySessionRequestSchema, rescheduleStudySessionRequestSchema, skipStudySessionRequestSchema } from "@/lib/validation/study-session";

const service = new StudySessionService(new DrizzleStudySessionRepository(), new DrizzleAvailabilityRepository());
type Context = { params: Promise<{ id: string; action: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id, action } = await context.params;
    const at = new Date();
    if (action === "complete") {
      const input = completeStudySessionRequestSchema.parse(await parseJson(request));
      return NextResponse.json(serializeStudySession(await service.complete(user.id, id, input, at)));
    }
    if (action === "skip") {
      const input = skipStudySessionRequestSchema.parse(await parseJson(request));
      return NextResponse.json(serializeStudySession(await service.transition(user.id, id, { type: "skip", at, notes: input.notes })));
    }
    if (action === "reschedule") {
      const input = rescheduleStudySessionRequestSchema.parse(await parseJson(request));
      return NextResponse.json(serializeStudySession(await service.reschedule(user.id, id, input.plannedStartAt, input.plannedEndAt, at)));
    }
    if (["start", "pause", "resume", "cancel"].includes(action)) {
      return NextResponse.json(serializeStudySession(await service.transition(user.id, id, { type: action as "start" | "pause" | "resume" | "cancel", at })));
    }
    throw new StudySessionRuleError("Ação de sessão desconhecida.", "INVALID_RESULT");
  } catch (error) {
    return apiError(error);
  }
}
