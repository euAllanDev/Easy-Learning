import { NextResponse } from "next/server";
import { GoalService } from "@/application/goals/goal-service";
import { requireUser } from "@/infrastructure/auth/session";
import { DrizzleGoalRepository } from "@/infrastructure/repositories/drizzle-goal-repository";
import { apiError, parseJson } from "@/lib/api/response";
import { serializeGoal } from "@/lib/api/serialize";
import { createGoalRequestSchema } from "@/lib/validation/goals";

const service = new GoalService(new DrizzleGoalRepository());

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json((await service.list(user.id)).map(serializeGoal));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createGoalRequestSchema.parse(await parseJson(request));
    return NextResponse.json(serializeGoal(await service.create(user.id, input)), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
