import { NextResponse } from "next/server";
import { GoalService } from "@/application/goals/goal-service";
import { requireUser } from "@/infrastructure/auth/session";
import { DrizzleGoalRepository } from "@/infrastructure/repositories/drizzle-goal-repository";
import { apiError, parseJson } from "@/lib/api/response";
import { serializeGoal } from "@/lib/api/serialize";
import { updateGoalRequestSchema } from "@/lib/validation/goals";

const service = new GoalService(new DrizzleGoalRepository());
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = updateGoalRequestSchema.parse(await parseJson(request));
    return NextResponse.json(serializeGoal((await service.update(user.id, id, input))!));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await service.remove(user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
