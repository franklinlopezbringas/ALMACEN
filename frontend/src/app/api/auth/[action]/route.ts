import type { NextRequest } from "next/server";

import {
  clearSession,
  saveSession,
  session,
  tokens,
  type AuthResponse,
} from "@/lib/auth/session";
import { failure, upstream, validOrigin } from "@/lib/api/server";
export const runtime = "nodejs";
import { loginSchema } from "@/lib/auth/validation";
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  if ((await context.params).action !== "session") return failure(404);
  const user = await session();
  return user
    ? Response.json(user, { headers: { "Cache-Control": "no-store" } })
    : failure(401);
}
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  if (!validOrigin(request)) return failure(403);
  const { action } = await context.params;
  if (action === "logout") {
    await clearSession();
    return Response.json({ ok: true });
  }
  if (action !== "login" && action !== "refresh") return failure(404);
  try {
    let body;
    if (action === "login") {
      const raw = await request.text();
      if (raw.length > 8192) return failure(400);
      const parsed = loginSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return failure(400);
      body = { ...parsed.data, deviceName: "GymFlow Web" };
    } else {
      const { refresh } = await tokens();
      if (!refresh) return failure(401);
      body = { refreshToken: refresh };
    }
    const response = await upstream("auth/" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      if (response.status === 401) await clearSession();
      if (response.status === 401 && action === "login")
        return Response.json(
          {
            message:
              "No pudimos iniciar sesión. Revisa tu correo y contraseña.",
          },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
      return failure(response.status);
    }
    await saveSession((await response.json()) as AuthResponse);
    return Response.json(await session(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return failure(502);
  }
}
