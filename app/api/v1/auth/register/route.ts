import { NextResponse } from "next/server";
import { register } from "@/infrastructure/auth/auth-service";
import { apiError, parseJson } from "@/lib/api/response";
import { setSessionCookie } from "@/lib/api/session-cookie";
import { registerRequestSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const input = registerRequestSchema.parse(await parseJson(request));
    const { user, session } = await register(input);
    const response = NextResponse.json({ ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() }, { status: 201 });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
