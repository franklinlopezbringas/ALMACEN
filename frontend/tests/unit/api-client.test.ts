import { afterEach, describe, it, expect, vi } from "vitest";
import { request, ApiError } from "@/lib/api/client";
afterEach(() => vi.unstubAllGlobals());
describe("central HTTP client", () => {
  it("coalesces concurrent 401s into one refresh and retries once", async () => {
    let renewed = false;
    let rotations = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (path === "/api/auth/session")
          return Response.json({ expiresAt: 0 });
        if (path === "/api/auth/refresh") {
          rotations++;
          await new Promise((r) => setTimeout(r, 20));
          renewed = true;
          return Response.json({ ok: true });
        }
        return renewed
          ? Response.json({ value: 1 })
          : Response.json({ message: "expired" }, { status: 401 });
      }),
    );
    const results = await Promise.all([
      request("/api/gymflow/members"),
      request("/api/gymflow/classes/sessions"),
      request("/api/gymflow/dashboard/summary"),
    ]);
    expect(results).toEqual([{ value: 1 }, { value: 1 }, { value: 1 }]);
    expect(rotations).toBe(1);
  });
  it("does not refresh or replay a forbidden mutation", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ message: "Sin permiso" }, { status: 403 }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      request("/api/gymflow/members", { method: "POST", body: "{}" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("handles a successful no-content response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await expect(
      request("/api/gymflow/notifications/1/read", { method: "POST" }),
    ).resolves.toBeUndefined();
  });
});
