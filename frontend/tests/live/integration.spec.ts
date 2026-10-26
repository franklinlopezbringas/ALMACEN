import { test, expect } from "@playwright/test";
test("actual API readiness", async ({ request }) => {
  const response = await request.get(
    (process.env.GYMFLOW_API_URL ?? "http://127.0.0.1:5080") + "/health/ready",
  );
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ready" });
});
test("public plan catalog reaches real backend through Next.js", async ({
  page,
  request,
}) => {
  const org = process.env.NEXT_PUBLIC_ORGANIZATION_ID;
  expect(org).toBeTruthy();
  const response = await request.get("/api/gymflow/public/" + org + "/plans");
  expect(response.status()).toBe(200);
  const plans = (await response.json()) as { name: string }[];
  expect(plans.length).toBeGreaterThan(0);
  await page.goto("/planes");
  await expect(
    page.getByRole("heading", { name: plans[0].name, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});
test("real application keeps anonymous users outside administrator", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});
for (const [role, path] of [
  ["ADMIN", "/admin"],
  ["RECEPTION", "/recepcion"],
  ["TRAINER", "/entrenador"],
  ["MEMBER", "/socio"],
]) {
  test(`real login ${role} (requires locally verified credentials)`, async ({
    page,
  }) => {
    const email =
      process.env[`GYMFLOW_E2E_${role}_EMAIL`] ??
      (role === "ADMIN" ? process.env.GYMFLOW_E2E_EMAIL : undefined);
    const password =
      process.env[`GYMFLOW_E2E_${role}_PASSWORD`] ??
      (role === "ADMIN" ? process.env.GYMFLOW_E2E_PASSWORD : undefined);
    test.skip(
      !email || !password,
      "No verified credentials found; no users or passwords were modified.",
    );
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(email!);
    await page.getByLabel("Contraseña", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
    await expect(page).toHaveURL(new RegExp(path + "$"));
    const refreshed = await page.request.post("/api/auth/refresh", {
      headers: { origin: "http://127.0.0.1:3001" },
    });
    expect(refreshed.status()).toBe(200);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(path + "$"));
    if (role === "MEMBER" || role === "TRAINER") {
      const denied = await page.request.get(
        "/api/gymflow/memberships?page=1&pageSize=10",
      );
      expect(denied.status()).toBe(403);
    }
  });
}

test("Admin consumes corrected contracts through the real API and same-origin adapter", async ({
  page,
}) => {
  const login = await page.request.post("/api/auth/login", {
    headers: { origin: "http://127.0.0.1:3001" },
    data: {
      email: process.env.GYMFLOW_E2E_ADMIN_EMAIL,
      password: process.env.GYMFLOW_E2E_ADMIN_PASSWORD,
      organizationPublicId: process.env.NEXT_PUBLIC_ORGANIZATION_ID,
    },
  });
  expect(login.status()).toBe(200);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  for (const [route, endpoint] of [
    ["membresias", "memberships"],
    ["crm", "prospects"],
    ["clases", "classes/sessions"],
    ["catalogo", "products/manage"],
    ["planes", "plans"],
  ]) {
    const response = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/gymflow/${endpoint}?`) &&
        r.request().method() === "GET",
    );
    await page.goto(`/admin/${route}`);
    const actual = await response;
    expect(actual.status()).toBe(200);
    const data = await actual.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.pageSize).toBeLessThanOrEqual(100);
    await expect(
      page.getByRole("status", { name: "Cargando datos" }),
    ).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
