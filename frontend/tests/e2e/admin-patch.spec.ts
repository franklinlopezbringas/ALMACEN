import { test, expect } from "@playwright/test";
test("administrator saves product metadata without mutating stock and publishes a new plan version", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("admin@fixture.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_STUB_PASSWORD!);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/catalogo");
  await page
    .getByRole("combobox", { name: "Sede", exact: true })
    .selectOption("1");
  await expect(page.getByText("12 unidades").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Crear producto", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const name = `Producto de prueba ${info.project.name}`;
  await dialog
    .getByLabel("SKU", { exact: true })
    .fill(`TEST-${info.project.name}`);
  await dialog.getByLabel("Nombre", { exact: true }).fill(name);
  await dialog.getByLabel("Precio de venta", { exact: true }).fill("22.5");
  await dialog.getByLabel("Stock mínimo", { exact: true }).fill("3");
  await expect(dialog).toContainText("no cambia existencias");
  const posted = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/api/gymflow/products"),
  );
  await dialog.getByRole("button", { name: "Guardar producto" }).click();
  expect((await posted).postDataJSON()).not.toHaveProperty("stock");
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: `Editar producto ${name}`, exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "Estado", exact: true })
    .selectOption("INACTIVE");
  await dialog.getByRole("button", { name: "Guardar producto" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Estado del producto").selectOption("INACTIVE");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.goto("/admin/planes");
  await page.getByRole("button", { name: "Crear plan", exact: true }).click();
  await dialog
    .getByLabel("Código", { exact: true })
    .fill(`PLAN-${info.project.name}`);
  const plan = `Plan prueba ${info.project.name}`;
  await dialog.getByLabel("Nombre", { exact: true }).fill(plan);
  await dialog.getByLabel("Precio", { exact: true }).fill("90");
  await dialog.getByRole("button", { name: "Guardar plan" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: `Nueva versión ${plan}`, exact: true })
    .click();
  await expect(dialog).toContainText("contratos anteriores no cambian");
  await dialog.getByLabel("Precio", { exact: true }).fill("110");
  const published = page.waitForRequest(
    (r) => r.method() === "POST" && /\/plans\/[^/]+\/versions$/.test(r.url()),
  );
  await dialog.getByRole("button", { name: "Publicar versión" }).click();
  expect((await published).postDataJSON()).toHaveProperty("rowVersion");
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: `Ver condiciones ${plan}`, exact: true })
    .click();
  await expect(dialog).toContainText("110");
});
