import { afterEach, describe, expect, it, vi } from "vitest";
import { validOrigin } from "@/lib/api/server";

const request = (origin?: string) => ({
  headers: new Headers(origin ? { origin } : {}),
});

afterEach(() => vi.unstubAllEnvs());

describe("request origin protection", () => {
  it("accepts both explicitly configured local addresses", () => {
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
    vi.stubEnv("APP_ADDITIONAL_ORIGINS", " http://localhost:3000, ");
    expect(validOrigin(request("http://127.0.0.1:3000"))).toBe(true);
    expect(validOrigin(request("http://localhost:3000"))).toBe(true);
  });

  it.each([
    undefined,
    "null",
    "https://outside.test",
    "http://localhost:3001",
    "https://localhost:3000",
    "http://localhost:3000.outside.test",
  ])("rejects a missing or unapproved origin: %s", (origin) => {
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
    vi.stubEnv("APP_ADDITIONAL_ORIGINS", "http://localhost:3000");
    expect(validOrigin(request(origin))).toBe(false);
  });

  it("keeps a single-origin deployment restricted to its configured origin", () => {
    vi.stubEnv("APP_ORIGIN", "https://gym.example");
    vi.stubEnv("APP_ADDITIONAL_ORIGINS", "");
    expect(validOrigin(request("https://gym.example"))).toBe(true);
    expect(validOrigin(request("http://localhost:3000"))).toBe(false);
  });

  it("rejects requests when no origins are configured", () => {
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("APP_ADDITIONAL_ORIGINS", "");
    expect(validOrigin(request())).toBe(false);
    expect(validOrigin(request("http://localhost:3000"))).toBe(false);
  });
});
