"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, Plus, Search, UserRoundPlus } from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import { can } from "@/lib/auth/permissions";
import type { Member, Prospect } from "@/lib/api/contracts";
import { PersonFormDialog } from "./person-form";
import { shortDate, timeOfDay } from "@/lib/utils";
import { prospectStatuses } from "./prospect-statuses";
export function PeoplePage({ prospect = false }: { prospect?: boolean }) {
  const user = useSession();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(searchParams.get("nuevo") === "1");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const initialStatus = searchParams.get("estado") ?? "";
  const [status, setStatus] = useState(
    prospectStatuses.some(([code]) => code === initialStatus)
      ? initialStatus
      : "",
  );
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);
  const [convert, setConvert] = useState<Prospect | null>(null);
  const [notice, setNotice] = useState("");
  const cache = useQueryClient();
  const resource = prospect ? "prospects" : "members";
  const query = useQuery({
    queryKey: [user.organizationPublicId, resource, search, page, status],
    queryFn: async ({ signal }) => {
      const result = prospect
        ? await gymflow.prospects(search, page, signal, status)
        : await gymflow.members(search, page, signal);
      return { ...result, items: result.items as (Member | Prospect)[] };
    },
  });
  const detailQuery = useQuery({
    queryKey: [user.organizationPublicId, "member", detail],
    queryFn: ({ signal }) => gymflow.member(detail!, signal),
    enabled: !!detail,
  });
  const conversion = useMutation({
    mutationFn: (id: number) => gymflow.convertProspect(id),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: [user.organizationPublicId] });
      setConvert(null);
      setNotice("Prospecto convertido a socio. Su historial se conserva.");
    },
  });
  const allowed = can(user, prospect ? "PROSPECTS.MANAGE" : "MEMBERS.CREATE");
  const action = (row: Member | Prospect) =>
    prospect ? (
      allowed &&
      (row as Prospect).status !== "WON" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            conversion.reset();
            setConvert(row as Prospect);
          }}
        >
          <UserRoundPlus />
          Convertir
        </Button>
      )
    ) : (
      <Button
        variant="ghost"
        size="sm"
        aria-label={"Ver " + row.fullName}
        onClick={() => setDetail((row as Member).publicId)}
      >
        <ArrowUpRight />
        Ver ficha
      </Button>
    );
  const followUp = (value: string | null) =>
    value ? `${shortDate(value)} · ${timeOfDay(value)}` : "Sin programar";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2 text-muted">
            {prospect ? "CRM · SEGUIMIENTO" : "GESTIÓN DE SOCIOS"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {prospect ? "Prospectos" : "Socios"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {prospect
              ? "Contactos, origen y próximos seguimientos. Horarios en hora de Lima."
              : "Consulta datos de contacto, estado y vigencia de membresía."}
          </p>
        </div>
        {allowed && (
          <Button onClick={() => setOpen(true)}>
            <Plus />
            {prospect ? "Nuevo prospecto" : "Registrar socio"}
          </Button>
        )}
      </div>
      {notice && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <Check size={17} />
          {notice}
        </p>
      )}
      <section
        aria-label={
          prospect ? "Resultados de prospectos" : "Resultados de socios"
        }
        className="panel overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <form
            className="flex w-full max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(draft.trim());
              setPage(1);
            }}
          >
            <label htmlFor="people-search" className="sr-only">
              Buscar {prospect ? "prospectos" : "socios"}
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="absolute left-3.5 top-3.5 text-muted"
              />
              <input
                id="people-search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="field pl-10"
                placeholder={
                  prospect
                    ? "Buscar por nombre…"
                    : "Nombre, documento o código…"
                }
              />
            </div>
            <Button variant="secondary" type="submit">
              Buscar
            </Button>
          </form>
          {prospect && (
            <div className="flex items-center gap-3">
              <label
                className="text-xs font-medium text-muted"
                htmlFor="prospect-status"
              >
                Estado
              </label>
              <select
                id="prospect-status"
                className="field max-w-52"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos los estados</option>
                {prospectStatuses.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <span className="text-xs text-muted">
            {query.data
              ? `${query.data.total} ${prospect ? "prospectos" : "socios"}`
              : "Tu comunidad, al día"}
          </span>
        </div>
        {query.isPending ? (
          <div className="px-5">
            <Loading />
          </div>
        ) : query.error ? (
          <div className="p-5">
            <ErrorState error={query.error} retry={() => query.refetch()} />
          </div>
        ) : !query.data?.items.length ? (
          <Empty
            title={
              search || status
                ? "Sin coincidencias"
                : prospect
                  ? "La próxima historia empieza contigo"
                  : "Tu comunidad empieza aquí"
            }
            description={
              search || status
                ? "Prueba otro nombre o cambia los filtros."
                : prospect
                  ? "Registra un prospecto para comenzar el seguimiento."
                  : "Registra a tu primer socio para verlo en esta lista."
            }
          />
        ) : (
          <>
            <ul
              aria-label={
                prospect ? "Prospectos en esta página" : "Socios en esta página"
              }
              className="grid divide-y divide-line md:grid-cols-2 md:divide-y-0 lg:hidden"
            >
              {query.data.items.map((row) => {
                const m = row as Member;
                const p = row as Prospect;
                return (
                  <li
                    key={prospect ? p.prospectId : m.publicId}
                    className="space-y-4 p-5 md:border-b md:border-line md:even:border-l"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold break-words">
                          {row.fullName}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {prospect
                            ? `Prospecto #${p.prospectId}`
                            : m.memberCode}
                        </p>
                      </div>
                      <Badge status={row.status} />
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted">Teléfono</dt>
                        <dd className="mt-1">{row.phone ?? "Sin registrar"}</dd>
                      </div>
                      {prospect ? (
                        <>
                          <div>
                            <dt className="text-xs text-muted">Origen</dt>
                            <dd className="mt-1">
                              {p.leadSource ?? "Sin especificar"}
                              <span className="mt-1 block text-xs text-muted">
                                Plan de interés:{" "}
                                {p.interestedPlan ?? "Sin especificar"}
                              </span>
                              <span className="mt-1 block text-xs text-muted">
                                Último contacto: {followUp(p.lastContactAtUtc)}
                              </span>
                            </dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-xs text-muted">
                              Próximo seguimiento
                            </dt>
                            <dd className="mt-1">
                              {followUp(p.nextFollowUpAtUtc)}
                            </dd>
                          </div>
                        </>
                      ) : (
                        <div>
                          <dt className="text-xs text-muted">Membresía</dt>
                          <dd className="mt-1">
                            {m.membershipStatus ? (
                              <Badge status={m.membershipStatus} />
                            ) : (
                              "Sin membresía actual"
                            )}
                          </dd>
                        </div>
                      )}
                      {!prospect && m.membershipEndDate && (
                        <div className="col-span-2">
                          <dt className="text-xs text-muted">Vencimiento</dt>
                          <dd className="mt-1">
                            {shortDate(m.membershipEndDate)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <div className="flex justify-end border-t border-line pt-2">
                      {action(row)}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto lg:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{prospect ? "Prospecto" : "Socio"}</th>
                    <th>Contacto</th>
                    <th>Estado</th>
                    <th>{prospect ? "Origen" : "Membresía"}</th>
                    {prospect && <th>Próximo seguimiento</th>}
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((row) => {
                    const m = row as Member;
                    const p = row as Prospect;
                    return (
                      <tr key={prospect ? p.prospectId : m.publicId}>
                        <td>
                          <div className="flex min-w-44 items-center gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-xs font-semibold">
                              {row.fullName
                                .split(" ")
                                .slice(0, 2)
                                .map((x) => x[0])
                                .join("")}
                            </span>
                            <div>
                              <p className="font-semibold">{row.fullName}</p>
                              <p className="mt-1 text-xs text-muted">
                                {prospect
                                  ? "Prospecto #" + p.prospectId
                                  : m.memberCode}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-muted">
                          {row.phone ?? "Sin teléfono"}
                          {prospect && p.email && (
                            <p className="mt-1 break-all text-xs">{p.email}</p>
                          )}
                        </td>
                        <td>
                          <Badge status={row.status} />
                        </td>
                        <td>
                          {prospect ? (
                            <span className="text-sm text-muted">
                              {p.leadSource ?? "Sin especificar"}
                              <span className="mt-1 block text-xs text-muted">
                                Plan de interés:{" "}
                                {p.interestedPlan ?? "Sin especificar"}
                              </span>
                              <span className="mt-1 block text-xs text-muted">
                                Último contacto: {followUp(p.lastContactAtUtc)}
                              </span>
                            </span>
                          ) : m.membershipStatus ? (
                            <div className="space-y-2">
                              <Badge status={m.membershipStatus} />
                              {m.membershipEndDate && (
                                <p className="text-xs text-muted">
                                  Vence {shortDate(m.membershipEndDate)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted">
                              Sin membresía actual
                            </span>
                          )}
                        </td>
                        {prospect && (
                          <td className="text-sm text-muted">
                            {followUp(p.nextFollowUpAtUtc)}
                          </td>
                        )}
                        <td className="text-right">{action(row)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {query.data && (
          <Pagination
            page={page}
            totalPages={query.data.totalPages}
            total={query.data.total}
            onPage={setPage}
          />
        )}
      </section>
      {allowed && (
        <PersonFormDialog
          open={open}
          onClose={() => setOpen(false)}
          prospect={prospect}
        />
      )}
      <Dialog
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
        title="Ficha del socio"
        description="Información de contacto y estado actual."
      >
        {detailQuery.isPending ? (
          <Loading />
        ) : detailQuery.error ? (
          <ErrorState
            error={detailQuery.error}
            retry={() => detailQuery.refetch()}
          />
        ) : (
          detailQuery.data && (
            <div>
              <h3 className="mb-2 text-xl font-semibold">
                {detailQuery.data.firstName} {detailQuery.data.lastName}
              </h3>
              <Badge status={detailQuery.data.status} />
              <dl className="mt-6 grid grid-cols-2 gap-5">
                {[
                  ["Código", detailQuery.data.memberCode],
                  ["Tipo de documento", detailQuery.data.documentType],
                  ["Documento", detailQuery.data.documentNumber],
                  ["Teléfono", detailQuery.data.phone],
                  ["Correo", detailQuery.data.email],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="mt-1 break-words text-sm">
                      {value ?? "Sin registrar"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        )}
      </Dialog>
      <Dialog
        open={!!convert}
        onOpenChange={(v) => {
          if (!v && !conversion.isPending) setConvert(null);
        }}
        title="Un nuevo socio en tu comunidad"
        description={`¿Convertir a ${convert?.fullName ?? "este prospecto"} en socio? Se conservará su historial y no se generará una membresía ni un cobro.`}
      >
        {conversion.error && (
          <p role="alert" className="mb-4 text-sm text-rose-700">
            {conversion.error.message}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            disabled={conversion.isPending}
            onClick={() => setConvert(null)}
          >
            Cancelar
          </Button>
          <Button
            disabled={conversion.isPending}
            onClick={() => convert && conversion.mutate(convert.prospectId)}
          >
            {conversion.isPending ? "Convirtiendo…" : "Confirmar conversión"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
