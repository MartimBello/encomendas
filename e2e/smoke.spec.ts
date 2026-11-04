import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email profissional").fill(email);
  await page.getByLabel("Palavra-passe").fill("Encomendas123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("manifest and login surface are installable and Portuguese", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).name).toBe("Encomendas");
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Bem-vindo" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
});

test("store account reaches the order list and cannot open admin", async ({ page }) => {
  await login(page, "loja@encomendas.local");
  await expect(page).toHaveURL(/\/loja\/encomendas/);
  await expect(page.getByRole("heading", { name: "Encomendas", exact: true })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Sem acesso a esta área" })).toBeVisible();
});

test("kitchen and admin accounts are routed to their workspaces", async ({ browser }) => {
  const kitchen = await browser.newPage();
  await login(kitchen, "cozinha@encomendas.local");
  await expect(kitchen).toHaveURL(/\/cozinha/);
  await expect(kitchen.getByRole("heading", { name: "Cozinha", exact: true })).toBeVisible();
  await kitchen.close();

  const admin = await browser.newPage();
  await login(admin, "admin@encomendas.local");
  await expect(admin).toHaveURL(/\/admin/);
  await expect(admin.getByRole("heading", { name: "Administração" })).toBeVisible();
  await admin.close();
});

test("store creation, kitchen acceptance and cancellation acknowledgment", async ({ page, browser }) => {
  await login(page, "loja@encomendas.local");
  await page.goto("/loja/encomendas/nova");
  await expect(page.getByRole("heading", { name: "Nova encomenda" })).toBeVisible();
  await page.getByLabel("Nome do cliente").fill("Cliente Playwright");
  await page.getByLabel(/^Email/).fill("playwright@example.pt");
  await page.getByLabel("Telefone").fill("912345678");
  const pickupStore = page.getByLabel("Loja de levantamento");
  await pickupStore.selectOption({ label: "Loja de Matosinhos" });
  await page.getByLabel("Data de levantamento").click();
  await page.locator('[data-slot="calendar"] button[data-day]:not([disabled])').first().click();
  const pickupTime = page.getByLabel("Hora de levantamento");
  const firstPickupTime = await page.locator("datalist option").first().getAttribute("value");
  await pickupTime.fill(firstPickupTime!);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Bacalhau com natas/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Enviar à cozinha" }).click();
  await expect(page).toHaveURL(/\/loja\/encomendas\/[0-9a-f-]+$/);

  const orderId = page.url().split("/").pop()!;
  const orderNumber = (await page.getByRole("heading", { level: 1 }).textContent())!;
  await expect(page.getByText("Por aceitar", { exact: true })).toBeVisible();

  const kitchen = await browser.newPage();
  await login(kitchen, "cozinha@encomendas.local");
  await kitchen.getByRole("button", { name: "Abrir fila" }).click();
  const pendingCard = kitchen.getByRole("article", { name: orderNumber });
  await expect(pendingCard).toBeVisible();
  await pendingCard.getByRole("button", { name: "Aceitar" }).click();
  await expect(pendingCard).toBeHidden();

  await page.reload();
  await expect(page.getByText("Aceite", { exact: true })).toBeVisible();
  const printPage = await page.context().newPage();
  await printPage.goto(`/encomendas/${orderId}/imprimir?paper=a4`);
  await expect(printPage.getByRole("heading", { name: orderNumber })).toBeVisible();
  await expect(printPage.locator(".print-a4")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
  await printPage.goto(`/encomendas/${orderId}/imprimir?versao=1&paper=80mm`);
  await expect(printPage.getByText("OBSOLETA", { exact: true })).toBeVisible();
  await expect(printPage.locator(".print-80mm")).toBeVisible();
  await printPage.close();

  await page.goto(`/loja/encomendas?q=${encodeURIComponent(orderNumber)}`);
  await expect(page.getByText(orderNumber, { exact: true })).toBeVisible();

  await kitchen.reload();
  await kitchen.getByRole("button", { name: "Abrir fila" }).click();
  const cancellationCard = kitchen.getByRole("article", { name: `${orderNumber} cancelada` });
  await expect(cancellationCard).toBeVisible();
  await cancellationCard.getByRole("button", { name: "Reconhecer cancelamento" }).click();
  await expect(cancellationCard).toBeHidden();
  await kitchen.close();
});
