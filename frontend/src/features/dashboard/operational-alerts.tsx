"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BellRing } from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { ErrorState, Loading } from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import { can } from "@/lib/auth/permissions";
import { money } from "@/lib/utils";

export function OperationalAlerts({
  summary,
  classes,
}: {
  summary?: Awaited<ReturnType<typeof gymflow.dashboard>>;
  classes?: Awaited<ReturnType<typeof gymflow.classes>>;
}) {
  const user = useSession();
  const crmAllowed = can(user, "PROSPECTS.VIEW");
  const prospects = useQuery({
    queryKey: [user.organizationPublicId, "prospects", "", 1, "NEW"],
    queryFn: ({ signal }) => gymflow.prospects("", 1, signal, "NEW"),
    enabled: crmAllowed,
  });
  const nearCapacity =
    classes?.items.filter(
      (c) => c.capacity > 0 && c.reserved / c.capacity >= 0.8,
    ) ?? [];
  const alerts: { title: string; detail: string; href?: string }[] = [];
  if (
    summary &&
    summary.expiringMembershipsNext7Days > 0 &&
    can(user, "MEMBERSHIPS.VIEW")
  )
    alerts.push({
      title: `${summary.expiringMembershipsNext7Days} membresías por vencer`,
      detail: "Revisa los vencimientos de los próximos 7 días.",
      href: "/admin/membresias",
    });
  if (summary && summary.outstandingReceivables > 0)
    alerts.push({
      title: `${money(summary.outstandingReceivables)} pendientes de cobro`,
      detail:
        "Saldo agregado de cuentas por cobrar. Desglose no disponible en esta vista.",
    });
  if (nearCapacity.length)
    alerts.push({
      title: "Clases con alta ocupación",
      detail: `${nearCapacity.map((c) => c.className).join(", ")}. Al menos 80 % de plazas reservadas en las próximas ${classes!.items.length} sesiones consultadas.`,
      href: "/admin/clases",
    });
  if (prospects.data && prospects.data.total > 0)
    alerts.push({
      title: `${prospects.data.total} ${prospects.data.total === 1 ? "prospecto nuevo" : "prospectos nuevos"}`,
      detail: "Revisa contactos y su próximo seguimiento en CRM.",
      href: "/admin/crm?estado=NEW",
    });
  return (
    <section aria-label="Atención operativa" className="space-y-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <BellRing size={18} className="text-primary" />
        Atención operativa
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {alerts.map((item) => (
          <article key={item.title} className="panel p-5">
            <h3 className="text-sm font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
            {item.href && (
              <Link
                href={item.href}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary"
              >
                Revisar
                <ArrowUpRight size={16} />
                <span className="sr-only"> {item.title}</span>
              </Link>
            )}
          </article>
        ))}
      </div>
      {crmAllowed && prospects.isPending && <Loading />}
      {crmAllowed && prospects.error && (
        <ErrorState error={prospects.error} retry={() => prospects.refetch()} />
      )}
      {!alerts.length && !(crmAllowed && prospects.isPending) && (
        <p className="text-sm text-muted">
          No hay alertas en los datos disponibles. Consulta cada sección para
          revisar su detalle.
        </p>
      )}
    </section>
  );
}
