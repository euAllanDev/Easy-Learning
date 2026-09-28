import type { Goal, GoalInput, GoalStatus } from "./goal";

export interface GoalRepository {
  findAllByUser(userId: string): Promise<Goal[]>;
  findById(userId: string, id: string): Promise<Goal | null>;
  create(userId: string, input: GoalInput): Promise<Goal>;
  update(userId: string, id: string, input: Partial<GoalInput & { status: GoalStatus }>): Promise<Goal | null>;
  delete(userId: string, id: string): Promise<boolean>;
}
