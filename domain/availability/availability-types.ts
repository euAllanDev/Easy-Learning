export const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DAY_NAMES: Record<DayOfWeek, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};

export type AvailabilityInput = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
};

export type Availability = AvailabilityInput & {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AvailableSlot = Pick<Availability, "dayOfWeek" | "startTime" | "endTime">;
