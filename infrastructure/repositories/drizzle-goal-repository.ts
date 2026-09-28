import { and, asc, eq } from "drizzle-orm";
import type { Goal, GoalInput, GoalPriority, GoalStatus } from "@/domain/goals/goal";
import type { GoalRepository } from "@/domain/goals/goal-repository";
import { getDatabase } from "@/infrastructure/database/client";
import { goals } from "@/infrastructure/database/schema";

function toDomain(record: typeof goals.$inferSelect): Goal {
  return {
    ...record,
    priority: record.priority as GoalPriority,
    status: record.status as GoalStatus,
  };
}

export class DrizzleGoalRepository implements GoalRepository {
  async findAllByUser(userId: string) {
    const records = await getDatabase().select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.createdAt));
    return records.map(toDomain);
  }

  async findById(userId: string, id: string) {
    const [record] = await getDatabase().select().from(goals).where(and(eq(goals.userId, userId), eq(goals.id, id))).limit(1);
    return record ? toDomain(record) : null;
  }

  async create(userId: string, input: GoalInput) {
    const [record] = await getDatabase().insert(goals).values({ userId, ...input }).returning();
    return toDomain(record);
  }

  async update(userId: string, id: string, input: Partial<GoalInput & { status: GoalStatus }>) {
    const [record] = await getDatabase().update(goals).set({ ...input, updatedAt: new Date() }).where(and(eq(goals.userId, userId), eq(goals.id, id))).returning();
    return record ? toDomain(record) : null;
  }

  async delete(userId: string, id: string) {
    const deleted = await getDatabase().delete(goals).where(and(eq(goals.userId, userId), eq(goals.id, id))).returning({ id: goals.id });
    return deleted.length === 1;
  }
}
