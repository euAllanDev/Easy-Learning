import { DAY_NAMES, DAYS_OF_WEEK, type Availability, type AvailabilityInput, type AvailableSlot, type DayOfWeek } from "./availability-types";

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

export class AvailabilityRuleError extends Error {
  constructor(message: string, readonly code: "INVALID_DAY" | "INVALID_TIME" | "INVALID_INTERVAL" | "OVERLAP") {
    super(message);
  }
}

export function isDayOfWeek(value: number): value is DayOfWeek {
  return DAYS_OF_WEEK.includes(value as DayOfWeek);
}

export function normalizeTime(value: string) {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) throw new AvailabilityRuleError("Informe um horário válido no formato HH:mm.", "INVALID_TIME");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new AvailabilityRuleError("Informe um horário válido no formato HH:mm.", "INVALID_TIME");
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function validateAvailability(input: AvailabilityInput): AvailabilityInput {
  if (!isDayOfWeek(input.dayOfWeek)) {
    throw new AvailabilityRuleError("Selecione um dia da semana válido.", "INVALID_DAY");
  }
  const normalized = { ...input, startTime: normalizeTime(input.startTime), endTime: normalizeTime(input.endTime) };
  if (normalized.startTime >= normalized.endTime) {
    throw new AvailabilityRuleError("O horário inicial precisa ser anterior ao horário final.", "INVALID_INTERVAL");
  }
  return normalized;
}

export function intervalsOverlap(left: AvailabilityInput, right: AvailabilityInput) {
  return left.dayOfWeek === right.dayOfWeek && left.startTime < right.endTime && right.startTime < left.endTime;
}

export function assertNoOverlap(candidate: AvailabilityInput, current: Availability[], ignoredId?: string) {
  if (current.some((slot) => slot.id !== ignoredId && intervalsOverlap(candidate, slot))) {
    throw new AvailabilityRuleError(`Este horário entra em conflito com outro período de ${DAY_NAMES[candidate.dayOfWeek].toLowerCase()}.`, "OVERLAP");
  }
}

export function sortAvailability<T extends AvailabilityInput>(slots: T[]) {
  return [...slots].sort((left, right) => left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime));
}

export function getAvailabilityForDate(slots: AvailableSlot[], date: Date): AvailableSlot[] {
  const dayOfWeek = date.getDay() as DayOfWeek;
  return sortAvailability(slots.filter((slot) => slot.dayOfWeek === dayOfWeek));
}
