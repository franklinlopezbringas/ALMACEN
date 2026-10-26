import type { NextRequest } from "next/server";
import { tokens, sessionFromToken } from "@/lib/auth/session";
import { upstream, failure, validOrigin } from "@/lib/api/server";
import { permittedPath } from "@/lib/api/policy";
export const runtime = "nodejs";
async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  if (!permittedPath(request.method, path)) return failure(404);
  if (request.method !== "GET" && !validOrigin(request)) return failure(403);
  const { access } = await tokens();
  if (!path.startsWith("public/")) {
    const user = access && sessionFromToken(access);
    if (!user || user.expiresAt <= Date.now() / 1000) return failure(401);
  }
  try {
    const body = request.method !== "GET" ? await request.text() : undefined;
    if (body && Buffer.byteLength(body) > 32768) return failure(400);
    const result = await upstream(path + request.nextUrl.search, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        ...(access ? { Authorization: "Bearer " + access } : {}),
      },
      body,
    });
    if (!result.ok) return failure(result.status);
    return new Response(result.status === 204 ? null : await result.text(), {
      status: result.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return failure(502);
  }
}
export { handle as GET, handle as POST, handle as PUT };
