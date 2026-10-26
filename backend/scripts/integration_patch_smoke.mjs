// Local demo HTTP checks. No credentials/tokens/bodies are logged.
// Writes only dedicated inactive, nonpublic DEMO-PATCH catalog records; never deletes history.
import { loadEnvFile } from "node:process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFile(resolve(root, "frontend/.env.local"));
const origin = process.env.GYMFLOW_API_URL;
if (origin !== "http://127.0.0.1:5080") throw Error("This smoke is restricted to the approved local API.");
const checks = [];
function check(name, ok) { checks.push({ name, pass: !!ok }); if (!ok) throw Error(`Failed check: ${name}`); }
async function http(path, token, method = "GET", body, status = 200) {
  const response = await fetch(origin + "/api/v1/" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  check(`${method} ${path.split("?")[0]} -> ${status}`, response.status === status);
  return response.status === 204 || response.status >= 400 ? null : response.json();
}
async function race(path, token, method, body) {
  const statuses = await Promise.all([0, 1].map(async () => {
    const response = await fetch(origin + "/api/v1/" + path, { method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    await response.arrayBuffer();
    return response.status;
  }));
  check(`concurrent ${method} ${path}: one success and one conflict`, statuses.filter(s => s === 200).length === 1 && statuses.filter(s => s === 409).length === 1);
}
try {
  const sessions = {};
  for (const role of ["ADMIN", "RECEPTION", "TRAINER", "MEMBER"]) {
    sessions[role] = await http("auth/login", null, "POST", { email: process.env[`GYMFLOW_E2E_${role}_EMAIL`], password: process.env[`GYMFLOW_E2E_${role}_PASSWORD`], organizationPublicId: process.env.NEXT_PUBLIC_ORGANIZATION_ID, deviceName: "Controlled local patch smoke" });
    const claims = JSON.parse(Buffer.from(sessions[role].accessToken.split(".")[1], "base64url").toString());
    const roles = claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ?? claims.role;
    check(`real ${role} role claim`, Array.isArray(roles) ? roles.includes(role) : roles === role);
  }
  const admin = sessions.ADMIN.accessToken;
  const branches = await http("branches?page=1&pageSize=100", admin);
  check("demo branch catalog", branches.items.length > 0);
  const memberships = await http("memberships?page=1&pageSize=1", admin);
  check("membership server pagination", memberships.items.length <= 1 && memberships.pageSize === 1);
  for (const status of ["ACTIVE", "FROZEN", "EXPIRED", "CANCELLED", "PENDING"]) {
    const result = await http(`memberships?status=${status}&pageSize=2`, admin);
    check(`membership ${status} filter`, result.items.every(x => x.status === status));
  }
  const crm = await http("prospects?pageSize=2", admin);
  check("CRM extended contract", crm.items.every(x => "interestedPlan" in x && "lastContactAtUtc" in x));
  const classes = await http("classes/sessions?fromUtc=2020-01-01T00:00:00Z&pageSize=2", admin);
  check("class extended contract", classes.items.every(x => "coachName" in x && x.availablePlaces === Math.max(0, x.capacity - x.reserved)));
  if (classes.items.length) {
    const path = `classes/sessions/${classes.items[0].classSessionId}/participants?pageSize=1`;
    const participants = await http(path, admin);
    check("participants are paginated", participants.pageSize === 1 && participants.items.length <= 1);
    await http(path, sessions.MEMBER.accessToken, "GET", null, 403);
  }
  await http("memberships", sessions.MEMBER.accessToken, "GET", null, 403);
  await http("plans", sessions.MEMBER.accessToken, "GET", null, 403);
  await http("products", sessions.RECEPTION.accessToken, "POST", {}, 403);
  await http("plans", sessions.RECEPTION.accessToken, "POST", {}, 403);
  await http("products/manage?branchId=9223372036854775806", admin, "GET", null, 404);
  const code = "DEMO-PATCH-20261020";
  let products = await http(`products/manage?search=${code}&branchId=${branches.items[0].branchId}`, admin);
  const productData = { sku: code, name: "Botella de validacion local", price: 25, currencyCode: "PEN", minimumStock: 3, isPublic: false, status: "INACTIVE" };
  if (!products.items.length) { await http("products", admin, "POST", productData); products = await http(`products/manage?search=${code}&branchId=${branches.items[0].branchId}`, admin); }
  const product = products.items[0];
  await http(`products/${product.publicId}`, admin, "PUT", { ...productData, rowVersion: product.rowVersion });
  await http(`products/${product.publicId}`, admin, "PUT", { ...productData, rowVersion: product.rowVersion }, 409);
  const afterProduct = (await http(`products/manage?search=${code}&branchId=${branches.items[0].branchId}`, admin)).items[0];
  check("product edit preserves stock", afterProduct.stock === product.stock && afterProduct.minimumStock === 3);
  await race(`products/${product.publicId}`, admin, "PUT", { ...productData, rowVersion: afterProduct.rowVersion });
  const planData = { code, name: "Plan de validacion local", description: "Ficticio, interno e inactivo; prueba del patch.", isPublic: false, status: "INACTIVE" };
  const terms = { price: 80, currencyCode: "PEN", durationValue: 1, durationUnit: "MONTH", freezeDaysLimit: 0, classReservationLimit: null };
  let plans = await http(`plans?search=${code}`, admin);
  if (!plans.items.length) { await http("plans", admin, "POST", { plan: planData, terms }); plans = await http(`plans?search=${code}`, admin); }
  let plan = plans.items[0];
  await http(`plans/${plan.publicId}`, admin, "PUT", { ...planData, rowVersion: plan.rowVersion }, 204);
  await http(`plans/${plan.publicId}`, admin, "PUT", { ...planData, rowVersion: plan.rowVersion }, 409);
  plan = (await http(`plans?search=${code}`, admin)).items[0];
  if (plan.terms.price !== 100) await http(`plans/${plan.publicId}/versions`, admin, "POST", { terms: { ...terms, price: 100, freezeDaysLimit: 5 }, rowVersion: plan.rowVersion });
  const afterPlan = (await http(`plans?search=${code}`, admin)).items[0];
  check("new plan version is current", afterPlan.terms.price === 100 && afterPlan.versionNumber >= 2 && afterPlan.status === "INACTIVE");
  await race(`plans/${plan.publicId}/versions`, admin, "POST", { terms: afterPlan.terms, rowVersion: afterPlan.rowVersion });
  const afterRace = (await http(`plans?search=${code}`, admin)).items[0];
  check("concurrent publication creates exactly one version", afterRace.versionNumber === afterPlan.versionNumber + 1);
  const refreshed = await http("auth/refresh", null, "POST", { refreshToken: sessions.ADMIN.refreshToken });
  check("refresh rotates credentials", !!refreshed.accessToken && refreshed.refreshToken !== sessions.ADMIN.refreshToken);
  await http("auth/refresh", null, "POST", { refreshToken: sessions.ADMIN.refreshToken }, 401);
} finally {
  await writeFile(resolve(root, "backend/artifacts/patch-smoke.json"), JSON.stringify(checks, null, 2));
  console.log(`${checks.filter(x => x.pass).length}/${checks.length} HTTP checks passed. No credentials logged.`);
}
