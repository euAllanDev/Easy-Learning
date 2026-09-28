import { validateAvailability } from "@/domain/availability/availability-rules";
import type { AvailabilityInput, DayOfWeek } from "@/domain/availability/availability-types";

const LEGACY_DAYS: Record<string, DayOfWeek> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export type LegacyAvailability = { dayOfWeek: string | number; startTime: string; endTime: string };

export function normalizeLegacyAvailability(records: LegacyAvailability[]): AvailabilityInput[] {
  return records.map((record) => {
    const numericDay = typeof record.dayOfWeek === "number" ? record.dayOfWeek : LEGACY_DAYS[record.dayOfWeek.toUpperCase()];
    return validateAvailability({ ...record, dayOfWeek: numericDay as DayOfWeek });
  });
}
