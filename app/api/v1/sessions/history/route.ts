import { NextResponse } from "next/server";
import { z } from "zod";
import { StudySessionService } from "@/application/study-session/study-session-service";
import { requireUser } from "@/infrastructure/auth/session";
import { DrizzleStudySessionRepository } from "@/infrastructure/repositories/drizzle-study-session-repository";
import { apiError } from "@/lib/api/response";
import { serializeStudySession } from "@/lib/api/serialize";

const service = new StudySessionService(new DrizzleStudySessionRepository());
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const period = z.enum(["today", "week", "month"]).parse(new URL(request.url).searchParams.get("period") ?? "week");
    const history = await service.history(user.id, period);
    return NextResponse.json({ ...history, sessions: history.sessions.map(serializeStudySession) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
