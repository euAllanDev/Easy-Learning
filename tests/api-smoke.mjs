import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

async function register(name) {
  const result = await request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email: `${name.toLowerCase()}-${suffix}@example.com`, password: "senha-segura-123" }),
  });
  assert.equal(result.response.status, 201);
  return result.response.headers.get("set-cookie")?.split(";", 1)[0];
}

const ownerCookie = await register("Owner");
const created = await request("/api/v1/goals", {
  method: "POST",
  headers: { Cookie: ownerCookie },
  body: JSON.stringify({ name: "Concurso", description: "API smoke test", priority: "HIGH", minimumMinutesPerDay: 45, idealMinutesPerDay: 120 }),
});
assert.equal(created.response.status, 201);

const otherCookie = await register("Other");
const unauthorizedUpdate = await request(`/api/v1/goals/${created.body.id}`, {
  method: "PATCH",
  headers: { Cookie: otherCookie },
  body: JSON.stringify({ name: "Não permitido" }),
});
assert.equal(unauthorizedUpdate.response.status, 404);

const otherGoals = await request("/api/v1/goals", { headers: { Cookie: otherCookie } });
assert.deepEqual(otherGoals.body, []);

const forgedOwner = await request("/api/v1/goals", {
  method: "POST",
  headers: { Cookie: otherCookie },
  body: JSON.stringify({ userId: created.body.id, name: "Forjado", description: "", priority: "LOW", minimumMinutesPerDay: 10, idealMinutesPerDay: 20 }),
});
assert.equal(forgedOwner.response.status, 400);

const unauthenticatedAvailability = await request("/api/v1/availability");
assert.equal(unauthenticatedAvailability.response.status, 401);

const monday = await request("/api/v1/availability", {
  method: "POST",
  headers: { Cookie: ownerCookie },
  body: JSON.stringify({ dayOfWeek: 1, startTime: "07:00", endTime: "10:00" }),
});
assert.equal(monday.response.status, 201);

const conflict = await request("/api/v1/availability", {
  method: "POST",
  headers: { Cookie: ownerCookie },
  body: JSON.stringify({ dayOfWeek: 1, startTime: "09:00", endTime: "11:00" }),
});
assert.equal(conflict.response.status, 422);

const tuesday = await request("/api/v1/availability", {
  method: "POST",
  headers: { Cookie: otherCookie },
  body: JSON.stringify({ dayOfWeek: 2, startTime: "14:00", endTime: "16:00" }),
});
assert.equal(tuesday.response.status, 201);

const ownerAvailability = await request("/api/v1/availability", { headers: { Cookie: ownerCookie } });
const otherAvailability = await request("/api/v1/availability", { headers: { Cookie: otherCookie } });
assert.deepEqual(ownerAvailability.body.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })), [{ dayOfWeek: 1, startTime: "07:00", endTime: "10:00" }]);
assert.deepEqual(otherAvailability.body.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })), [{ dayOfWeek: 2, startTime: "14:00", endTime: "16:00" }]);

const crossUserUpdate = await request(`/api/v1/availability/${monday.body.id}`, {
  method: "PATCH",
  headers: { Cookie: otherCookie },
  body: JSON.stringify({ endTime: "09:00" }),
});
assert.equal(crossUserUpdate.response.status, 404);

const crossUserDelete = await request(`/api/v1/availability/${tuesday.body.id}`, { method: "DELETE", headers: { Cookie: ownerCookie } });
assert.equal(crossUserDelete.response.status, 404);

const updated = await request(`/api/v1/availability/${monday.body.id}`, {
  method: "PATCH",
  headers: { Cookie: ownerCookie },
  body: JSON.stringify({ endTime: "09:00" }),
});
assert.equal(updated.response.status, 200);
assert.equal((await request(`/api/v1/availability/${monday.body.id}`, { method: "DELETE", headers: { Cookie: ownerCookie } })).response.status, 204);

const plannedStartAt = new Date();
plannedStartAt.setMinutes(0, 0, 0);
const plannedEndAt = new Date(plannedStartAt.getTime() + 50 * 60 * 1000);
const studySession = await request("/api/v1/sessions", {
  method: "POST",
  headers: { Cookie: ownerCookie },
  body: JSON.stringify({
    objectiveId: created.body.id,
    title: "Direito Administrativo",
    type: "PLANNED",
    plannedStartAt: plannedStartAt.toISOString(),
    plannedEndAt: plannedEndAt.toISOString(),
    plannedDurationSeconds: 3000,
  }),
});
assert.equal(studySession.response.status, 201);
assert.equal((await request(`/api/v1/sessions/${studySession.body.id}`, { headers: { Cookie: otherCookie } })).response.status, 404);
assert.equal((await request(`/api/v1/sessions/${studySession.body.id}/start`, { method: "POST", headers: { Cookie: ownerCookie }, body: "{}" })).response.status, 200);
assert.equal((await request(`/api/v1/sessions/${studySession.body.id}/pause`, { method: "POST", headers: { Cookie: ownerCookie }, body: "{}" })).response.status, 200);
assert.equal((await request(`/api/v1/sessions/${studySession.body.id}/resume`, { method: "POST", headers: { Cookie: ownerCookie }, body: "{}" })).response.status, 200);
const completion = await request(`/api/v1/sessions/${studySession.body.id}/complete`, {
  method: "POST",
  headers: { Cookie: ownerCookie },
  body: JSON.stringify({ actualDurationSeconds: 2520, questions: 18, correctAnswers: 12, difficulty: "NORMAL" }),
});
assert.equal(completion.response.status, 200);
assert.equal(completion.body.accuracy, 66.67);
const history = await request("/api/v1/sessions/history?period=week", { headers: { Cookie: ownerCookie } });
assert.equal(history.response.status, 200);
assert.equal(history.body.summary.completedSessions, 1);

console.log("API smoke test passed: auth, goals, availability, sessions lifecycle, results, history, and cross-user isolation.");
