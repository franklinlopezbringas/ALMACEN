import { it, expect } from "vitest";
import { loginSchema } from "@/lib/auth/validation";
it("accepts the sequential SQL Server Guid used by the real organization", () => {
  expect(
    loginSchema.safeParse({
      email: "fixture@example.test",
      password: "test-only",
      organizationPublicId: "52020FCB-15C9-F111-9E06-7CC2C653952A",
    }).success,
  ).toBe(true);
});
it("rejects malformed organization identifiers", () => {
  expect(
    loginSchema.safeParse({
      email: "fixture@example.test",
      password: "test-only",
      organizationPublicId: "not-a-guid",
    }).success,
  ).toBe(false);
});
