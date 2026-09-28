import { and, asc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { AvailabilityRuleError } from "@/domain/availability/availability-rules";
import type { AvailabilityRepository } from "@/domain/availability/availability-repository";
import { DAY_NAMES, type Availability, type AvailabilityInput, type DayOfWeek } from "@/domain/availability/availability-types";
import { getDatabase } from "@/infrastructure/database/client";
import { availabilities, availabilitySlots } from "@/infrastructure/database/schema";

function toDomain(record: typeof availabilitySlots.$inferSelect): Availability {
  return { ...record, dayOfWeek: record.dayOfWeek as DayOfWeek };
}

export class DrizzleAvailabilityRepository implements AvailabilityRepository {
  async findByUserId(userId: string) {
    const records = await getDatabase().select().from(availabilitySlots)
      .where(eq(availabilitySlots.userId, userId))
      .orderBy(asc(availabilitySlots.dayOfWeek), asc(availabilitySlots.startTime), asc(availabilitySlots.endTime));
    return records.map(toDomain);
  }

  async findById(userId: string, id: string) {
    const [record] = await getDatabase().select().from(availabilitySlots)
      .where(and(eq(availabilitySlots.userId, userId), eq(availabilitySlots.id, id))).limit(1);
    return record ? toDomain(record) : null;
  }

  async create(userId: string, input: AvailabilityInput) {
    return getDatabase().transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      const [conflict] = await transaction.select({ id: availabilitySlots.id }).from(availabilitySlots).where(and(
        eq(availabilitySlots.userId, userId),
        eq(availabilitySlots.dayOfWeek, input.dayOfWeek),
        lt(availabilitySlots.startTime, input.endTime),
        gt(availabilitySlots.endTime, input.startTime),
      )).limit(1);
      if (conflict) throw new AvailabilityRuleError(`Este horário entra em conflito com outro período de ${DAY_NAMES[input.dayOfWeek].toLowerCase()}.`, "OVERLAP");
      let [schedule] = await transaction.select({ id: availabilities.id }).from(availabilities)
        .where(eq(availabilities.userId, userId)).limit(1);
      if (!schedule) {
        [schedule] = await transaction.insert(availabilities).values({ userId }).returning({ id: availabilities.id });
      }
      const [record] = await transaction.insert(availabilitySlots).values({ userId, availabilityId: schedule.id, ...input }).returning();
      return toDomain(record);
    });
  }

  async update(userId: string, id: string, input: AvailabilityInput) {
    return getDatabase().transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      const [conflict] = await transaction.select({ id: availabilitySlots.id }).from(availabilitySlots).where(and(
        eq(availabilitySlots.userId, userId),
        ne(availabilitySlots.id, id),
        eq(availabilitySlots.dayOfWeek, input.dayOfWeek),
        lt(availabilitySlots.startTime, input.endTime),
        gt(availabilitySlots.endTime, input.startTime),
      )).limit(1);
      if (conflict) throw new AvailabilityRuleError(`Este horário entra em conflito com outro período de ${DAY_NAMES[input.dayOfWeek].toLowerCase()}.`, "OVERLAP");
      const [record] = await transaction.update(availabilitySlots).set({ ...input, updatedAt: new Date() })
        .where(and(eq(availabilitySlots.userId, userId), eq(availabilitySlots.id, id))).returning();
      return record ? toDomain(record) : null;
    });
  }

  async delete(userId: string, id: string) {
    const records = await getDatabase().delete(availabilitySlots)
      .where(and(eq(availabilitySlots.userId, userId), eq(availabilitySlots.id, id))).returning({ id: availabilitySlots.id });
    return records.length === 1;
  }
}
