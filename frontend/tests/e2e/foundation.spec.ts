import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, role = "admin") {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(role + "@fixture.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_STUB_PASSWORD!);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
}
test("public experience and responsive bounds", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "mejor versión",
  );
  await expect
    .poll(() =>
      page.evaluate(
        (width) => document.documentElement.scrollWidth <= width,
        page.viewportSize()!.width,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: `artifacts/public-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Encuentra tu plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Plan Flow", exact: true }),
  ).toBeVisible();
});
test("unauthenticated routes, form validation and invalid credentials", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page.getByText("Ingresa un correo válido.")).toBeVisible();
  await page.getByLabel("Correo electrónico").fill("admin@fixture.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("incorrect-fixture-value");
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Revisa tu correo y contraseña",
  );
});
test("administrator overview, people search, pagination, creation and logout", async ({
  page,
  context,
}, info) => {
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("128", { exact: true })).toBeVisible();
  const cookies = await context.cookies();
  expect(
    cookies
      .filter((c) => c.name.startsWith("gf_"))
      .every((c) => c.httpOnly && c.sameSite === "Lax"),
  ).toBe(true);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.screenshot({
    path: `artifacts/admin-${info.project.name}.png`,
    fullPage: true,
  });
  await expect
    .poll(() =>
      page.evaluate(
        (width) => document.documentElement.scrollWidth <= width,
        page.viewportSize()!.width,
      ),
    )
    .toBe(true);
  await page.goto("/admin/socios");
  await expect(
    page.getByRole("button", { name: "Ver Lucía Fernández", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await expect(page.getByText(/Página 2 de/)).toBeVisible();
  await page.getByLabel("Buscar socios").fill("Lucía");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText(/Página 1 de/)).toBeVisible();
  await page.getByLabel("Buscar socios").fill("NO_MATCH");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText("Sin coincidencias")).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar socio", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombres *").fill("Prueba");
  await dialog.getByLabel("Apellidos *").fill("Frontend");
  await dialog.getByRole("button", { name: "Registrar socio" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
for (const [role, path, title] of [
  ["reception", "/recepcion", "Inicio"],
  ["trainer", "/entrenador", "Personas que avanzan contigo"],
  ["member", "/socio", "Tu mejor versión, un día a la vez."],
]) {
  test(`${role} lands in its own experience and cannot open administrator`, async ({
    page,
  }) => {
    await login(page, role);
    await expect(page).toHaveURL(new RegExp(path + "$"));
    await expect(
      page
        .getByRole("heading", {
          name: new RegExp(title.replaceAll(".", "\\.")),
        })
        .first(),
    ).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(new RegExp(path + "$"));
  });
}
test("server-side permission boundary and CSRF rejection", async ({
  page,
  request,
}) => {
  const csrf = await request.post("/api/auth/login", {
    headers: { Origin: "http://outside.test" },
    data: {},
  });
  expect(csrf.status()).toBe(403);
  await login(page, "member");
  await expect(page).toHaveURL(/\/socio$/);
  const denied = await page.request.get("/api/gymflow/members");
  expect(denied.status()).toBe(403);
  const unsupported = await page.request.get("/api/gymflow/auth/login");
  expect(unsupported.status()).toBe(404);
});
test("network failure is visible and recoverable", async ({ page }) => {
  await login(page);
  await page.goto("/admin/socios");
  await page.getByLabel("Buscar socios").fill("SERVER_ERROR");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeEnabled();
});
test("expired access rotates refresh and recovers concurrent dashboard requests", async ({
  page,
}) => {
  await login(page, "expired");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("128", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Functional Power", { exact: true }),
  ).toBeVisible();
});
test("mobile navigation is keyboard accessible", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Mobile-only dialog");
  await login(page);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
});
