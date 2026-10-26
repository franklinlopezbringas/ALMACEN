import { describe, it, expect, vi } from "vitest";
import { seal, unseal } from "@/lib/auth/crypto";
import { allowedReturnTo, can, homeFor } from "@/lib/auth/permissions";
import { permittedPath } from "@/lib/api/policy";
describe("session integrity", () => {
  it("round trips an encrypted token without exposing plaintext", () => {
    vi.stubEnv("SESSION_SECRET", "fixture-key-only-not-a-demo-credential-1234");
    const sealed = seal("test-token", "access");
    expect(sealed).not.toContain("test-token");
    expect(unseal(sealed, "access")).toBe("test-token");
  });
  it("rejects tampering and cross-cookie replay", () => {
    vi.stubEnv("SESSION_SECRET", "fixture-key-only-not-a-demo-credential-1234");
    const sealed = seal("test-token", "access");
    const data = Buffer.from(sealed, "base64url");
    data[30] ^= 255;
    expect(unseal(data.toString("base64url"), "access")).toBeNull();
    expect(unseal(sealed, "refresh")).toBeNull();
  });
  it("fails closed without a key", () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => seal("token", "access")).toThrow();
  });
});
describe("roles and navigation", () => {
  it.each([
    ["ADMIN", "/admin"],
    ["RECEPTION", "/recepcion"],
    ["TRAINER", "/entrenador"],
    ["MEMBER", "/socio"],
  ])("maps %s only to its experience", (role, path) =>
    expect(homeFor([role])).toBe(path),
  );
  it("rejects unknown roles and missing permission", () => {
    expect(homeFor(["UNKNOWN"])).toBe("/sin-acceso");
    expect(can({ permissions: [] }, "MEMBERS.VIEW")).toBe(false);
  });
  it.each([
    "https://outside.test",
    "//outside.test",
    "/admin",
    "/socio-other",
    "/\\outside.test",
  ])("rejects unsafe return target %s", (path) =>
    expect(allowedReturnTo(path, ["MEMBER"])).toBe("/socio"),
  );
  it("preserves an authorized internal route", () =>
    expect(allowedReturnTo("/admin/socios", ["ADMIN"])).toBe("/admin/socios"));
});
describe("proxy allowlist", () => {
  it.each([
    "../auth/login",
    "https://outside.test",
    "members/../../auth/refresh",
    "automation/jobs",
    "payments/reverse",
  ])("blocks unsupported paths %s", (path) =>
    expect(permittedPath("POST", path)).toBe(false),
  );
  it("allows only supported methods", () => {
    expect(permittedPath("GET", "members")).toBe(true);
    expect(permittedPath("DELETE", "members")).toBe(false);
    expect(permittedPath("POST", "prospects/3/convert")).toBe(true);
  });
});
