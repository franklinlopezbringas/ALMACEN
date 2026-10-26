import { test, expect } from "@playwright/test";

test("Foundation and administrator visual review", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const capture = async (name: string) => {
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/review/${info.project.name}/${name}.png`,
      fullPage: ![
        "registro-socio",
        "crear-producto",
        "crear-plan",
        "participantes",
      ].includes(name),
    });
  };
  await page.goto("/");
  await capture("publica");
  await page.goto("/login");
  await capture("login");
  await page.getByLabel("Correo electrónico").fill("admin@fixture.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_STUB_PASSWORD!);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  for (const [route, name, text] of [
    ["/admin", "admin", "128"],
    ["/admin/socios", "socios", "Lucía Fernández"],
    ["/admin/crm", "crm", "Natalia Montes"],
    ["/admin/membresias", "membresias", "Lucía Fernández"],
    ["/admin/clases", "clases", "Functional Power"],
    ["/admin/catalogo", "catalogo", "Botella deportiva"],
    ["/admin/planes", "planes", "Plan Flow"],
    [
      "/admin/notificaciones",
      "notificaciones",
      "Una nueva semana para avanzar",
    ],
  ]) {
    await page.goto(route);
    await expect(
      page.getByText(text, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Cargando datos" }),
    ).toHaveCount(0);
    if (["socios", "crm"].includes(name) && page.viewportSize()!.width < 1024) {
      await expect(page.getByRole("table")).toHaveCount(0);
      const list = page.getByRole("list", {
        name:
          name === "socios"
            ? "Socios en esta página"
            : "Prospectos en esta página",
      });
      expect(
        await list.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
    }
    await capture(name);
  }
  await page.goto("/admin/socios");
  await page
    .getByRole("button", { name: "Registrar socio", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture("registro-socio");
  await page.keyboard.press("Escape");
  for (const [route, button, name] of [
    ["catalogo", "Crear producto", "crear-producto"],
    ["planes", "Crear plan", "crear-plan"],
    ["clases", "Ver sesión Functional Power", "participantes"],
  ]) {
    await page.goto(`/admin/${route}`);
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    if (name === "participantes")
      await expect(page.getByRole("dialog")).toContainText("Lucía Fernández");
    await capture(name);
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});
