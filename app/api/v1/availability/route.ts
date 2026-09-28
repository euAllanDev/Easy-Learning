import { NextResponse } from "next/server";
import { CreateAvailability, ListAvailability } from "@/application/availability/availability-services";
import { requireUser } from "@/infrastructure/auth/session";
import { DrizzleAvailabilityRepository } from "@/infrastructure/repositories/drizzle-availability-repository";
import { apiError, parseJson } from "@/lib/api/response";
import { serializeAvailability } from "@/lib/api/serialize";
import { createAvailabilityRequestSchema } from "@/lib/validation/availability";

const repository = new DrizzleAvailabilityRepository();
const listAvailability = new ListAvailability(repository);
const createAvailability = new CreateAvailability(repository);

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json((await listAvailability.execute(user.id)).map(serializeAvailability));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createAvailabilityRequestSchema.parse(await parseJson(request));
    return NextResponse.json(serializeAvailability(await createAvailability.execute(user.id, input)), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
