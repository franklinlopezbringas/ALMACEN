import { describe, expect, it } from "vitest";
import {
  checkInSchema,
  splitFormSchema,
  moneyUnits,
  moneyInput,
  utc,
  posResultSchema,
} from "@/lib/api/reception-contracts";
import { permittedPath } from "@/lib/api/policy";
import { classSchema } from "@/lib/api/contracts";

describe("Reception operational contracts", () => {
  it("preserves actual class UTC instants when SQL omits their timezone suffix", () => {
    const parsed = classSchema.parse({
      classSessionId: 1,
      className: "Functional",
      startsAtUtc: "2026-10-22T13:00:00",
      endsAtUtc: "2026-10-22T14:00:00",
      capacity: 10,
      reserved: 2,
      coachName: null,
      availablePlaces: 8,
      status: "OPEN",
    });
    expect(new Date(parsed.startsAtUtc).toISOString()).toBe(
      "2026-10-22T13:00:00.000Z",
    );
    expect(new Date(parsed.endsAtUtc).toISOString()).toBe(
      "2026-10-22T14:00:00.000Z",
    );
  });
  it("validates member and branch identifiers without inferring them from codes", () => {
    expect(
      checkInSchema.safeParse({
        memberId: 1,
        branchId: 0,
        accessMethod: "MANUAL",
        deviceId: null,
      }).success,
    ).toBe(false);
    expect(
      checkInSchema.safeParse({
        memberId: "SOC-1",
        branchId: 1,
        accessMethod: "MANUAL",
        deviceId: null,
      }).success,
    ).toBe(false);
    expect(
      checkInSchema.safeParse({
        memberId: 1,
        branchId: 1,
        accessMethod: "MANUAL",
        deviceId: null,
      }).success,
    ).toBe(true);
  });
  it("retains four-decimal financial precision without float summation errors", () => {
    expect(moneyUnits(0.1) + moneyUnits(0.2)).toBe(moneyUnits(0.3));
    expect(moneyInput.safeParse(35.1234).success).toBe(true);
    expect(moneyInput.safeParse(35.12345).success).toBe(false);
    expect(moneyInput.safeParse(-1).success).toBe(false);
  });
  it("rejects empty, negative or unidentified payment splits", () => {
    expect(splitFormSchema.safeParse({ splits: [] }).success).toBe(false);
    expect(
      splitFormSchema.safeParse({
        splits: [{ paymentMethodId: 0, amount: -1, externalReference: "" }],
      }).success,
    ).toBe(false);
    expect(
      splitFormSchema.safeParse({
        splits: [
          { paymentMethodId: 1, amount: 40, externalReference: "" },
          { paymentMethodId: 2, amount: 80, externalReference: "Yape" },
        ],
      }).success,
    ).toBe(true);
  });
  it("interprets SQL UTC timestamps explicitly and preserves existing offsets", () => {
    expect(utc.parse("2026-10-21T14:00:00")).toBe("2026-10-21T14:00:00Z");
    expect(utc.parse("2026-10-21T14:00:00Z")).toBe("2026-10-21T14:00:00Z");
  });
  it("does not treat a bare order as a paid and completed POS transaction", () => {
    expect(
      posResultSchema.safeParse({ orderPublicId: "test", orderNumber: "POS-1" })
        .success,
    ).toBe(false);
  });
  it("allows only explicit reception operations and never financial deletion", () => {
    for (const path of [
      "store/sales",
      "payments",
      "cash-shifts/1/close",
      "access/check-in/qr",
      "memberships",
    ])
      expect(permittedPath("POST", path)).toBe(true);
    for (const path of ["payments/1", "cash-shifts/1", "store/sales/1"])
      expect(permittedPath("DELETE", path)).toBe(false);
    expect(permittedPath("GET", "cash-shifts/1/movements")).toBe(true);
    expect(permittedPath("POST", "store/sales/../../admin")).toBe(false);
  });
});
