"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Ticket } from "lucide-react";
import { gymflow } from "@/lib/api/gymflow";
import { money } from "@/lib/utils";
import { Empty, ErrorState, Loading } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
export function PlanCatalog({
  organization,
  administrative = false,
}: {
  organization: string;
  administrative?: boolean;
}) {
  const [selected, setSelected] = useState<
    Awaited<ReturnType<typeof gymflow.plans>>[number] | null
  >(null);
  const q = useQuery({
    queryKey: [organization, "plans"],
    queryFn: ({ signal }) => gymflow.plans(organization, signal),
    enabled: !!organization,
  });
  if (!organization)
    return (
      <Empty
        title="Encuentra tu gimnasio"
        description="Solicita a la administración el enlace de sus planes."
      />
    );
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data?.length)
    return (
      <div className="panel">
        <Empty
          title="El próximo paso, a tu medida"
          description="Consulta con tu gimnasio para conocer sus planes disponibles."
        />
      </div>
    );
  const units: Record<string, [string, string]> = {
    DAY: ["día", "días"],
    DAYS: ["día", "días"],
    WEEK: ["semana", "semanas"],
    WEEKS: ["semana", "semanas"],
    MONTH: ["mes", "meses"],
    MONTHS: ["mes", "meses"],
    YEAR: ["año", "años"],
    YEARS: ["año", "años"],
  };
  return (
    <>
      {administrative && (
        <p className="mb-5 text-sm text-muted">
          Planes publicados · consulta comercial de la oferta actual.
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {q.data.map((p) => (
          <article
            className="panel relative flex flex-col p-7"
            key={p.publicId}
          >
            <span className="mb-6 grid size-12 place-items-center rounded-2xl bg-canvas text-primary">
              <Ticket size={25} />
            </span>
            <p className="eyebrow text-muted">{p.code}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {p.name}
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              {p.description ?? "Un plan para acompañar tu entrenamiento."}
            </p>
            {administrative && (
              <p className="mt-6 text-xs text-muted">Precio vigente</p>
            )}
            <p
              className={`${administrative ? "mt-2" : "mt-8"} mb-2 text-4xl font-semibold tracking-[-1.5px]`}
            >
              {money(p.price, p.currencyCode)}
            </p>
            <p className="text-xs text-muted">
              por {p.durationValue}{" "}
              {units[p.durationUnit]?.[p.durationValue === 1 ? 0 : 1] ??
                p.durationUnit.toLowerCase()}
            </p>
            <div className="mt-7 space-y-3 border-t border-line pt-6 text-sm">
              <p className="flex items-center gap-2">
                <Check size={16} className="text-primary" />
                Duración definida desde tu inicio
              </p>
              {p.freezeDaysLimit > 0 && (
                <p className="flex items-center gap-2">
                  <Check size={16} className="text-primary" />
                  {p.freezeDaysLimit} {p.freezeDaysLimit === 1 ? "día" : "días"}{" "}
                  de congelamiento
                </p>
              )}
            </div>
            {administrative ? (
              <div className="mt-auto pt-6">
                <Button
                  variant="secondary"
                  className="w-full"
                  aria-label={`Ver condiciones ${p.name}`}
                  onClick={() => setSelected(p)}
                >
                  Ver condiciones
                </Button>
              </div>
            ) : (
              <p className="mt-auto pt-7 text-xs text-muted">
                Inscripción y condiciones en recepción.
              </p>
            )}
          </article>
        ))}
      </div>
      {administrative && (
        <Dialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={selected?.name ?? "Condiciones del plan"}
          description="Condiciones vigentes del plan publicado."
        >
          {selected && (
            <dl className="space-y-5 text-sm">
              {[
                ["Código", selected.code],
                [
                  "Precio vigente",
                  money(selected.price, selected.currencyCode),
                ],
                [
                  "Duración",
                  `${selected.durationValue} ${units[selected.durationUnit]?.[selected.durationValue === 1 ? 0 : 1] ?? selected.durationUnit.toLowerCase()}`,
                ],
                [
                  "Congelamiento permitido",
                  `${selected.freezeDaysLimit} ${selected.freezeDaysLimit === 1 ? "día" : "días"}`,
                ],
                ["Descripción", selected.description ?? "Sin descripción"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-1">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Dialog>
      )}
    </>
  );
}
