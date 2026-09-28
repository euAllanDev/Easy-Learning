import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Availability, AvailabilityInput } from "@/domain/availability/availability-types";

const state = vi.hoisted(() => ({
  userId: "user-a" as string | null,
  records: [] as Availability[],
  nextId: 1,
}));

vi.mock("@/infrastructure/auth/session", async () => {
  const { AuthenticationError } = await import("@/infrastructure/auth/auth-service");
  return { requireUser: async () => {
    if (!state.userId) throw new AuthenticationError();
    return { id: state.userId, name: "Test", email: "test@example.com" };
  } };
});

vi.mock("@/infrastructure/repositories/drizzle-availability-repository", () => ({
  DrizzleAvailabilityRepository: class {
    async findByUserId(userId: string) { return state.records.filter((slot) => slot.userId === userId); }
    async findById(userId: string, id: string) { return state.records.find((slot) => slot.userId === userId && slot.id === id) ?? null; }
    async create(userId: string, input: AvailabilityInput) {
      const now = new Date("2026-09-28T12:00:00.000Z");
      const record = { id: `slot-${state.nextId++}`, userId, createdAt: now, updatedAt: now, ...input };
      state.records.push(record);
      return record;
    }
    async update(userId: string, id: string, input: AvailabilityInput) {
      const record = state.records.find((slot) => slot.userId === userId && slot.id === id);
      if (!record) return null;
      Object.assign(record, input);
      return record;
    }
    async delete(userId: string, id: string) {
      const index = state.records.findIndex((slot) => slot.userId === userId && slot.id === id);
      if (index < 0) return false;
      state.records.splice(index, 1);
      return true;
    }
  },
}));

import { GET, POST } from "@/app/api/v1/availability/route";
import { DELETE, PATCH } from "@/app/api/v1/availability/[id]/route";

const monday = { dayOfWeek: 1, startTime: "07:00", endTime: "10:00" };
const request = (method: string, body?: unknown) => new Request("http://localhost/api/v1/availability", { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const context = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  state.userId = "user-a";
  state.records.length = 0;
  state.nextId = 1;
});

describe("availability API", () => {
  it("requires authentication for GET", async () => {
    state.userId = null;
    expect((await GET()).status).toBe(401);
  });

  it("requires authentication for every mutation", async () => {
    state.userId = null;
    expect((await POST(request("POST", monday))).status).toBe(401);
    expect((await PATCH(request("PATCH", { endTime: "09:00" }), context("slot-1"))).status).toBe(401);
    expect((await DELETE(request("DELETE"), context("slot-1"))).status).toBe(401);
  });

  it("creates and lists only the authenticated user's ordered slots", async () => {
    state.records.push({ id: "other", userId: "user-b", createdAt: new Date(), updatedAt: new Date(), dayOfWeek: 1, startTime: "14:00", endTime: "16:00" });
    expect((await POST(request("POST", monday))).status).toBe(201);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ id: "slot-1", startTime: "07:00" }]);
  });

  it("rejects invalid input and client-provided ownership", async () => {
    expect((await POST(request("POST", { ...monday, endTime: "06:00" }))).status).toBe(422);
    expect((await POST(request("POST", { ...monday, userId: "user-b" }))).status).toBe(400);
  });

  it("rejects overlapping slots", async () => {
    await POST(request("POST", monday));
    const response = await POST(request("POST", { ...monday, startTime: "09:00", endTime: "11:00" }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "AVAILABILITY_CONFLICT" });
  });

  it("updates and deletes an owned slot", async () => {
    const created = await (await POST(request("POST", monday))).json();
    const updated = await PATCH(request("PATCH", { endTime: "09:00" }), context(created.id));
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ endTime: "09:00" });
    expect((await DELETE(request("DELETE"), context(created.id))).status).toBe(204);
  });

  it("revalidates overlap when updating a slot", async () => {
    await POST(request("POST", monday));
    const later = await (await POST(request("POST", { ...monday, startTime: "14:00", endTime: "16:00" }))).json();
    const response = await PATCH(request("PATCH", { startTime: "09:00" }), context(later.id));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "AVAILABILITY_CONFLICT" });
  });

  it("returns 404 when another user tries to update or delete a slot", async () => {
    const ownedByA = await (await POST(request("POST", monday))).json();
    state.userId = "user-b";
    const ownedByB = await (await POST(request("POST", { ...monday, startTime: "14:00", endTime: "16:00" }))).json();
    expect((await PATCH(request("PATCH", { endTime: "09:00" }), context(ownedByA.id))).status).toBe(404);
    expect((await DELETE(request("DELETE"), context(ownedByA.id))).status).toBe(404);
    state.userId = "user-a";
    expect((await PATCH(request("PATCH", { endTime: "15:00" }), context(ownedByB.id))).status).toBe(404);
    expect((await DELETE(request("DELETE"), context(ownedByB.id))).status).toBe(404);
  });
});
