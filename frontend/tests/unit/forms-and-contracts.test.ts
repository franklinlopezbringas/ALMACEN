import { describe, it, expect } from "vitest";
import {
  personFormSchema,
  dashboardSchema,
  pageOf,
  memberSchema,
} from "@/lib/api/contracts";
import { queryString } from "@/lib/api/gymflow";
describe("typed API boundary and forms", () => {
  it("accepts optional document fields within the real SQL contract lengths", () => {
    const form = {
      firstName: "Ficticia",
      lastName: "Prueba",
      email: "",
      phone: "",
      documentType: "",
      documentNumber: "",
      notes: "",
    };
    expect(personFormSchema.safeParse(form).success).toBe(true);
    expect(
      personFormSchema.safeParse({
        ...form,
        documentType: "D".repeat(20),
        documentNumber: "X".repeat(40),
      }).success,
    ).toBe(true);
    expect(
      personFormSchema.safeParse({ ...form, documentType: "D".repeat(21) })
        .success,
    ).toBe(false);
    expect(
      personFormSchema.safeParse({ ...form, documentNumber: "X".repeat(41) })
        .success,
    ).toBe(false);
  });
  it("rejects invalid names and email before a mutation", () =>
    expect(
      personFormSchema.safeParse({
        firstName: " ",
        lastName: "a",
        email: "invalid",
        phone: "",
        documentNumber: "",
        notes: "",
      }).success,
    ).toBe(false));
  it("normalizes supported numeric strings at the API boundary", () =>
    expect(
      dashboardSchema.parse({
        activeMembers: "5",
        entriesToday: 1,
        expiringMembershipsNext7Days: "2",
        outstandingReceivables: "120.5",
      }),
    ).toEqual({
      activeMembers: 5,
      entriesToday: 1,
      expiringMembershipsNext7Days: 2,
      outstandingReceivables: 120.5,
    }));
  it("rejects an incompatible collection response", () =>
    expect(
      pageOf(memberSchema).safeParse({
        items: [{ name: "missing-contract" }],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      }).success,
    ).toBe(false));
  it("encodes searches and omits absent parameters", () =>
    expect(
      queryString({ search: "Ana & José", page: 2, status: undefined }),
    ).toBe("?search=Ana+%26+Jos%C3%A9&page=2"));
});
