import { describe, it, expect } from "vitest";
import {
  adminPlanSchema,
  adminProductSchema,
  productFormSchema,
  termsSchema,
  membershipSchema,
} from "@/lib/api/admin-contracts";
import { prospectSchema, classSchema } from "@/lib/api/contracts";
import { permittedPath } from "@/lib/api/policy";
describe("controlled Admin API patch", () => {
  it("allows only explicit administrative writes in the same-origin proxy", () => {
    expect(
      permittedPath("PUT", "products/52020FCB-15C9-F111-9E06-7CC2C653952A"),
    ).toBe(true);
    expect(
      permittedPath(
        "POST",
        "plans/52020FCB-15C9-F111-9E06-7CC2C653952A/versions",
      ),
    ).toBe(true);
    expect(
      permittedPath("PATCH", "members/52020FCB-15C9-F111-9E06-7CC2C653952A"),
    ).toBe(false);
    expect(
      permittedPath("DELETE", "plans/52020FCB-15C9-F111-9E06-7CC2C653952A"),
    ).toBe(false);
  });
  it("rejects negative inventory metadata and keeps stock outside the write contract", () => {
    const data = {
      sku: "DEMO",
      name: "Bottle",
      price: 20,
      currencyCode: "PEN",
      minimumStock: 2,
      isPublic: false,
      status: "ACTIVE",
      stock: 999,
    };
    expect(productFormSchema.parse(data)).not.toHaveProperty("stock");
    expect(
      productFormSchema.safeParse({ ...data, minimumStock: -1 }).success,
    ).toBe(false);
    expect(
      adminProductSchema.safeParse({
        ...data,
        publicId: "id",
        rowVersion: "version",
        stock: null,
      }).success,
    ).toBe(true);
  });
  it("validates plan duration and separates versions from metadata", () => {
    const terms = {
      price: 120,
      currencyCode: "PEN",
      durationValue: 1,
      durationUnit: "MONTH",
      freezeDaysLimit: 0,
      classReservationLimit: null,
    };
    expect(termsSchema.safeParse(terms).success).toBe(true);
    expect(termsSchema.safeParse({ ...terms, durationValue: 0 }).success).toBe(
      false,
    );
    expect(
      adminPlanSchema.safeParse({
        publicId: "id",
        planId: 1,
        code: "P",
        name: "Plan",
        description: null,
        isPublic: true,
        status: "INACTIVE",
        rowVersion: "version",
        planVersionId: null,
        versionNumber: null,
        terms: null,
      }).success,
    ).toBe(true);
  });
  it("does not silently accept obsolete CRM or class responses", () => {
    expect(prospectSchema.safeParse({}).success).toBe(false);
    expect(
      classSchema.safeParse({
        classSessionId: 1,
        className: "Class",
        startsAtUtc: "today",
        endsAtUtc: "later",
        capacity: 5,
        reserved: 2,
        status: "OPEN",
      }).success,
    ).toBe(false);
    expect(membershipSchema.safeParse({ status: "ACTIVE" }).success).toBe(
      false,
    );
  });
});
