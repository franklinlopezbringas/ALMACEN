import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("admin@fixture.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_STUB_PASSWORD!);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("operational dashboard links to the actual CRM status filter", async ({
  page,
}) => {
  await login(page);
  await expect(page.getByText("Accesos de hoy", { exact: true })).toBeVisible();
  await expect(page.getByText("Ingresos de hoy", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("region", { name: "Atención operativa" }),
  ).toContainText("Clases con alta ocupación");
  await page
    .getByRole("link", { name: /Revisar .*prospectos? nuevos?/ })
    .click();
  await expect(page.getByLabel("Estado", { exact: true })).toHaveValue("NEW");
  await expect(
    page.getByText("Natalia Montes", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Gabriel Rivas", { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  const filtered = page.waitForResponse(
    (r) =>
      r.url().includes("/api/gymflow/prospects?") &&
      r.url().includes("status=CONTACTED"),
  );
  await page.getByLabel("Estado", { exact: true }).selectOption("CONTACTED");
  await filtered;
  await expect(
    page.getByText("Gabriel Rivas", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
});

test("members use desktop table or mobile cards, expose expiry and preserve document payload", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/admin/socios");
  const mobile = info.project.name === "mobile";
  if (mobile) {
    await expect(page.getByRole("table")).toHaveCount(0);
    const cards = page.getByRole("list", { name: "Socios en esta página" });
    await expect(cards).toContainText("Lucía Fernández");
    await expect(cards).toContainText("Vencimiento");
    await expect(cards).toContainText("+51 9•• ••• 241");
  } else {
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("table")).toContainText("Vence");
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(page.viewportSize()!.width);
  await page
    .getByRole("button", { name: "Registrar socio", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombres *").fill("Persona");
  await dialog.getByLabel("Apellidos *").fill("Validación Documento");
  await dialog.getByLabel("Tipo de documento").fill("PASSPORT");
  await dialog.getByLabel("Número de documento").fill("DEMO-NOT-REAL");
  await expect(dialog).toContainText(
    "no activa una membresía ni genera un cobro",
  );
  const submitted = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/api/gymflow/members"),
  );
  await dialog
    .getByRole("button", { name: "Registrar socio", exact: true })
    .click();
  const data = (await submitted).postDataJSON();
  expect(data.documentType).toBe("PASSPORT");
  expect(data.documentNumber).toBe("DEMO-NOT-REAL");
  expect(data).not.toHaveProperty("planVersionId");
  await expect(dialog).not.toBeVisible();
});

test("membership filters use the paginated real contract", async ({ page }) => {
  await login(page);
  await page.goto("/admin/membresias");
  await expect(
    page.getByRole("heading", { name: "Membresías", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Por vencer", exact: true }).click();
  const response = page.waitForResponse(
    (r) => r.url().includes("/memberships?") && r.url().includes("expiresTo="),
  );
  await page.getByLabel("Periodo").selectOption("30");
  expect((await response).status()).toBe(200);
  await expect(
    page.getByText("Camila Rojas", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Congeladas", exact: true }).click();
  await expect(
    page
      .getByText("Joaquín Herrera", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
});

test("products search by SKU, unknown stock stays unknown, plans and sessions open real-field summaries", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/catalogo");
  await page.getByLabel("Buscar productos").fill("GF-02");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Toalla de entrenamiento" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Botella deportiva" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ver producto Toalla de entrenamiento" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("No disponible");
  await page.keyboard.press("Escape");
  await page.goto("/admin/planes");
  await page.getByRole("button", { name: "Ver condiciones Plan Flow" }).click();
  await expect(page.getByRole("dialog")).toContainText("1 mes");
  await expect(page.getByRole("dialog")).toContainText("5 días");
  await page.keyboard.press("Escape");
  await page.goto("/admin/clases");
  await page
    .getByRole("button", { name: "Ver sesión Functional Power" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("20 plazas");
  await expect(page.getByRole("dialog")).toContainText("18");
});
