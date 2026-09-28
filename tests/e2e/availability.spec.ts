import { expect, test } from "@playwright/test";

test("persists the availability CRUD journey", async ({ page }) => {
  const email = `availability-${Date.now()}-${test.info().project.name}@example.com`;
  const password = "senha-segura-123";

  await page.goto("/criar-conta");
  await page.getByLabel("Como podemos chamar você?").fill("Estudante");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/hoje$/);

  // Next Dev Tools overlaps this sidebar control at desktop widths.
  await page.getByRole("button", { name: "Sair" }).click({ force: true });
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/hoje$/);

  await page.goto("/disponibilidade");
  await expect(page.getByRole("heading", { name: "Quando você pode estudar?" })).toBeVisible();

  await page.getByRole("button", { name: "Novo horário" }).click();
  await page.getByLabel("Dia").selectOption("1");
  await page.getByLabel("Início").fill("07:00");
  await page.getByLabel("Fim").fill("10:00");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Horário adicionado")).toBeVisible();

  await page.getByRole("button", { name: "Novo horário" }).click();
  await page.getByLabel("Dia").selectOption("2");
  await page.getByLabel("Início").fill("18:00");
  await page.getByLabel("Fim").fill("20:00");
  await page.getByRole("button", { name: "Salvar" }).click();

  const monday = page.locator("article").filter({ hasText: "Segunda-feira" });
  await monday.getByRole("button", { name: /Editar 07:00/ }).click();
  await page.getByLabel("Fim").fill("09:00");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Horário atualizado")).toBeVisible();

  const tuesday = page.locator("article").filter({ hasText: "Terça-feira" });
  await tuesday.getByRole("button", { name: /Remover 18:00/ }).click();
  await page.getByRole("button", { name: "Remover horário" }).click();
  await expect(page.getByText("Horário removido")).toBeVisible();

  await page.reload();
  await expect(monday.getByText("07:00")).toBeVisible();
  await expect(monday.getByText("09:00")).toBeVisible();
  await expect(tuesday.getByText("18:00")).not.toBeVisible();
});
