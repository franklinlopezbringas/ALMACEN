import { cn } from "@/lib/utils";
const labels: Record<string, string> = {
  ACKNOWLEDGED: "Recibido",
  REQUESTED: "Solicitada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  PROCESSED: "Procesada",
  PARTIALLY_REFUNDED: "Reembolso parcial",
  REFUNDED: "Reembolsado",

  ALLOWED: "Permitido",
  DENIED: "Bloqueado",
  EXCEPTION: "Excepción autorizada",
  CLOSED: "Cerrada",
  REVIEW_REQUIRED: "Revisar diferencia",
  COMPLETED: "Completado",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  BLOCKED: "Bloqueado",
  EXPIRED: "Vencida",
  SCHEDULED: "Programada",
  OPEN: "Abierta",
  CANCELLED: "Cancelada",
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  TRIAL_SCHEDULED: "Prueba programada",
  QUALIFIED: "Calificado",
  ARCHIVED: "Archivado",
  FROZEN: "Congelada",
  INTERESTED: "Interesado",
  WON: "Convertido",
  LOST: "No continuó",
  PENDING: "Pendiente",
  READ: "Leído",
  UNREAD: "Sin leer",
  CONFIRMED: "Confirmada",
  ATTENDED: "Asistió",
  WAITLISTED: "En espera",
  NO_SHOW: "No asistió",
};
export function Badge({ status }: { status: string }) {
  const positive = [
    "ALLOWED",
    "CLOSED",
    "COMPLETED",
    "ACTIVE",
    "WON",
    "OPEN",
    "READ",
    "CONFIRMED",
    "ATTENDED",
  ].includes(status);
  const negative = [
    "DENIED",
    "BLOCKED",
    "EXPIRED",
    "CANCELLED",
    "LOST",
  ].includes(status);
  return (
    <span
      className={cn(
        "inline-flex self-start items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        positive
          ? "bg-emerald-50 text-emerald-800"
          : negative
            ? "bg-rose-50 text-rose-800"
            : "bg-amber-50 text-amber-800",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {labels[status] ?? status}
    </span>
  );
}
