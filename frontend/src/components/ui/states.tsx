import {
  ArrowLeft,
  ArrowRight,
  Inbox,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./button";
export function Loading() {
  return (
    <div role="status" aria-label="Cargando datos" className="grid gap-4 py-6">
      {[0, 1, 2].map((x) => (
        <div key={x} className="h-16 animate-pulse rounded-xl bg-canvas" />
      ))}
      <span className="sr-only">Cargando datos…</span>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-200 bg-amber-50 p-6"
    >
      <p className="font-semibold">No pudimos cargar esta información</p>
      <p className="my-2 text-sm text-muted">{error.message}</p>
      <Button variant="secondary" onClick={retry}>
        <RefreshCw />
        Reintentar
      </Button>
    </div>
  );
}
export function Empty({
  title = "Todavía no hay registros",
  description = "Los nuevos registros aparecerán aquí.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 rounded-2xl bg-canvas p-4 text-primary">
        <Inbox size={26} />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
        {description}
      </p>
    </div>
  );
}
export function NoPermission() {
  return (
    <div className="panel p-8 text-center">
      <ShieldCheck className="mx-auto mb-4 text-primary" />
      <h2 className="text-lg font-semibold">Acceso restringido</h2>
      <p className="mt-2 text-muted">
        Tu cuenta no tiene permisos para consultar esta sección.
      </p>
    </div>
  );
}
export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 text-sm text-muted">
      <span>
        {total} {total === 1 ? "registro" : "registros"} · Página {page} de{" "}
        {Math.max(1, totalPages)}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="icon"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Página anterior"
        >
          <ArrowLeft />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Página siguiente"
        >
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
