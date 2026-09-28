import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const password = "senha-segura-123";

async function register(page: Page, prefix: string) {
  const email = `${prefix}-${Date.now()}-${test.info().project.name}@example.com`;
  await page.goto("/criar-conta");
  await page.getByLabel("Como podemos chamar você?").fill("Estudante");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/hoje$/);
  return email;
}

function plannedTimes(hour = 12) {
  const start = new Date(); start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + 50 * 60 * 1000);
  return { plannedStartAt: start.toISOString(), plannedEndAt: end.toISOString() };
}

async function createSession(request: APIRequestContext, hour = 12) {
  const response = await request.post("/api/v1/sessions", { data: { type: "PLANNED", title: "Direito Administrativo", ...plannedTimes(hour), plannedDurationSeconds: 3000 } });
  expect(response.status()).toBe(201);
  return response.json() as Promise<{ id: string }>;
}

test("completes the study lifecycle and updates history", async ({ page }) => {
  await register(page, "sessions-flow");
  await createSession(page.request);
  await page.reload();
  await expect(page.getByText("Direito Administrativo").first()).toBeVisible();
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page.getByLabel("Timer da sessão")).toBeVisible();
  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByText("Pausada", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retomar" }).click();
  await page.getByRole("button", { name: "Finalizar" }).click();
  await page.getByLabel("Quanto tempo você estudou?").fill("42");
  await page.getByLabel("Quantas questões?").fill("18");
  await page.getByLabel("Quantos acertos?").fill("12");
  await page.getByRole("button", { name: "Salvar resultado" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const persistedSessions = await (await page.request.get("/api/v1/sessions")).json() as Array<{ status: string; completedAt: string | null }>;
  expect(persistedSessions).toMatchObject([{ status: "COMPLETED", completedAt: expect.any(String) }]);
  const historyResponse = await page.request.get("/api/v1/sessions/history?period=week");
  expect(historyResponse.status()).toBe(200);
  expect((await historyResponse.json() as { sessions: unknown[] }).sessions).toHaveLength(1);
  await page.goto("/historico");
  await expect(page.getByText("Direito Administrativo")).toBeVisible();
  await expect(page.getByText("66.67%").first()).toBeVisible();
  await expect(page.getByText("42min").first()).toBeVisible();
});

test("restores running and paused timers after reload", async ({ page }) => {
  await register(page, "sessions-reload");
  await createSession(page.request);
  await page.reload();
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page.getByLabel("Timer da sessão")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Timer da sessão")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByRole("button", { name: "Retomar" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Pausada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retomar" })).toBeVisible();
});

test("isolates sessions between users", async ({ page, browser }) => {
  await register(page, "sessions-owner-a");
  const owned = await createSession(page.request);
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await register(pageB, "sessions-owner-b");
  const response = await pageB.request.get(`/api/v1/sessions/${owned.id}`);
  expect(response.status()).toBe(404);
  await contextB.close();
});

test("a double click starts only one active session", async ({ page }) => {
  await register(page, "sessions-double-click");
  await createSession(page.request);
  await createSession(page.request, 14);
  await page.reload();
  await page.getByRole("button", { name: "Iniciar sessão" }).first().dblclick();
  await expect(page.getByLabel("Timer da sessão")).toBeVisible();
  const sessions = await (await page.request.get("/api/v1/sessions")).json() as Array<{ status: string }>;
  expect(sessions.filter((session) => session.status === "IN_PROGRESS" || session.status === "PAUSED")).toHaveLength(1);
});
