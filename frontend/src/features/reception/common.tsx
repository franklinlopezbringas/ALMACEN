"use client";
import { useId, useState } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import type { Member } from "@/lib/api/contracts";

export function useOperation<T>(
  key: QueryKey,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const user = useSession();
  return useQuery({
    queryKey: [user.organizationPublicId, "reception", ...key],
    queryFn: ({ signal }) => load(signal),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
export function ReceptionHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="eyebrow mb-2 text-muted">RECEPCIÓN · OPERACIÓN DIARIA</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}
export function Unavailable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-4 text-sm">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-6 text-muted">{children}</p>
    </div>
  );
}
export function BranchPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [page, setPage] = useState(1);
  const q = useOperation(["branches", page], (s) => gymflow.branches(page, s));
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>
        Sede
      </label>
      <select
        id={id}
        className="field"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled || !q.data}
      >
        <option value={0}>Seleccionar sede</option>
        {q.data?.items.map((b) => (
          <option key={b.branchId} value={b.branchId}>
            {b.name}
          </option>
        ))}
      </select>
      {q.error && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.data && q.data.totalPages > 1 && (
        <Pagination
          page={page}
          total={q.data.total}
          totalPages={q.data.totalPages}
          onPage={(p) => {
            onChange(0);
            setPage(p);
          }}
        />
      )}
    </div>
  );
}
export function MemberLookup({
  onSelect,
  label = "Abrir ficha",
}: {
  onSelect: (member: Member) => void;
  label?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useOperation(["members", search, page], (s) =>
    gymflow.members(search, page, s),
  );
  return (
    <section className="panel overflow-hidden" aria-label="Búsqueda de socios">
      <form
        className="flex gap-2 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(draft.trim());
          setPage(1);
        }}
      >
        <label htmlFor={id} className="sr-only">
          Buscar socio
        </label>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-3.5 text-muted" size={17} />
          <input
            id={id}
            className="field pl-10"
            placeholder="Nombre, documento o código"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>
      {q.isPending ? (
        <div className="px-5">
          <Loading />
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <Empty
          title="Sin coincidencias"
          description="Prueba otro nombre, documento o código de socio."
        />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.items.map((m) => (
            <li
              key={m.publicId}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold break-words">{m.fullName}</p>
                <p className="mt-1 text-xs text-muted">
                  {m.memberCode} · {m.phone ?? "Sin teléfono"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge status={m.membershipStatus ?? m.status} />
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`${label}: ${m.fullName}`}
                  onClick={() => onSelect(m)}
                >
                  {label}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {q.data && (
        <Pagination
          page={page}
          totalPages={q.data.totalPages}
          total={q.data.total}
          onPage={setPage}
        />
      )}
    </section>
  );
}
export function todayLima() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dayStartUtc(date: string) {
  return new Date(date + "T00:00:00-05:00").toISOString();
}
