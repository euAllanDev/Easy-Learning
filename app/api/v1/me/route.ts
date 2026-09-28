import { NextResponse } from "next/server";
import { requireUser } from "@/infrastructure/auth/session";
import { apiError } from "@/lib/api/response";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() });
  } catch (error) {
    return apiError(error);
  }
}
