import { describe, expect, it } from "vitest";
import { CreateAvailability, DeleteAvailability, ListAvailability, UpdateAvailability, AvailabilityNotFoundError } from "@/application/availability/availability-services";
import type { AvailabilityRepository } from "@/domain/availability/availability-repository";
import type { Availability, AvailabilityInput } from "@/domain/availability/availability-types";

class MemoryAvailabilityRepository implements AvailabilityRepository {
  records: Availability[] = [];

  async findByUserId(userId: string) { return this.records.filter((slot) => slot.userId === userId); }
  async findById(userId: string, id: string) { return this.records.find((slot) => slot.userId === userId && slot.id === id) ?? null; }
  async create(userId: string, input: AvailabilityInput) {
    const now = new Date();
    const record: Availability = { id: String(this.records.length + 1), userId, createdAt: now, updatedAt: now, ...input };
    this.records.push(record);
    return record;
  }
  async update(userId: string, id: string, input: AvailabilityInput) {
    const record = await this.findById(userId, id);
    if (!record) return null;
    Object.assign(record, input, { updatedAt: new Date() });
    return record;
  }
  async delete(userId: string, id: string) {
    const index = this.records.findIndex((slot) => slot.userId === userId && slot.id === id);
    if (index < 0) return false;
    this.records.splice(index, 1);
    return true;
  }
}

const monday: AvailabilityInput = { dayOfWeek: 1, startTime: "07:00", endTime: "10:00" };

describe("availability services", () => {
  it("creates, sorts, updates and deletes the owner's availability", async () => {
    const repository = new MemoryAvailabilityRepository();
    const create = new CreateAvailability(repository);
    const later = await create.execute("user-a", { ...monday, startTime: "14:00", endTime: "16:00" });
    const earlier = await create.execute("user-a", monday);
    await expect(new ListAvailability(repository).execute("user-a")).resolves.toMatchObject([{ id: earlier.id }, { id: later.id }]);
    await expect(new UpdateAvailability(repository).execute("user-a", earlier.id, { endTime: "09:00" })).resolves.toMatchObject({ endTime: "09:00" });
    await new DeleteAvailability(repository).execute("user-a", later.id);
    await expect(new ListAvailability(repository).execute("user-a")).resolves.toHaveLength(1);
  });

  it("rejects an overlap", async () => {
    const repository = new MemoryAvailabilityRepository();
    const create = new CreateAvailability(repository);
    await create.execute("user-a", monday);
    await expect(create.execute("user-a", { ...monday, startTime: "09:00", endTime: "11:00" })).rejects.toMatchObject({ code: "OVERLAP" });
  });

  it("isolates listing, update and delete by authenticated user", async () => {
    const repository = new MemoryAvailabilityRepository();
    const owned = await new CreateAvailability(repository).execute("user-a", monday);
    await new CreateAvailability(repository).execute("user-b", { ...monday, startTime: "14:00", endTime: "16:00" });
    await expect(new ListAvailability(repository).execute("user-a")).resolves.toMatchObject([{ userId: "user-a", startTime: "07:00" }]);
    await expect(new UpdateAvailability(repository).execute("user-b", owned.id, { endTime: "09:00" })).rejects.toBeInstanceOf(AvailabilityNotFoundError);
    await expect(new DeleteAvailability(repository).execute("user-b", owned.id)).rejects.toBeInstanceOf(AvailabilityNotFoundError);
  });
});
