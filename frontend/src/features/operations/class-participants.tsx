"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/workspace-shell";
import { Badge } from "@/components/ui/badge";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import { OperationButton } from "@/features/reception/closure-common";
import { can } from "@/lib/auth/permissions";
export function ClassParticipants({
  id,
  operational = false,
  session,
}: {
  id: number;
  operational?: boolean;
  session?: { startsAtUtc: string; endsAtUtc: string };
}) {
  const user = useSession();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: [user.organizationPublicId, "participants", id, page],
    queryFn: ({ signal }) => gymflow.participants(id, page, signal),
  });
  return (
    <section className="border-t border-line pt-5">
      <h3 className="mb-4 font-semibold">Participantes y reservas</h3>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <Empty title="Sin reservas registradas" />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.items.map((p) => (
            <li
              key={p.reservationId}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">{p.fullName}</p>
                <p className="text-xs text-muted">
                  {p.memberCode}
                  {p.waitlistPosition !== null
                    ? ` · Espera #${p.waitlistPosition}`
                    : ""}
                </p>
              </div>
              <Badge status={p.status} />
              {operational &&
                session &&
                can(user, "CLASSES.RESERVE_FOR_OTHERS") && (
                  <div className="flex w-full flex-wrap gap-2">
                    {(p.status === "CONFIRMED" || p.status === "WAITLISTED") &&
                      new Date(session.startsAtUtc).getTime() > now && (
                        <OperationButton
                          path={`classes/reservations/${p.reservationId}/status`}
                          body={{
                            status: "CANCELLED",
                            reservedAtUtc: p.reservedAtUtc,
                          }}
                        >
                          Cancelar reserva
                        </OperationButton>
                      )}
                    {p.status === "CONFIRMED" &&
                      new Date(session.startsAtUtc).getTime() <= now && (
                        <>
                          <OperationButton
                            path={`classes/reservations/${p.reservationId}/status`}
                            body={{
                              status: "ATTENDED",
                              reservedAtUtc: p.reservedAtUtc,
                            }}
                          >
                            Registrar asistencia
                          </OperationButton>
                          {new Date(session.endsAtUtc).getTime() <= now && (
                            <OperationButton
                              path={`classes/reservations/${p.reservationId}/status`}
                              body={{
                                status: "NO_SHOW",
                                reservedAtUtc: p.reservedAtUtc,
                              }}
                            >
                              Marcar no-show
                            </OperationButton>
                          )}
                        </>
                      )}
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
