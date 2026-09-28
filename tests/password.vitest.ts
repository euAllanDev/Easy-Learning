import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";

describe("password hashing", () => {
  it("stores a salted hash and verifies only the original password", () => {
    const first = hashPassword("uma-senha-segura");
    const second = hashPassword("uma-senha-segura");
    expect(first).not.toBe(second);
    expect(first).not.toContain("uma-senha-segura");
    expect(verifyPassword("uma-senha-segura", first)).toBe(true);
    expect(verifyPassword("senha-incorreta", first)).toBe(false);
  });
});
