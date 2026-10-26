import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const origin = "http://127.0.0.1:3001";
const fixture = () =>
  JSON.parse(
    readFileSync("../backend/artifacts/reception-fixture.json", "utf8"),
  );
async function login(page: Page, role = "RECEPTION") {
  await page.goto(origin + "/login");
  await page
    .getByLabel("Correo electrónico")
    .fill(process.env[`GYMFLOW_E2E_${role}_EMAIL`]!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env[`GYMFLOW_E2E_${role}_PASSWORD`]!);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page).toHaveURL(role === "ADMIN" ? /\/admin$/ : /\/recepcion$/);
}
async function post(page: Page, path: string, data: unknown, status = 200) {
  const r = await page.request.post(origin + "/api/gymflow/" + path, {
    headers: { origin },
    data,
  });
  expect(r.status(), path).toBe(status);
  return status === 204 ? null : r.json();
}
async function get(page: Page, path: string) {
  const r = await page.request.get(origin + "/api/gymflow/" + path);
  expect(r.ok(), path).toBe(true);
  return r.json();
}
const lima = (date: Date) =>
  new Date(date.getTime() - 5 * 3600000).toISOString().slice(0, 16);
test("Closure: handoff, incident, messaging and access approval preserve permissions", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await login(page);
  const f = fixture();
  const suffix = randomUUID().slice(0, 8);
  await page.goto("/recepcion/mi-turno");
  await page
    .getByRole("button", { name: "Entregar turno", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Sede", { exact: false })
    .selectOption(String(f.branchId));
  await dialog
    .getByLabel("Notas de entrega")
    .fill("Continuar seguimiento de atención " + suffix);
  await dialog
    .getByLabel("Pendientes")
    .fill("Confirmar recepción de la solicitud de acceso.");
  await dialog.getByRole("button", { name: "Confirmar entrega" }).click();
  await expect(dialog).toHaveCount(0);
  const handoff = page
    .getByRole("listitem")
    .filter({ hasText: "Continuar seguimiento de atención " + suffix });
  await handoff.getByRole("button", { name: "Aceptar entrega" }).click();
  await expect(handoff).toContainText("Recibido");
  const member = await post(
    page,
    "members",
    { firstName: "Elisa", lastName: "Morell", homeBranchId: f.branchId },
    201,
  );
  await page.goto("/recepcion/socios?ficha=" + member.publicId);
  await page
    .getByRole("button", { name: "Crear incidencia", exact: true })
    .click();
  await page.getByLabel("Categoría", { exact: false }).selectOption("ACCESS");
  await page
    .getByLabel("Asunto", { exact: false })
    .fill("Revisión de ingreso " + suffix);
  await page
    .getByLabel("Descripción", { exact: false })
    .fill("La socia solicita revisar su acceso antes de ingresar.");
  await page.getByRole("button", { name: "Registrar incidencia" }).click();
  await expect(page.getByRole("status")).toContainText("Operación registrada");
  await page.goto("/recepcion/atencion?tab=incidencias");
  const incident = page
    .getByRole("listitem")
    .filter({ hasText: "Revisión de ingreso " + suffix });
  await incident.getByRole("button", { name: "Ver conversación" }).click();
  await page
    .getByLabel("Respuesta", { exact: false })
    .fill("Solicitud recibida. Se revisará con administración.");
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Solicitud recibida. Se revisará con administración.",
  );
  await page.goto("/recepcion/socios?ficha=" + member.publicId);
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await page
    .getByLabel("Sede", { exact: true })
    .selectOption(String(f.branchId));
  await page.getByRole("button", { name: "Confirmar check-in" }).click();
  await expect(
    page.getByText("Ingreso bloqueado", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Motivo", { exact: false })
    .fill("Revisión de alta de socia ficticia");
  await page
    .getByLabel("Vigencia desde", { exact: false })
    .fill(lima(new Date(Date.now() - 60000)));
  await page
    .getByLabel("Vigencia hasta", { exact: false })
    .fill(lima(new Date(Date.now() + 3600000)));
  await page.getByRole("button", { name: "Solicitar revisión" }).click();
  await expect(
    page.getByText("Operación registrada correctamente."),
  ).toBeVisible();
  const ex = (await get(page, "access/exceptions?memberId=" + member.memberId))
    .items[0];
  await post(
    page,
    `access/exceptions/${ex.accessExceptionId}/review`,
    { status: "APPROVED" },
    403,
  );
  const before = (await get(page, "access/events?memberId=" + member.memberId))
    .total;
  const ctx = await browser.newContext({ baseURL: origin });
  const admin = await ctx.newPage();
  await login(admin, "ADMIN");
  await post(
    admin,
    `access/exceptions/${ex.accessExceptionId}/review`,
    { status: "APPROVED" },
    204,
  );
  await ctx.close();
  expect(
    (await get(page, "access/events?memberId=" + member.memberId)).total,
  ).toBe(before);
  await page.goto("/recepcion/socios?ficha=" + member.publicId);
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await page
    .getByLabel("Sede", { exact: true })
    .selectOption(String(f.branchId));
  await page.getByRole("button", { name: "Confirmar check-in" }).click();
  await expect(
    page.getByText("Ingreso permitido", { exact: true }),
  ).toBeVisible();
});
test("Closure: return request, authorized approval, mixed refund and responsive views", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await login(page);
  const f = fixture();
  const context = await get(page, "reception/context");
  const leftovers = (
    await get(page, "cash-shifts/me?status=OPEN&pageSize=100")
  ).items.filter(
    (s: { registerName: string }) => s.registerName === "Caja de práctica",
  );
  for (const s of leftovers)
    await post(page, `cash-shifts/${s.cashShiftId}/close`, {
      countedAmount: s.expectedAmount,
      closingNotes: "Recuperación local de prueba.",
    });
  const shift = await post(
    page,
    "cash-shifts/open",
    {
      cashRegisterId: f.cashRegisterId,
      employeeId: context.employeeId,
      openingAmount: 100,
      openingNotes: "Devolución de demostración.",
    },
    201,
  );
  try {
    const methods = (await get(page, "payment-methods?pageSize=100")).items;
    const cash = methods.find((m: { isCash: boolean }) => m.isCash),
      yape = methods.find((m: { code: string }) => m.code === "YAPE");
    const sale = await post(page, "store/sales", {
      requestId: randomUUID(),
      branchId: f.branchId,
      cashShiftId: shift.cashShiftId,
      currencyCode: "PEN",
      items: [
        {
          productPublicId: f.productPublicId,
          quantity: 1,
          expectedUnitPrice: 35,
        },
      ],
      splits: [
        { paymentMethodId: cash.paymentMethodId, amount: 10 },
        { paymentMethodId: yape.paymentMethodId, amount: 25 },
      ],
    });
    await page.goto("/recepcion/tienda");
    await page
      .getByRole("button", { name: "Solicitar devolución", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: "Número de orden" })
      .fill(sale.orderNumber);
    await dialog.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "Seleccionar producto" }),
    ).toHaveCount(1);
    await dialog.getByRole("button", { name: "Seleccionar producto" }).click();
    await dialog.getByLabel("Cantidad a devolver", { exact: false }).fill("1");
    await dialog
      .getByLabel("Motivo de devolución", { exact: false })
      .fill("Cambio solicitado en mostrador.");
    await dialog.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(dialog).toHaveCount(0);
    const item = (await get(page, "store/returns?pageSize=1")).items[0];
    const ctx = await browser.newContext({ baseURL: origin });
    const admin = await ctx.newPage();
    await login(admin, "ADMIN");
    await admin.goto("/admin/solicitudes");
    const row = admin
      .getByRole("listitem")
      .filter({ hasText: `Devolución #${item.productReturnId} ·` });
    await row.getByRole("button", { name: "Aprobar devolución" }).click();
    await expect(row).toContainText("Aprobada");
    await ctx.close();
    await page.reload();
    const approved = page
      .getByRole("listitem")
      .filter({ hasText: `Devolución #${item.productReturnId} ·` });
    await approved.getByRole("button", { name: "Registrar reembolso" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Efectivo · saldo", { exact: false }).fill("10");
    await dialog.getByLabel("Yape · saldo", { exact: false }).fill("25");
    await dialog
      .getByLabel("Caja para salida de efectivo", { exact: false })
      .selectOption(String(shift.cashShiftId));
    await dialog.getByRole("button", { name: "Confirmar reembolso" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(approved).toContainText("Procesada");
    const movements = (
      await get(page, `cash-shifts/${shift.cashShiftId}/movements`)
    ).items;
    expect(
      movements
        .filter((m: { movementType: string }) => m.movementType === "REFUND")
        .reduce((s: number, m: { amount: number }) => s + m.amount, 0),
    ).toBe(10);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [route, name] of [
        ["mi-turno", "handoff"],
        ["atencion?tab=incidencias", "incidencias"],
        ["atencion?tab=mensajes", "mensajes"],
        ["accesos", "excepciones"],
        ["tienda", "devoluciones"],
        ["clases", "clases"],
      ]) {
        await page.goto("/recepcion/" + route);
        await expect(
          page.getByRole("status", { name: "Cargando datos" }),
        ).toHaveCount(0);
        await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await page.screenshot({
          path: `artifacts/reception-closure-review/${width}/${name}.png`,
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
  } finally {
    const current = (
      await get(page, "cash-shifts/me?status=OPEN&pageSize=100")
    ).items.find(
      (s: { cashShiftId: number }) => s.cashShiftId === shift.cashShiftId,
    );
    if (current)
      await post(page, `cash-shifts/${shift.cashShiftId}/close`, {
        countedAmount: current.expectedAmount,
        closingNotes: "Validación de devolución conciliada.",
      });
  }
});
