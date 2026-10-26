"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import { shortDate, money } from "@/lib/utils";
import { PageHeading } from "./pages";
const tabs = [
  ["", "Todas"],
  ["ACTIVE", "Activas"],
  ["EXPIRING", "Por vencer"],
  ["FROZEN", "Congeladas"],
  ["EXPIRED", "Vencidas"],
  ["CANCELLED", "Canceladas"],
  ["PENDING", "Pendientes"],
];
export function AdminMembershipsPage() {
  const user = useSession();
  const [status, setStatus] = useState("");
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  // Matches the backend clock's UTC date; dates are filters, not persisted states.
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.parse(today) + days * 86400000)
    .toISOString()
    .slice(0, 10);
  const filters = {
    page,
    search,
    status: status === "EXPIRING" ? "ACTIVE" : status,
    expiresFrom: status === "EXPIRING" ? today : undefined,
    expiresTo: status === "EXPIRING" ? until : undefined,
  };
  const q = useQuery({
    queryKey: [user.organizationPublicId, "memberships", filters],
    queryFn: ({ signal }) => gymflow.memberships(filters, signal),
  });
  return (
    <>
      <PageHeading
        title="Membresías"
        subtitle="Consulta contratos, estados y vencimientos. El precio contratado conserva su historial."
      />
      <div className="panel mb-5 space-y-4 p-4">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Estado de membresía"
        >
          {tabs.map(([value, label]) => (
            <Button
              key={value}
              variant={status === value ? "default" : "secondary"}
              size="sm"
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <input
            className="field min-w-0 flex-1"
            aria-label="Buscar membresías"
            placeholder="Nombre o código del socio"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button variant="secondary">Buscar</Button>
          {status === "EXPIRING" && (
            <label className="flex items-center gap-2 text-sm">
              Periodo
              <select
                className="field w-auto"
                value={days}
                onChange={(e) => {
                  setDays(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[7, 15, 30, 90].map((d) => (
                  <option key={d} value={d}>
                    Próximos {d} días
                  </option>
                ))}
              </select>
            </label>
          )}
        </form>
      </div>
      <section className="panel overflow-hidden">
        {q.isPending ? (
          <div className="p-5">
            <Loading />
          </div>
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !q.data.items.length ? (
          <Empty
            title="Sin membresías para estos filtros"
            description="Cambia el estado, periodo o búsqueda."
          />
        ) : (
          <>
            <ul
              className="divide-y divide-line lg:hidden"
              aria-label="Membresías en esta página"
            >
              {q.data.items.map((m) => (
                <li key={m.publicId} className="space-y-3 p-5">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-semibold">{m.fullName}</p>
                      <p className="text-xs text-muted">{m.memberCode}</p>
                    </div>
                    <Badge status={m.status} />
                  </div>
                  <p className="text-sm">
                    {m.planName} · {money(m.contractedPrice, m.currencyCode)}
                  </p>
                  <p className="text-xs text-muted">
                    Vencimiento: {shortDate(m.endDate)}
                  </p>
                </li>
              ))}
            </ul>
            <table className="data-table hidden lg:table">
              <thead>
                <tr>
                  <th>Socio</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                  <th>Precio contratado</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((m) => (
                  <tr key={m.publicId}>
                    <td>
                      <p className="font-semibold">{m.fullName}</p>
                      <p className="text-xs text-muted">{m.memberCode}</p>
                    </td>
                    <td>{m.planName}</td>
                    <td>
                      <Badge status={m.status} />
                    </td>
                    <td>{shortDate(m.endDate)}</td>
                    <td>{money(m.contractedPrice, m.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {q.data && (
          <Pagination
            page={page}
            total={q.data.total}
            totalPages={q.data.totalPages}
            onPage={setPage}
          />
        )}
      </section>
    </>
  );
}
