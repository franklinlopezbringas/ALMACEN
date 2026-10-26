import type { UserSession } from "@/lib/auth/permissions";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
let refreshFlight: Promise<Response> | null = null;
async function refresh() {
  if (!refreshFlight) {
    const run = async () => {
      const current = await fetch("/api/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (current.ok) {
        const user = (await current.json()) as UserSession;
        if (user.expiresAt > Date.now() / 1000 + 30) return current;
      }
      return fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
      });
    };
    refreshFlight = (async () =>
      await (typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks.request("gymflow-session-refresh", run)
        : run()))().finally(() => {
      refreshFlight = null;
    });
  }
  return refreshFlight;
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (response.status === 401 && retry && path.startsWith("/api/gymflow/")) {
    const renewed = await refresh();
    if (renewed.ok) return request<T>(path, options, false);
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("gymflow:session-expired"));
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body.message ?? "No pudimos completar la solicitud.",
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
export const authApi = {
  login: (data: {
    email: string;
    password: string;
    organizationPublicId: string;
  }) =>
    request<UserSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
};
