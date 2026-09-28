import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDatabase } from "@/infrastructure/database/client";
import { authSessions, studentProfiles, studyPreferences, users } from "@/infrastructure/database/schema";
import { hashPassword, verifyPassword } from "./password";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = "fluxo_session";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export type AuthenticatedUser = Pick<typeof users.$inferSelect, "id" | "email" | "name" | "createdAt" | "updatedAt">;

function publicUser(user: typeof users.$inferSelect): AuthenticatedUser {
  const { passwordHash: _passwordHash, ...result } = user;
  return result;
}

async function issueSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await getDatabase().insert(authSessions).values({ userId, tokenHash: tokenHash(token), expiresAt });
  return { token, expiresAt };
}

export async function register(input: { name: string; email: string; password: string }) {
  try {
    const user = await getDatabase().transaction(async (tx) => {
      const [created] = await tx.insert(users).values({ name: input.name, email: input.email, passwordHash: hashPassword(input.password) }).returning();
      await tx.insert(studentProfiles).values({ userId: created.id });
      await tx.insert(studyPreferences).values({ userId: created.id });
      return created;
    });
    return { user: publicUser(user), session: await issueSession(user.id) };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") throw new EmailAlreadyUsedError();
    throw error;
  }
}

export async function login(input: { email: string; password: string }) {
  const [user] = await getDatabase().select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!user || !verifyPassword(input.password, user.passwordHash)) throw new AuthenticationError();
  return { user: publicUser(user), session: await issueSession(user.id) };
}

export async function findUserBySession(token: string | undefined): Promise<AuthenticatedUser | null> {
  if (!token) return null;
  const [record] = await getDatabase()
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.tokenHash, tokenHash(token)), gt(authSessions.expiresAt, new Date())))
    .limit(1);
  return record ? publicUser(record.user) : null;
}

export async function revokeSession(token: string | undefined) {
  if (token) await getDatabase().delete(authSessions).where(eq(authSessions.tokenHash, tokenHash(token)));
}

export class AuthenticationError extends Error {}
export class EmailAlreadyUsedError extends Error {}
