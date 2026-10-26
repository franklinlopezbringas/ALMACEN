import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, account = "admin") {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(`${account}@fixture.test`);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_STUB_PASSWORD!);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("loading, 403, retry recovery and empty search are visible", async ({
  page,
}) => {
  await login(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/gymflow/members?**", async (route) => {
    await gate;
    await route.fulfill({
      status: 403,
      json: { message: "Tu cuenta no tiene permisos para esta acción." },
    });
  });
  await page.goto("/admin/socios");
  await expect(
    page.getByRole("status", { name: "Cargando datos" }),
  ).toBeVisible();
  release();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "no tiene permisos",
  );
  await page.unroute("**/api/gymflow/members?**");
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    page.getByRole("button", { name: "Ver Lucía Fernández", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Buscar socios").fill("NO_MATCH");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText("Sin coincidencias")).toBeVisible();
  await page.getByLabel("Buscar socios").fill("");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ver Lucía Fernández", exact: true }),
  ).toBeVisible();
});

test("failed refresh returns to login and clears protected display", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/gymflow/members?**", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.goto("/admin/socios");
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: "Socios", exact: true }),
  ).toHaveCount(0);
});

test("administrator without write permission sees no create action and denied sections stay protected", async ({
  page,
}) => {
  await login(page, "readonly");
  await expect(page.getByRole("link", { name: "Registrar socio" })).toHaveCount(
    0,
  );
  await page.goto("/admin/socios");
  await expect(
    page.getByRole("button", { name: "Ver Lucía Fernández", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar socio" }),
  ).toHaveCount(0);
  await page.goto("/admin/crm");
  await expect(page.getByText("Acceso restringido")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Prospectos", exact: true }),
  ).toHaveCount(0);
});

test("member detail dialog fits viewport and returns keyboard focus", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/socios");
  const open = page.getByRole("button", { name: /^Ver Lucía/ }).first();
  await open.click();
  await expect(page.getByRole("dialog")).toContainText("Ficha del socio");
  await expect(page.getByText("lucia.fernandez@example.test")).toBeVisible();
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds!.width).toBeLessThan(page.viewportSize()!.width);
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
});

test("CRM creates and converts a prospect; notifications acknowledge a message", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/admin/crm");
  await page.getByRole("button", { name: "Nuevo prospecto" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombres *").fill("Andrea");
  await dialog.getByLabel("Apellidos *").fill(`Fixture ${info.project.name}`);
  await dialog.getByRole("button", { name: "Guardar prospecto" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByLabel("Buscar prospectos")
    .fill(`Andrea Fixture ${info.project.name}`);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("button", { name: "Convertir", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar conversión" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Prospecto convertido a socio",
  );
  await expect(
    page.getByRole("button", { name: "Convertir", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/notificaciones");
  await expect(page.getByText("Una nueva semana para avanzar")).toBeVisible();
  const markRead = page.getByRole("button", { name: "Marcar leído" });
  if (await markRead.count()) await markRead.click();
  await expect(page.getByText("Leído", { exact: true })).toBeVisible();
});
