import { NextResponse } from "next/server";
import { login } from "@/infrastructure/auth/auth-service";
import { apiError, parseJson } from "@/lib/api/response";
import { setSessionCookie } from "@/lib/api/session-cookie";
import { loginRequestSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const input = loginRequestSchema.parse(await parseJson(request));
    const { user, session } = await login(input);
    const response = NextResponse.json({ ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
