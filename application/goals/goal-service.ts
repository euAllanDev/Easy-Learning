import { GoalRuleError, validateGoalTargets, type GoalInput, type GoalStatus } from "@/domain/goals/goal";
import type { GoalRepository } from "@/domain/goals/goal-repository";

export class GoalService {
  constructor(private readonly goals: GoalRepository) {}

  list(userId: string) {
    return this.goals.findAllByUser(userId);
  }

  create(userId: string, input: GoalInput) {
    validateGoalTargets(input);
    return this.goals.create(userId, input);
  }

  async update(userId: string, id: string, changes: Partial<GoalInput & { status: GoalStatus }>) {
    const current = await this.goals.findById(userId, id);
    if (!current) throw new GoalNotFoundError();
    const candidate = { ...current, ...changes };
    validateGoalTargets(candidate);
    return this.goals.update(userId, id, changes);
  }

  async remove(userId: string, id: string) {
    if (!(await this.goals.delete(userId, id))) throw new GoalNotFoundError();
  }
}

export class GoalNotFoundError extends Error {
  constructor() {
    super("Objetivo não encontrado.");
  }
}

export { GoalRuleError };
