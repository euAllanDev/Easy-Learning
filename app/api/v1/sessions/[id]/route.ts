import { NextResponse } from "next/server";
import { StudySessionService } from "@/application/study-session/study-session-service";
import { requireUser } from "@/infrastructure/auth/session";
import { DrizzleStudySessionRepository } from "@/infrastructure/repositories/drizzle-study-session-repository";
import { apiError } from "@/lib/api/response";
import { serializeStudySession } from "@/lib/api/serialize";

const service = new StudySessionService(new DrizzleStudySessionRepository());
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    return NextResponse.json(serializeStudySession(await service.get(user.id, id)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
