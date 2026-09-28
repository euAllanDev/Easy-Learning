export const GOAL_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export const GOAL_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;

export type GoalPriority = (typeof GOAL_PRIORITIES)[number];
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export type Goal = {
  id: string;
  userId: string;
  name: string;
  description: string;
  priority: GoalPriority;
  idealMinutesPerDay: number;
  minimumMinutesPerDay: number;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type GoalInput = Pick<Goal, "name" | "description" | "priority" | "idealMinutesPerDay" | "minimumMinutesPerDay">;

export function validateGoalTargets(input: GoalInput) {
  if (input.minimumMinutesPerDay > input.idealMinutesPerDay) {
    throw new GoalRuleError("A meta mínima deve ser menor ou igual à meta ideal.");
  }
}

export class GoalRuleError extends Error {}
