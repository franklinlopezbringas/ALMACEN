import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ request, page }) => {
  const reset = await request.post(
    "http://127.0.0.1:5099/api/v1/fixtures/reception/reset",
    { headers: { "x-fixture-key": process.env.E2E_STUB_PASSWORD! }, data: {} },
  );
  expect(reset.ok()).toBe(true);
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("reception@fixture.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_STUB_PASSWORD!);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page).toHaveURL(/\/recepcion$/);
});
async function member(page: Page, name = "Lucía Fernández") {
  await page.goto("/recepcion/socios");
  await page
    .getByRole("textbox", { name: "Buscar socio", exact: true })
    .fill(name);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("button", { name: "Abrir ficha: " + name }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name }),
  ).toBeVisible();
}
async function openCash(page: Page) {
  await page.goto("/recepcion/mi-turno");
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Caja", exact: true })
    .selectOption("1");
  await page.getByLabel("Fondo inicial").fill("100");
  await page
    .getByLabel("Notas de apertura")
    .fill("Fondo recibido y verificado.");
  await page.getByRole("button", { name: "Confirmar apertura" }).click();
  await expect(page.getByRole("status")).toContainText("Caja abierta");
}
async function collect(page: Page) {
  await member(page);
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page.getByRole("button", { name: "Cobrar esta cuenta" }).click();
  await page
    .getByRole("combobox", { name: "Sede", exact: true })
    .selectOption("1");
}
test("Reception login, search, profile, real-entry confirmation and QR history", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Inicio", exact: true }),
  ).toBeVisible();
  await member(page);
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Sede", exact: true })
    .selectOption("1");
  await page.getByRole("button", { name: "Confirmar check-in" }).click();
  await expect(page.getByRole("status")).toContainText("Ingreso permitido");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await page.goto("/recepcion/accesos");
  await expect(
    page.getByRole("heading", { name: "Historial de accesos" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Sede", exact: true })
    .selectOption("1");
  await page.getByLabel("Código QR leído").fill("fixture-qr-lucia");
  await page.getByRole("button", { name: "Confirmar ingreso QR" }).click();
  await expect(page.getByRole("status")).toContainText("Ingreso permitido");
});
test("Blocked entry never claims attendance", async ({ page }) => {
  await member(page, "Mateo García");
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Sede", exact: true })
    .selectOption("1");
  await page.getByRole("button", { name: "Confirmar check-in" }).click();
  await expect(page.getByRole("status")).toContainText("Ingreso bloqueado");
  await expect(
    page.getByText("Asistencia registrada correctamente."),
  ).toHaveCount(0);
});
test("Partial and mixed collection, cash-only movements and drawer reconciliation", async ({
  page,
}) => {
  await openCash(page);
  await collect(page);
  await page
    .getByRole("combobox", { name: "Medio 1", exact: true })
    .selectOption("1");
  await page.getByLabel("Importe 1", { exact: true }).fill("50");
  await page
    .getByRole("button", { name: "Registrar pago", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pago registrado" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await collect(page);
  await expect(page.getByLabel("Importe 1", { exact: true })).toHaveValue("70");
  await page
    .getByRole("combobox", { name: "Medio 1", exact: true })
    .selectOption("1");
  await page.getByLabel("Importe 1", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Agregar medio de pago" }).click();
  await page
    .getByRole("combobox", { name: "Medio 2", exact: true })
    .selectOption("2");
  await expect(page.getByLabel("Importe 2", { exact: true })).toHaveValue("50");
  await page
    .getByRole("button", { name: "Registrar pago", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pago registrado" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver a cuentas pendientes" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sin deuda pendiente" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await page.goto("/recepcion/mi-turno");
  await expect(page.getByText(/170\.00/)).toBeVisible();
  await page.getByRole("button", { name: "Ver movimientos" }).click();
  await expect(page.getByRole("dialog")).toContainText("2 registros");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await page.getByRole("button", { name: "Cerrar caja", exact: true }).click();
  await page.getByLabel("Efectivo contado").fill("170");
  await page.getByLabel("Notas de cierre").fill("Efectivo conciliado.");
  await page.getByRole("button", { name: "Confirmar cierre" }).click();
  await expect(page.getByRole("status")).toContainText("Diferencia: S/ 0.00");
});
test("POS single Yape and mixed cash/card sales update stock and only cash", async ({
  page,
}) => {
  await openCash(page);
  for (const mixed of [false, true]) {
    await page.goto("/recepcion/tienda");
    await page
      .getByRole("combobox", { name: "Sede", exact: true })
      .selectOption("1");
    await page
      .getByRole("button", { name: "Agregar Botella deportiva" })
      .click();
    await page.getByRole("button", { name: /^Cobrar S/ }).click();
    await page
      .getByRole("combobox", { name: "Medio 1", exact: true })
      .selectOption(mixed ? "1" : "2");
    if (mixed) {
      await page.getByLabel("Importe 1", { exact: true }).fill("10");
      await page.getByRole("button", { name: "Agregar medio de pago" }).click();
      await page
        .getByRole("combobox", { name: "Medio 2", exact: true })
        .selectOption("3");
    }
    await page.getByRole("button", { name: "Confirmar venta y pago" }).click();
    await expect(
      page.getByRole("heading", { name: "Venta completada" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("Botella deportiva");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cerrar", exact: true })
      .click();
    await expect(
      page.getByText(mixed ? "10 disponibles" : "11 disponibles", {
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.goto("/recepcion/mi-turno");
  await expect(page.getByText(/110\.00/)).toBeVisible();
});
test("Class reservation for another member and participant state", async ({
  page,
}) => {
  await page.goto("/recepcion/clases");
  await page
    .getByRole("button", { name: "Reservar para socio" })
    .first()
    .click();
  await page.getByRole("button", { name: "Reservar: Lucía Fernández" }).click();
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByRole("status")).toContainText("Reserva registrada");
  await expect(
    page.getByRole("dialog").getByText("Confirmada", { exact: true }),
  ).toBeVisible();
});
test("Reception cannot use Admin endpoints, global finance or another role layout", async ({
  page,
}) => {
  for (const path of ["dashboard/summary", "products/manage"])
    expect((await page.request.get("/api/gymflow/" + path)).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/gymflow/plans", {
        headers: { origin: "http://127.0.0.1:3100" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.delete("/api/gymflow/payments/1")).status()).toBe(
    405,
  );
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/recepcion$/);
});
test("Reception search empty/error recovery and no charge when registering", async ({
  page,
}) => {
  await page.goto("/recepcion/socios");
  await page
    .getByRole("textbox", { name: "Buscar socio", exact: true })
    .fill("NO_MATCH");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sin coincidencias" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Buscar socio", exact: true })
    .fill("SERVER_ERROR");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "No pudimos cargar",
  );
  await page
    .getByRole("textbox", { name: "Buscar socio", exact: true })
    .fill("Lucía");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Abrir ficha: Lucía Fernández" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar socio", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "no activa una membresía ni genera un cobro",
  );
});

test("Reception loading, forbidden and server pagination stay explicit", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/gymflow/members?**", async (route) => {
    await gate;
    await route.fulfill({
      status: 403,
      json: { message: "Acceso no autorizado." },
    });
  });
  await page.goto("/recepcion/socios");
  await expect(
    page.getByRole("status", { name: "Cargando datos" }),
  ).toBeVisible();
  release();
  await expect(page.getByRole("main")).toContainText("Acceso no autorizado.");
  await page.unroute("**/api/gymflow/members?**");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Abrir ficha: Lucía Fernández" }),
  ).toBeVisible();
  const next = page.waitForRequest(
    (r) =>
      r.url().includes("/api/gymflow/members?") &&
      new URL(r.url()).searchParams.get("page") === "2",
  );
  await page.getByRole("button", { name: "Página siguiente" }).click();
  expect(new URL((await next).url()).searchParams.get("pageSize")).toBe("10");
  await expect(page.getByRole("main")).toContainText("Página 2 de 3");
});

test("Renewal links the previous contract without registering a payment", async ({
  page,
}) => {
  await member(page);
  await page.getByRole("button", { name: "Renovar", exact: true }).click();
  await page.getByLabel("Plan vigente").selectOption({ index: 1 });
  const sent = page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/gymflow/memberships") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Confirmar membresía" }).click();
  const body = (await sent).postDataJSON();
  expect(body.previousMembershipId).toBeGreaterThan(0);
  expect(body.requestId).toBeTruthy();
  await expect(page.getByRole("status")).toContainText("Membresía registrada");
  await expect(page.getByRole("status")).toContainText("pago por separado");
});

test("POS retries an uncertain response with the same key and rejects stale stock", async ({
  page,
}) => {
  await page.goto("/recepcion/tienda");
  await page
    .getByRole("combobox", { name: "Sede", exact: true })
    .selectOption("1");
  await page.getByRole("button", { name: "Agregar Botella deportiva" }).click();
  await page.getByRole("button", { name: /^Cobrar S/ }).click();
  await page
    .getByRole("combobox", { name: "Medio 1", exact: true })
    .selectOption("2");
  const requests: unknown[] = [];
  await page.route("**/api/gymflow/store/sales", async (route) => {
    requests.push(route.request().postDataJSON());
    const response = await route.fetch();
    if (requests.length === 1)
      await route.fulfill({
        status: 502,
        json: { message: "Respuesta temporalmente no disponible." },
      });
    else await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Confirmar venta y pago" }).click();
  await expect(page.getByLabel("Importe 1", { exact: true })).toBeDisabled();
  await page
    .getByRole("button", { name: "Confirmar resultado de la solicitud" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Venta completada" }),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await expect(page.getByText("11 disponibles", { exact: true })).toBeVisible();
  await page.unroute("**/api/gymflow/store/sales");
  await page.getByRole("button", { name: "Agregar Botella deportiva" }).click();
  await page.getByRole("button", { name: /^Cobrar S/ }).click();
  await page
    .getByRole("combobox", { name: "Medio 1", exact: true })
    .selectOption("2");
  await page.route("**/api/gymflow/store/sales", (route) =>
    route.fulfill({
      status: 409,
      json: { message: "Stock insuficiente en esta sede." },
    }),
  );
  await page.getByRole("button", { name: "Confirmar venta y pago" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Stock insuficiente",
  );
  await expect(
    page.getByRole("heading", { name: "Venta completada" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Importe 1", { exact: true })).toBeEnabled();
});
