import { NextResponse } from "next/server";
import { StudySessionService } from "@/application/study-session/study-session-service";
import { requireUser } from "@/infrastructure/auth/session";
import { DrizzleAvailabilityRepository } from "@/infrastructure/repositories/drizzle-availability-repository";
import { DrizzleStudySessionRepository } from "@/infrastructure/repositories/drizzle-study-session-repository";
import { apiError, parseJson } from "@/lib/api/response";
import { serializeStudySession } from "@/lib/api/serialize";
import { createStudySessionRequestSchema } from "@/lib/validation/study-session";

const service = new StudySessionService(new DrizzleStudySessionRepository(), new DrizzleAvailabilityRepository());
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json((await service.list(user.id)).map(serializeStudySession), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createStudySessionRequestSchema.parse(await parseJson(request));
    return NextResponse.json(serializeStudySession(await service.create(user.id, input)), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
