import { NextResponse } from "next/server";
import { DeleteAvailability, UpdateAvailability } from "@/application/availability/availability-services";
import { requireUser } from "@/infrastructure/auth/session";
import { DrizzleAvailabilityRepository } from "@/infrastructure/repositories/drizzle-availability-repository";
import { apiError, parseJson } from "@/lib/api/response";
import { serializeAvailability } from "@/lib/api/serialize";
import { updateAvailabilityRequestSchema } from "@/lib/validation/availability";

const repository = new DrizzleAvailabilityRepository();
const updateAvailability = new UpdateAvailability(repository);
const deleteAvailability = new DeleteAvailability(repository);
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = updateAvailabilityRequestSchema.parse(await parseJson(request));
    return NextResponse.json(serializeAvailability(await updateAvailability.execute(user.id, id, input)));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteAvailability.execute(user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
