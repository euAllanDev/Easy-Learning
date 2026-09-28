import { describe, expect, it } from "vitest";
import { getAvailabilityForDate, intervalsOverlap, normalizeTime, validateAvailability } from "@/domain/availability/availability-rules";
import type { AvailabilityInput } from "@/domain/availability/availability-types";

const monday = (startTime: string, endTime: string): AvailabilityInput => ({ dayOfWeek: 1, startTime, endTime });

describe("availability rules", () => {
  it("accepts and normalizes a valid interval", () => {
    expect(validateAvailability(monday("7:00", "10:00"))).toEqual(monday("07:00", "10:00"));
    expect(normalizeTime(" 09:05 ")).toBe("09:05");
  });

  it.each([
    ["invalid time", monday("25:00", "26:00")],
    ["invalid day", { ...monday("07:00", "10:00"), dayOfWeek: 7 }],
    ["equal start and end", monday("10:00", "10:00")],
    ["start after end", monday("10:01", "10:00")],
  ] as const)("rejects %s", (_label, input) => {
    expect(() => validateAvailability(input as AvailabilityInput)).toThrow();
  });

  it.each([
    ["partial overlap", monday("07:00", "10:00"), monday("09:00", "11:00"), true],
    ["complete overlap", monday("07:00", "10:00"), monday("07:00", "10:00"), true],
    ["contained interval", monday("07:00", "10:00"), monday("08:00", "09:00"), true],
    ["adjacent intervals", monday("07:00", "09:00"), monday("09:00", "11:00"), false],
    ["different days", monday("07:00", "10:00"), { dayOfWeek: 2, startTime: "08:00", endTime: "09:00" }, false],
  ] as const)("detects %s", (_label, left, right, expected) => {
    expect(intervalsOverlap(left, right)).toBe(expected);
  });

  it("returns local weekly slots for a date without changing their times", () => {
    const mondayDate = new Date(2026, 8, 28, 12);
    expect(getAvailabilityForDate([monday("14:00", "16:00"), monday("07:00", "10:00"), { dayOfWeek: 2, startTime: "08:00", endTime: "09:00" }], mondayDate))
      .toEqual([monday("07:00", "10:00"), monday("14:00", "16:00")]);
  });
});
