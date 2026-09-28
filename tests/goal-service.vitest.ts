import { describe, expect, it } from "vitest";
import { GoalNotFoundError, GoalService } from "@/application/goals/goal-service";
import type { Goal, GoalInput, GoalStatus } from "@/domain/goals/goal";
import type { GoalRepository } from "@/domain/goals/goal-repository";

class MemoryGoalRepository implements GoalRepository {
  records: Goal[] = [];

  async findAllByUser(userId: string) { return this.records.filter((goal) => goal.userId === userId); }
  async findById(userId: string, id: string) { return this.records.find((goal) => goal.userId === userId && goal.id === id) ?? null; }
  async create(userId: string, input: GoalInput) {
    const now = new Date();
    const goal: Goal = { id: String(this.records.length + 1), userId, status: "ACTIVE", createdAt: now, updatedAt: now, ...input };
    this.records.push(goal);
    return goal;
  }
  async update(userId: string, id: string, changes: Partial<GoalInput & { status: GoalStatus }>) {
    const goal = await this.findById(userId, id);
    if (!goal) return null;
    Object.assign(goal, changes, { updatedAt: new Date() });
    return goal;
  }
  async delete(userId: string, id: string) {
    const index = this.records.findIndex((goal) => goal.userId === userId && goal.id === id);
    if (index < 0) return false;
    this.records.splice(index, 1);
    return true;
  }
}

const input: GoalInput = { name: "Concurso", description: "", priority: "HIGH", minimumMinutesPerDay: 45, idealMinutesPerDay: 120 };

describe("GoalService", () => {
  it("rejects a minimum target greater than the ideal target", async () => {
    const service = new GoalService(new MemoryGoalRepository());
    expect(() => service.create("user-a", { ...input, minimumMinutesPerDay: 121 })).toThrow("meta mínima");
  });

  it("never returns another user's goals", async () => {
    const repository = new MemoryGoalRepository();
    const service = new GoalService(repository);
    await service.create("user-a", input);
    await service.create("user-b", { ...input, name: "Inglês" });
    await expect(service.list("user-a")).resolves.toMatchObject([{ name: "Concurso", userId: "user-a" }]);
  });

  it("does not update or delete an id owned by another user", async () => {
    const repository = new MemoryGoalRepository();
    const service = new GoalService(repository);
    const goal = await service.create("user-a", input);
    await expect(service.update("user-b", goal.id, { name: "Invadido" })).rejects.toBeInstanceOf(GoalNotFoundError);
    await expect(service.remove("user-b", goal.id)).rejects.toBeInstanceOf(GoalNotFoundError);
    expect(repository.records[0].name).toBe("Concurso");
  });
});
