import { z } from "zod";
import { request, ApiError } from "./client";
import * as c from "./contracts";
import * as a from "./admin-contracts";
import * as r from "./reception-contracts";
import type { components } from "./generated";
const root = "/api/gymflow/";
export const queryString = (
  values: Record<string, string | number | undefined>,
) => {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") p.set(key, String(value));
  return p.size ? "?" + p.toString() : "";
};
async function get<T extends z.ZodType>(
  path: string,
  schema: T,
  signal?: AbortSignal,
): Promise<z.output<T>> {
  const data = await request<unknown>(root + path, { signal });
  const result = schema.safeParse(data);
  if (!result.success)
    throw new ApiError(
      502,
      "La respuesta recibida no es compatible. Intenta actualizar.",
    );
  return result.data;
}
const post = <T>(path: string, data: unknown) =>
  request<T>(root + path, { method: "POST", body: JSON.stringify(data) });
export const gymflow = {
  checkIn: async (data: z.infer<typeof r.checkInSchema>) => {
    const result = await post<unknown>(
      "access/check-in",
      r.checkInSchema.parse(data),
    );
    const parsed = r.checkInResultSchema.safeParse(result);
    if (!parsed.success)
      throw new ApiError(
        502,
        "No pudimos confirmar el resultado del ingreso. Verifica el registro antes de repetirlo.",
      );
    return parsed.data;
  },
  reserveFor: (sessionId: number, memberId: number) =>
    post<void>(`classes/sessions/${sessionId}/reserve/${memberId}`, {}),
  branchProducts: (
    filters: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) =>
    get(
      "products" + queryString({ pageSize: 10, ...filters }),
      c.pageOf(c.productSchema),
      signal,
    ),
  memberships: (
    filters: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) =>
    get(
      "memberships" + queryString({ pageSize: 10, ...filters }),
      c.pageOf(a.membershipSchema),
      signal,
    ),
  branches: (page = 1, signal?: AbortSignal) =>
    get(
      "branches" + queryString({ page, pageSize: 25 }),
      c.pageOf(a.branchSchema),
      signal,
    ),
  participants: (id: number, page = 1, signal?: AbortSignal) =>
    get(
      `classes/sessions/${id}/participants` +
        queryString({ page, pageSize: 10 }),
      c.pageOf(a.participantSchema),
      signal,
    ),
  adminProducts: (
    filters: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) =>
    get(
      "products/manage" + queryString({ pageSize: 10, ...filters }),
      c.pageOf(a.adminProductSchema),
      signal,
    ),
  saveProduct: (data: a.ProductForm & { rowVersion?: string }, id?: string) =>
    request<{ publicId: string }>(
      root + "products" + (id ? "/" + encodeURIComponent(id) : ""),
      { method: id ? "PUT" : "POST", body: JSON.stringify(data) },
    ),
  adminPlans: (
    filters: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) =>
    get(
      "plans" + queryString({ pageSize: 10, ...filters }),
      c.pageOf(a.adminPlanSchema),
      signal,
    ),
  createPlan: (data: a.PlanForm) =>
    post<{ publicId: string }>("plans", { plan: data, terms: data.terms }),
  updatePlan: (
    id: string,
    data: Omit<a.PlanForm, "terms"> & { rowVersion: string },
  ) =>
    request<void>(root + "plans/" + encodeURIComponent(id), {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  publishPlanVersion: (id: string, terms: a.Terms, rowVersion: string) =>
    post<{ planVersionId: number }>(
      `plans/${encodeURIComponent(id)}/versions`,
      { terms, rowVersion },
    ),
  dashboard: (signal?: AbortSignal) =>
    get("dashboard/summary", c.dashboardSchema, signal),
  members: (search = "", page = 1, signal?: AbortSignal) =>
    get(
      "members" + queryString({ search, page, pageSize: 10 }),
      c.pageOf(c.memberSchema),
      signal,
    ),
  member: (id: string, signal?: AbortSignal) =>
    get("members/" + encodeURIComponent(id), c.memberDetailSchema, signal),
  createMember: (data: components["schemas"]["CreateMemberRequest"]) =>
    post<z.output<typeof c.memberDetailSchema>>("members", data),
  prospects: (search = "", page = 1, signal?: AbortSignal, status = "") =>
    get(
      "prospects" + queryString({ search, status, page, pageSize: 10 }),
      c.pageOf(c.prospectSchema),
      signal,
    ),
  createProspect: (data: components["schemas"]["CreateProspectRequest"]) =>
    post<{ prospectId: number }>("prospects", data),
  convertProspect: (id: number) =>
    post<unknown>("prospects/" + id + "/convert", { homeBranchId: null }),
  expiring: (signal?: AbortSignal, days = 7) =>
    get(
      "memberships/expiring" + queryString({ days, take: 100 }),
      z.array(c.expiringSchema),
      signal,
    ),
  classes: (page = 1, signal?: AbortSignal, fromUtc?: string) =>
    get(
      "classes/sessions" + queryString({ page, pageSize: 10, fromUtc }),
      c.pageOf(c.classSchema),
      signal,
    ),
  reserve: (id: number) =>
    post<void>("classes/sessions/" + id + "/reserve/me", {}),
  products: (search = "", page = 1, signal?: AbortSignal) =>
    get(
      "products" + queryString({ search, page, pageSize: 10 }),
      c.pageOf(c.productSchema),
      signal,
    ),
  plans: (org: string, signal?: AbortSignal) =>
    get(
      "public/" + encodeURIComponent(org) + "/plans",
      z.array(c.planSchema),
      signal,
    ),
  notifications: (page = 1, signal?: AbortSignal) =>
    get(
      "notifications/me" + queryString({ page, pageSize: 10 }),
      c.pageOf(c.notificationSchema),
      signal,
    ),
  markRead: (id: number) => post<void>("notifications/" + id + "/read", {}),
  assigned: (page = 1, signal?: AbortSignal) =>
    get(
      "trainer/members" + queryString({ page, pageSize: 10 }),
      c.pageOf(c.assignedSchema),
      signal,
    ),
  rewards: (page = 1, signal?: AbortSignal) =>
    get(
      "loyalty/rewards" + queryString({ page, pageSize: 10 }),
      c.pageOf(c.rewardSchema),
      signal,
    ),
  balance: (signal?: AbortSignal) =>
    get("loyalty/me/balance", c.balanceSchema, signal),
};
