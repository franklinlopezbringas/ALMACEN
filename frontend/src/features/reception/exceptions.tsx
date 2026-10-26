"use client";
import { useState } from "react";
import { useSession } from "@/components/workspace-shell";
import { Badge } from "@/components/ui/badge";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { closure } from "@/lib/api/closure";
import { can } from "@/lib/auth/permissions";
import { shortDate, timeOfDay } from "@/lib/utils";
import { useOperation } from "./common";
import { OperationForm, OperationButton } from "./closure-common";
export function ExceptionForm({ memberId }: { memberId: number }) {
  return (
    <section className="space-y-4 border-t border-line pt-5">
      <h3 className="font-semibold">Solicitar excepción de acceso</h3>
      <p className="text-sm text-muted">
        Requiere revisión de una persona autorizada. La aprobación no registra
        un ingreso.
      </p>
      <OperationForm
        path="access/exceptions"
        label="Solicitar revisión"
        fields={[
          {
            name: "reason",
            label: "Motivo",
            type: "textarea",
            required: true,
            maxLength: 500,
          },
          {
            name: "from",
            label: "Vigencia desde (hora de Lima)",
            type: "datetime-local",
            required: true,
          },
          {
            name: "to",
            label: "Vigencia hasta (hora de Lima)",
            type: "datetime-local",
            required: true,
          },
        ]}
        body={(v, requestId) => ({
          requestId,
          memberId,
          reason: v.reason,
          validFromUtc: new Date(v.from + ":00-05:00").toISOString(),
          validToUtc: new Date(v.to + ":00-05:00").toISOString(),
        })}
      />
    </section>
  );
}
export function Exceptions() {
  const user = useSession();
  const [page, setPage] = useState(1);
  const q = useOperation(
    ["exceptions", page],
    (s) => closure.exceptions(page, s),
    can(user, "ACCESS.EXCEPTION_REQUEST"),
  );
  if (!can(user, "ACCESS.EXCEPTION_REQUEST")) return null;
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">Solicitudes de excepción</h2>
      <p className="mt-2 text-sm text-muted">
        Solicita una excepción desde la ficha del socio cuando el acceso esté
        bloqueado.
      </p>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <Empty title="Sin solicitudes de excepción" />
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {q.data.items.map((e) => (
            <li className="space-y-2 py-4" key={e.accessExceptionId}>
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{e.fullName}</strong>
                <Badge status={e.status} />
              </div>
              <p className="break-words text-sm">{e.reason}</p>
              <p className="text-xs text-muted">
                Desde {shortDate(e.validFromUtc)} {timeOfDay(e.validFromUtc)}{" "}
                hasta {shortDate(e.validToUtc)} {timeOfDay(e.validToUtc)}
              </p>
              {e.status === "REQUESTED" &&
                can(user, "ACCESS.EXCEPTION_APPROVE") && (
                  <div className="flex flex-wrap gap-2">
                    <OperationButton
                      path={`access/exceptions/${e.accessExceptionId}/review`}
                      body={{ status: "APPROVED" }}
                    >
                      Aprobar excepción
                    </OperationButton>
                    <OperationButton
                      path={`access/exceptions/${e.accessExceptionId}/review`}
                      body={{ status: "REJECTED" }}
                    >
                      Rechazar excepción
                    </OperationButton>
                  </div>
                )}
            </li>
          ))}
        </ul>
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
  );
}
