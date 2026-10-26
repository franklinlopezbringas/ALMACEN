import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("Reception operates real member, renewal, partial/mixed payments, cash and POS", async ({
  page,
}) => {
  test.setTimeout(120000);
  const fixture = JSON.parse(
    readFileSync("../backend/artifacts/reception-fixture.json", "utf8"),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/login");
  await page
    .getByLabel("Correo electrónico")
    .fill(process.env.GYMFLOW_E2E_RECEPTION_EMAIL!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.GYMFLOW_E2E_RECEPTION_PASSWORD!);
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page).toHaveURL(/\/recepcion$/);
  // Recover only the dedicated fictitious drawer after an interrupted test run.
  const leftover = (
    await (
      await page.request.get(
        "/api/gymflow/cash-shifts/me?status=OPEN&pageSize=100",
      )
    ).json()
  ).items.find(
    (s: { registerName: string }) => s.registerName === "Caja de práctica",
  );
  if (leftover)
    await page.request.post(
      `/api/gymflow/cash-shifts/${leftover.cashShiftId}/close`,
      {
        headers: { origin: "http://127.0.0.1:3001" },
        data: {
          countedAmount: leftover.expectedAmount,
          closingNotes: "Recuperación de prueba local interrumpida.",
        },
      },
    );
  const methods = (
    await (
      await page.request.get("/api/gymflow/payment-methods?pageSize=100")
    ).json()
  ).items as { paymentMethodId: number; code: string; isCash: boolean }[];
  const cash = String(methods.find((m) => m.isCash)!.paymentMethodId);
  const yape = String(methods.find((m) => m.code === "YAPE")!.paymentMethodId);
  const member = async () => {
    await page.goto("/recepcion/socios?ficha=" + fixture.memberPublicId);
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: fixture.memberName }),
    ).toBeVisible();
  };
  await page.goto("/recepcion/mi-turno");
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Caja", exact: true })
    .selectOption(String(fixture.cashRegisterId));
  await page.getByLabel("Fondo inicial").fill("100");
  await page.getByRole("button", { name: "Confirmar apertura" }).click();
  await expect(page.getByRole("status")).toContainText("Caja abierta");
  const own = (
    await (
      await page.request.get(
        "/api/gymflow/cash-shifts/me?status=OPEN&pageSize=100",
      )
    ).json()
  ).items;
  const shift = own.find(
    (s: { registerName: string }) => s.registerName === "Caja de práctica",
  );
  expect(shift).toBeTruthy();
  try {
    await member();
    await page.getByRole("button", { name: "Check-in", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Sede", exact: true })
      .selectOption(String(fixture.branchId));
    await page.getByRole("button", { name: "Confirmar check-in" }).click();
    await expect(page.getByRole("status")).toContainText("Ingreso permitido");
    await member();
    await page.getByRole("button", { name: "Renovar", exact: true }).click();
    await page.getByLabel("Plan vigente").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Confirmar membresía" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Membresía registrada",
    );
    for (const partial of [true, false]) {
      await member();
      await page.getByRole("button", { name: "Cobrar", exact: true }).click();
      await page
        .getByRole("button", { name: "Cobrar esta cuenta" })
        .first()
        .click();
      await page
        .getByRole("combobox", { name: "Sede", exact: true })
        .selectOption(String(fixture.branchId));
      await page
        .getByRole("combobox", { name: "Medio 1", exact: true })
        .selectOption(cash);
      await page
        .getByLabel("Importe 1", { exact: true })
        .fill(partial ? "20" : "10");
      if (!partial) {
        await page
          .getByRole("button", { name: "Agregar medio de pago" })
          .click();
        await page
          .getByRole("combobox", { name: "Medio 2", exact: true })
          .selectOption(yape);
      }
      const drawer = page.getByRole("combobox", { name: "Caja de efectivo" });
      if (await drawer.count())
        await drawer.selectOption(String(shift.cashShiftId));
      await page
        .getByRole("button", { name: "Registrar pago", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Pago registrado" }),
      ).toBeVisible();
    }
    const debts = await (
      await page.request.get(
        "/api/gymflow/receivables?memberId=" + fixture.memberId,
      )
    ).json();
    expect(debts.items).toHaveLength(0);
    await page.goto("/recepcion/tienda");
    await page
      .getByRole("combobox", { name: "Sede", exact: true })
      .selectOption(String(fixture.branchId));
    await page.getByLabel("Buscar producto").fill(fixture.sku);
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await page
      .getByRole("button", { name: "Agregar Botella deportiva térmica" })
      .click();
    await page.getByRole("button", { name: /^Cobrar S/ }).click();
    await page
      .getByRole("combobox", { name: "Medio 1", exact: true })
      .selectOption(yape);
    await page.getByRole("button", { name: "Confirmar venta y pago" }).click();
    await expect(
      page.getByRole("heading", { name: "Venta completada" }),
    ).toBeVisible();
    await page.goto("/recepcion/mi-turno");
    const card = page
      .locator("article")
      .filter({ has: page.getByText("Caja de práctica", { exact: true }) })
      .filter({
        has: page.getByRole("button", { name: "Cerrar caja", exact: true }),
      });
    await card.getByRole("button", { name: "Ver movimientos" }).click();
    await expect(page.getByRole("dialog")).toContainText("2 registros");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cerrar", exact: true })
      .click();
    await card
      .getByRole("button", { name: "Cerrar caja", exact: true })
      .click();
    await page.getByLabel("Efectivo contado").fill("130");
    await page.getByRole("button", { name: "Confirmar cierre" }).click();
    await expect(page.getByRole("status")).toContainText("Diferencia: S/ 0.00");
    for (const route of ["accesos", "clases", "atencion", "pagos-caja"]) {
      await page.goto("/recepcion/" + route);
      await expect(
        page.getByRole("status", { name: "Cargando datos" }),
      ).toHaveCount(0);
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  } finally {
    const current = (
      await (
        await page.request.get(
          "/api/gymflow/cash-shifts/me?status=OPEN&pageSize=100",
        )
      ).json()
    ).items.find(
      (s: { cashShiftId: number }) => s.cashShiftId === shift.cashShiftId,
    );
    if (current)
      await page.request.post(
        `/api/gymflow/cash-shifts/${shift.cashShiftId}/close`,
        {
          headers: { origin: "http://127.0.0.1:3001" },
          data: {
            countedAmount: current.expectedAmount,
            closingNotes: "Cierre de prueba E2E local.",
          },
        },
      );
  }
});
