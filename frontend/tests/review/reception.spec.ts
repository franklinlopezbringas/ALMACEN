import { test, expect } from "@playwright/test";

test("Reception operational screens remain usable at every review width", async ({
  page,
  request,
}, info) => {
  await request.post("http://127.0.0.1:5099/api/v1/fixtures/reception/reset", {
    headers: { "x-fixture-key": process.env.E2E_STUB_PASSWORD! },
    data: { presentation: true },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("reception@fixture.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_STUB_PASSWORD!);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page).toHaveURL(/\/recepcion$/);
  const capture = async (name: string) => {
    await expect(
      page.getByRole("status", { name: "Cargando datos" }),
    ).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    const dialog = page.getByRole("dialog");
    if (await dialog.count())
      expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
        true,
      );
    await page.screenshot({
      path: `artifacts/reception-review/${info.project.name}/${name}.png`,
      fullPage: !(await dialog.count()),
    });
  };
  for (const [route, name] of [
    ["", "inicio"],
    ["socios", "socios"],
    ["accesos", "accesos"],
    ["pagos-caja", "pagos-caja"],
    ["tienda", "tienda"],
    ["clases", "clases"],
    ["atencion", "atencion"],
    ["mi-turno", "mi-turno"],
  ]) {
    await page.goto("/recepcion" + (route ? "/" + route : ""));
    if (route === "tienda") {
      await page
        .getByRole("combobox", { name: "Sede", exact: true })
        .selectOption("1");
      await page
        .getByRole("button", { name: "Agregar Botella deportiva" })
        .click();
    }
    await capture(name);
  }
  await page.goto("/recepcion/socios");
  await page
    .getByRole("button", { name: "Abrir ficha: Lucía Fernández" })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Lucía Fernández" }),
  ).toBeVisible();
  await capture("ficha-socio");
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page.getByRole("button", { name: "Cobrar esta cuenta" }).click();
  await page
    .getByRole("combobox", { name: "Sede", exact: true })
    .selectOption("1");
  await page.getByLabel("Importe 1", { exact: true }).fill("40");
  await page
    .getByRole("combobox", { name: "Medio 1", exact: true })
    .selectOption("1");
  await page.getByRole("button", { name: "Agregar medio de pago" }).click();
  await page
    .getByRole("combobox", { name: "Medio 2", exact: true })
    .selectOption("2");
  await capture("cobro-mixto");
  expect(errors).toEqual([]);
});
