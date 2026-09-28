import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revokeSession, SESSION_COOKIE } from "@/infrastructure/auth/auth-service";
import { apiError } from "@/lib/api/response";
import { clearSessionCookie } from "@/lib/api/session-cookie";

export async function POST() {
  try {
    await revokeSession((await cookies()).get(SESSION_COOKIE)?.value);
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
