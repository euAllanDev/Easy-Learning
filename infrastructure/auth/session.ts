import { cookies } from "next/headers";
import { AuthenticationError, findUserBySession, SESSION_COOKIE } from "./auth-service";

export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return findUserBySession(token);
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AuthenticationError();
  return user;
}
