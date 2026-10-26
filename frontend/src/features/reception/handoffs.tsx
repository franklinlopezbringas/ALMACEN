"use client";
import { useState } from "react";
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
import { closure } from "@/lib/api/closure";
import { reception } from "@/lib/api/reception";
import { gymflow } from "@/lib/api/gymflow";
import { can } from "@/lib/auth/permissions";
import { shortDate, timeOfDay } from "@/lib/utils";
import { useOperation } from "./common";
import { OperationForm, OperationButton } from "./closure-common";
export function Handoffs() {
  const user = useSession();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const q = useOperation(
    ["handoffs", page],
    (s) => closure.handoffs(page, s),
    can(user, "MESSAGES.USE"),
  );
  const context = useOperation(["context"], (s) => reception.context(s));
  if (!can(user, "MESSAGES.USE")) return <NoPermission />;
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Traspaso de turno</h2>
          <p className="mt-2 text-sm text-muted">
            Entrega notas y pendientes al siguiente operador. Esta entrega no
            cierra la caja.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Entregar turno</Button>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <Empty
          title="Sin entregas pendientes"
          description="Cada entrega conserva su historial y confirmación de recepción."
        />
      ) : (
        <ul className="mt-5 divide-y divide-line">
          {q.data.items.map((h) => (
            <li className="space-y-3 py-4" key={h.shiftHandoffId}>
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {h.fromName} → {h.toName ?? "Próximo operador"}
                </strong>
                <Badge status={h.status} />
              </div>
              <p className="text-xs text-muted">
                {shortDate(h.handedOffAtUtc)} · {timeOfDay(h.handedOffAtUtc)} ·{" "}
                {h.cashShiftId ? `Caja #${h.cashShiftId}` : "Sin caja asociada"}
              </p>
              {h.notes && (
                <p className="whitespace-pre-wrap break-words text-sm">
                  {h.notes}
                </p>
              )}
              {h.pendingItems && (
                <div className="rounded-lg bg-canvas p-3 text-sm">
                  <strong>Pendientes</strong>
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {h.pendingItems}
                  </p>
                </div>
              )}
              {h.status === "PENDING" && (
                <div className="flex flex-wrap gap-2">
                  {context.data?.employeeId &&
                    (h.toEmployeeId === null ||
                      h.toEmployeeId === context.data.employeeId) && (
                      <OperationButton
                        path={`shift-handoffs/${h.shiftHandoffId}/acknowledge`}
                        body={{ rowVersion: h.rowVersion }}
                      >
                        Aceptar entrega
                      </OperationButton>
                    )}
                  {context.data?.employeeId === h.fromEmployeeId && (
                    <OperationButton
                      path={`shift-handoffs/${h.shiftHandoffId}/cancel`}
                      body={{ rowVersion: h.rowVersion }}
                    >
                      Cancelar entrega
                    </OperationButton>
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
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Entregar turno"
        description="Las notas se conservarán tal como se entregan."
      >
        {open && <HandoffForm onSuccess={() => setOpen(false)} />}
      </Dialog>
    </section>
  );
}
function HandoffForm({ onSuccess }: { onSuccess: () => void }) {
  const [page, setPage] = useState(1);
  const [branchPage, setBranchPage] = useState(1);
  const [cashPage, setCashPage] = useState(1);
  const employees = useOperation(["handoff-employees", page], (s) =>
    closure.employees(page, s),
  );
  const branches = useOperation(["branches", branchPage], (s) =>
    gymflow.branches(branchPage, s),
  );
  const shifts = useOperation(["handoff-shifts", cashPage], (s) =>
    reception.shifts(cashPage, s),
  );
  if (employees.isPending || branches.isPending || shifts.isPending)
    return <Loading />;
  if (employees.error || branches.error || shifts.error)
    return (
      <ErrorState
        error={(employees.error ?? branches.error ?? shifts.error)!}
        retry={() => {
          employees.refetch();
          branches.refetch();
          shifts.refetch();
        }}
      />
    );
  return (
    <>
      <OperationForm
        key={`${page}-${branchPage}-${cashPage}`}
        path="shift-handoffs"
        label="Confirmar entrega"
        onSuccess={onSuccess}
        fields={[
          {
            name: "branch",
            label: "Sede",
            type: "select",
            required: true,
            options: branches.data.items.map((b) => ({
              value: String(b.branchId),
              label: b.name,
            })),
          },
          {
            name: "receiver",
            label: "Receptor (opcional)",
            type: "select",
            options: employees.data.items.map((e) => ({
              value: String(e.employeeId),
              label: e.fullName,
            })),
          },
          {
            name: "cash",
            label: "Caja de referencia (opcional)",
            type: "select",
            options: shifts.data.items.map((s) => ({
              value: String(s.cashShiftId),
              label: `${s.registerName} · #${s.cashShiftId} · ${s.status}`,
            })),
          },
          {
            name: "notes",
            label: "Notas de entrega",
            type: "textarea",
            maxLength: 2000,
          },
          {
            name: "pending",
            label: "Pendientes",
            type: "textarea",
            maxLength: 4000,
          },
        ]}
        body={(v, requestId) => ({
          requestId,
          branchId: Number(v.branch),
          toEmployeeId: v.receiver ? Number(v.receiver) : null,
          cashShiftId: v.cash ? Number(v.cash) : null,
          notes: v.notes || null,
          pendingItems: v.pending || null,
        })}
      />
      {employees.data.totalPages > 1 && (
        <>
          <p className="mt-4 text-xs">
            Más receptores (cambia las opciones del formulario)
          </p>
          <Pagination
            page={page}
            total={employees.data.total}
            totalPages={employees.data.totalPages}
            onPage={setPage}
          />
        </>
      )}
      {branches.data.totalPages > 1 && (
        <Pagination
          page={branchPage}
          total={branches.data.total}
          totalPages={branches.data.totalPages}
          onPage={setBranchPage}
        />
      )}
      {shifts.data.totalPages > 1 && (
        <Pagination
          page={cashPage}
          total={shifts.data.total}
          totalPages={shifts.data.totalPages}
          onPage={setCashPage}
        />
      )}
    </>
  );
}
