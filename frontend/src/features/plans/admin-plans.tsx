"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ticket } from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  Empty,
  ErrorState,
  Loading,
  Pagination,
  NoPermission,
} from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import { can } from "@/lib/auth/permissions";
import { money } from "@/lib/utils";
import {
  createPlanFormSchema,
  type PlanForm,
  type AdminPlan,
  type Terms,
} from "@/lib/api/admin-contracts";
const units: Record<string, [string, string]> = {
  DAY: ["día", "días"],
  WEEK: ["semana", "semanas"],
  MONTH: ["mes", "meses"],
  YEAR: ["año", "años"],
};
const initialTerms: Terms = {
  price: 0,
  currencyCode: "PEN",
  durationValue: 1,
  durationUnit: "MONTH",
  freezeDaysLimit: 0,
  classReservationLimit: null,
};
export function AdminPlans() {
  const user = useSession();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{
    plan?: AdminPlan;
    mode: "create" | "metadata" | "version";
  } | null>(null);
  const [selected, setSelected] = useState<AdminPlan | null>(null);
  const q = useQuery({
    queryKey: [user.organizationPublicId, "admin-plans", page, status, search],
    queryFn: ({ signal }) =>
      gymflow.adminPlans({ page, status, search }, signal),
    enabled: can(user, "MEMBERSHIPS.MANAGE"),
  });
  const allowed = can(user, "SETTINGS.MANAGE");
  if (!can(user, "MEMBERSHIPS.MANAGE")) return <NoPermission />;
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Oferta actual e historial de versiones conservado.
        </p>
        {allowed && (
          <Button onClick={() => setEditor({ mode: "create" })}>
            Crear plan
          </Button>
        )}
      </div>
      <form
        className="panel mb-5 flex flex-wrap gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(draft.trim());
          setPage(1);
        }}
      >
        <input
          className="field min-w-0 flex-1"
          placeholder="Nombre o código"
          aria-label="Buscar planes"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button variant="secondary">Buscar</Button>
        <select
          className="field w-auto"
          aria-label="Estado del plan"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos</option>
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
          <option value="ARCHIVED">Archivados</option>
        </select>
      </form>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <div className="panel">
          <Empty title="Sin planes para estos filtros" />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {q.data.items.map((p) => (
            <article
              className="panel relative flex flex-col p-7"
              key={p.publicId}
            >
              <div className="mb-6 flex justify-between gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-canvas text-primary">
                  <Ticket size={25} />
                </span>
                <Badge status={p.status} />
              </div>
              <p className="eyebrow text-muted">{p.code}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {p.name}
              </h2>
              <p className="mt-4 text-sm leading-6 text-muted">
                {p.description}
              </p>
              {p.terms ? (
                <>
                  <p className="mt-6 text-xs text-muted">Precio vigente</p>
                  <p className="mb-2 mt-2 text-4xl font-semibold tracking-[-1.5px]">
                    {money(p.terms.price, p.terms.currencyCode)}
                  </p>
                  <p className="text-xs text-muted">
                    por {p.terms.durationValue}{" "}
                    {
                      units[p.terms.durationUnit][
                        p.terms.durationValue === 1 ? 0 : 1
                      ]
                    }
                  </p>
                  <div className="mt-7 space-y-3 border-t border-line pt-6 text-sm">
                    <p>{p.terms.freezeDaysLimit} días de congelamiento</p>
                    <p>{p.isPublic ? "Publicado" : "Uso interno"}</p>
                  </div>
                </>
              ) : (
                <p className="my-6 text-sm text-muted">Sin versión vigente</p>
              )}
              <div className="mt-auto space-y-2 pt-6">
                <Button
                  variant="secondary"
                  className="w-full"
                  aria-label={`Ver condiciones ${p.name}`}
                  onClick={() => setSelected(p)}
                >
                  Ver condiciones
                </Button>
                {allowed && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditor({ plan: p, mode: "metadata" })}
                      aria-label={`Editar plan ${p.name}`}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditor({ plan: p, mode: "version" })}
                      aria-label={`Nueva versión ${p.name}`}
                    >
                      Nueva versión
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {q.data && (
        <div className="mt-5">
          <Pagination
            page={page}
            totalPages={q.data.totalPages}
            total={q.data.total}
            onPage={setPage}
          />
        </div>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        title={
          editor?.mode === "create"
            ? "Crear plan"
            : editor?.mode === "version"
              ? "Nueva versión del plan"
              : "Editar plan"
        }
        description={
          editor?.mode === "version"
            ? "Las condiciones se aplicarán desde hoy a nuevas contrataciones. Los contratos anteriores no cambian."
            : "Datos comerciales, publicación y estado."
        }
      >
        {editor && <PlanEditor {...editor} onClose={() => setEditor(null)} />}
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.name ?? "Condiciones"}
        description="Condiciones de la versión vigente."
      >
        {selected && (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-muted">Descripción</dt>
              <dd>{selected.description ?? "Sin descripción"}</dd>
            </div>
            {selected.terms && (
              <>
                <div>
                  <dt className="text-muted">Duración</dt>
                  <dd>
                    {selected.terms.durationValue}{" "}
                    {
                      units[selected.terms.durationUnit][
                        selected.terms.durationValue === 1 ? 0 : 1
                      ]
                    }
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Congelamiento</dt>
                  <dd>{selected.terms.freezeDaysLimit} días</dd>
                </div>
                <div>
                  <dt className="text-muted">Límite de reservas</dt>
                  <dd>
                    {selected.terms.classReservationLimit ??
                      "Sin límite definido"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Precio vigente</dt>
                  <dd>
                    {money(selected.terms.price, selected.terms.currencyCode)}
                  </dd>
                </div>
              </>
            )}
          </dl>
        )}
      </Dialog>
    </>
  );
}
function PlanEditor({
  plan,
  mode,
  onClose,
}: {
  plan?: AdminPlan;
  mode: "create" | "metadata" | "version";
  onClose: () => void;
}) {
  const user = useSession();
  const cache = useQueryClient();
  const form = useForm<PlanForm>({
    resolver: zodResolver(createPlanFormSchema),
    defaultValues: {
      code: plan?.code ?? "",
      name: plan?.name ?? "",
      description: plan?.description ?? "",
      isPublic: plan?.isPublic ?? true,
      status: plan?.status ?? "ACTIVE",
      terms: plan?.terms ?? initialTerms,
    },
  });
  const save = useMutation({
    mutationFn: async (data: PlanForm) => {
      if (mode === "create") await gymflow.createPlan(data);
      else if (mode === "version" && plan)
        await gymflow.publishPlanVersion(
          plan.publicId,
          data.terms,
          plan.rowVersion,
        );
      else if (plan)
        await gymflow.updatePlan(plan.publicId, {
          code: data.code,
          name: data.name,
          description: data.description,
          isPublic: data.isPublic,
          status: data.status,
          rowVersion: plan.rowVersion,
        });
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: [user.organizationPublicId] });
      onClose();
    },
  });
  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((data) => save.mutate(data))}
    >
      {save.error && (
        <p role="alert" className="text-sm text-rose-700">
          {save.error.message}
        </p>
      )}
      {mode !== "version" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Código
              <input
                className="field mt-1"
                {...form.register("code")}
                maxLength={40}
                required
              />
            </label>
            <label className="text-sm">
              Nombre
              <input
                className="field mt-1"
                {...form.register("name")}
                maxLength={120}
                required
              />
            </label>
          </div>
          <label className="block text-sm">
            Descripción
            <textarea
              className="field mt-1"
              {...form.register("description")}
              maxLength={600}
            />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm">
              Estado
              <select className="field mt-1" {...form.register("status")}>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="ARCHIVED">Archivado</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register("isPublic")} />
              Publicado
            </label>
          </div>
        </>
      )}
      {mode !== "metadata" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Precio
            <input
              className="field mt-1"
              type="number"
              min="0"
              step="0.0001"
              {...form.register("terms.price", { valueAsNumber: true })}
              required
            />
          </label>
          <label className="text-sm">
            Moneda
            <input
              className="field mt-1"
              {...form.register("terms.currencyCode")}
              maxLength={3}
              pattern="[A-Z]{3}"
              required
            />
          </label>
          <label className="text-sm">
            Duración
            <input
              className="field mt-1"
              type="number"
              min="1"
              step="1"
              {...form.register("terms.durationValue", { valueAsNumber: true })}
              required
            />
          </label>
          <label className="text-sm">
            Unidad
            <select
              className="field mt-1"
              {...form.register("terms.durationUnit")}
            >
              {Object.entries(units).map(([value, label]) => (
                <option key={value} value={value}>
                  {label[1]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Días de congelamiento
            <input
              className="field mt-1"
              type="number"
              min="0"
              step="1"
              {...form.register("terms.freezeDaysLimit", {
                valueAsNumber: true,
              })}
              required
            />
          </label>
          <label className="text-sm">
            Límite de reservas
            <input
              className="field mt-1"
              type="number"
              min="0"
              step="1"
              {...form.register("terms.classReservationLimit", {
                setValueAs: (v: string) => (v === "" ? null : Number(v)),
              })}
              placeholder="Sin límite definido"
            />
          </label>
        </div>
      )}
      {mode === "metadata" && (
        <p className="text-xs text-muted">
          Para cambiar precio, duración o condiciones, crea una nueva versión.
        </p>
      )}
      {!!Object.keys(form.formState.errors).length && (
        <p role="alert" className="text-sm text-rose-700">
          Revisa los campos del formulario.
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={save.isPending}
        >
          Cancelar
        </Button>
        <Button disabled={save.isPending}>
          {save.isPending
            ? "Guardando…"
            : mode === "version"
              ? "Publicar versión"
              : "Guardar plan"}
        </Button>
      </div>
    </form>
  );
}
