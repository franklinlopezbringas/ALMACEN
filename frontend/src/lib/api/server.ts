import type { NextRequest } from "next/server";
export function validOrigin(request: NextRequest) {
  return request.headers.get("origin") === process.env.APP_ORIGIN;
}
export async function upstream(path: string, init: RequestInit = {}) {
  const origin = process.env.GYMFLOW_API_URL;
  if (!origin) throw new Error("GYMFLOW_API_URL missing");
  return fetch(new URL("/api/v1/" + path, origin), {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
}
export function failure(status: number) {
  const message =
    status === 401
      ? "Tu sesión terminó. Vuelve a ingresar."
      : status === 403
        ? "No tienes permisos para realizar esta acción."
        : status === 404
          ? "No encontramos el registro solicitado."
          : status === 409
            ? "No se pudo completar la operación. Revisa los datos o actualiza la página."
            : status === 429
              ? "Demasiados intentos. Espera un minuto y vuelve a intentar."
              : status === 400
                ? "Revisa los datos del formulario."
                : "No pudimos conectar con GymFlow. Inténtalo nuevamente.";
  return Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
