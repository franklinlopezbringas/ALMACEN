"use client";
import { useState } from "react";
import { z } from "zod";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { closure, lineSchema, returnSchema } from "@/lib/api/closure";
import { reception } from "@/lib/api/reception";
import { can } from "@/lib/auth/permissions";
import { useOperation } from "./common";
import { OperationForm, OperationButton } from "./closure-common";
export function Returns() {
  const user = useSession();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [process, setProcess] = useState<z.infer<typeof returnSchema> | null>(
    null,
  );
  const q = useOperation(["returns", page], (s) => closure.returns(page, s));
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Devoluciones de venta</h2>
          <p className="mt-2 text-sm text-muted">
            Solicita por producto, recibe aprobación y registra el reembolso
            efectivo. La venta original se conserva.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Solicitar devolución
        </Button>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <Empty title="Sin devoluciones" />
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {q.data.items.map((r) => (
            <li className="space-y-3 py-4" key={r.productReturnId}>
              <div className="flex flex-wrap justify-between gap-3">
                <strong>
                  {r.productName} · {r.quantity} uds.
                </strong>
                <Badge status={r.status} />
              </div>
              <p className="break-words text-sm">{r.reason}</p>
              <p className="text-xs text-muted">
                Devolución #{r.productReturnId} · Importe {r.amount.toFixed(2)}{" "}
                · Orden #{r.orderId}
              </p>
              <div className="flex flex-wrap gap-2">
                {r.status === "REQUESTED" && can(user, "REFUNDS.APPROVE") && (
                  <>
                    <OperationButton
                      path={`store/returns/${r.productReturnId}/review`}
                      body={{ status: "APPROVED" }}
                    >
                      Aprobar devolución
                    </OperationButton>
                    <OperationButton
                      path={`store/returns/${r.productReturnId}/review`}
                      body={{ status: "REJECTED" }}
                    >
                      Rechazar devolución
                    </OperationButton>
                  </>
                )}
                {r.status === "APPROVED" && can(user, "PAYMENTS.CREATE") && (
                  <Button onClick={() => setProcess(r)}>
                    Registrar reembolso
                  </Button>
                )}
              </div>
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
        title="Solicitar devolución"
        description="Busca la orden del comprobante y selecciona el producto."
      >
        {open && <ReturnRequestForm onSuccess={() => setOpen(false)} />}
      </Dialog>
      <Dialog
        open={!!process}
        onOpenChange={(v) => {
          if (!v) setProcess(null);
        }}
        title="Registrar reembolso"
        description="Confirma solo después de comprobar la devolución al medio original."
      >
        {process && (
          <RefundForm item={process} onSuccess={() => setProcess(null)} />
        )}
      </Dialog>
    </section>
  );
}
function ReturnRequestForm({ onSuccess }: { onSuccess: () => void }) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<z.infer<typeof lineSchema> | null>(
    null,
  );
  const q = useOperation(["return-lines", search, page], (s) =>
    closure.lines(search, page, s),
  );
  if (selected)
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelected(null)}>
          Elegir otro producto
        </Button>
        <p className="break-all text-xs text-muted">{selected.orderNumber}</p>
        <h3 className="font-semibold">{selected.description}</h3>
        <p className="text-sm">
          Disponible para devolución:{" "}
          {selected.quantity - selected.returnedQuantity}
        </p>
        <OperationForm
          path="store/returns"
          label="Enviar solicitud"
          onSuccess={onSuccess}
          fields={[
            {
              name: "quantity",
              label: "Cantidad a devolver",
              type: "number",
              required: true,
              min: 0.001,
              max: selected.quantity - selected.returnedQuantity,
              step: "0.001",
            },
            {
              name: "reason",
              label: "Motivo de devolución",
              type: "textarea",
              required: true,
              maxLength: 500,
            },
          ]}
          body={(v, requestId) => ({
            requestId,
            orderItemId: selected.orderItemId,
            quantity: Number(v.quantity),
            reason: v.reason,
          })}
        />
      </div>
    );
  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(draft);
          setPage(1);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Número de orden</span>
          <input
            className="field"
            placeholder="Número de orden POS"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <Empty title="No encontramos ventas" />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.items.map((l) => (
            <li className="space-y-2 py-4" key={l.orderItemId}>
              <p className="break-all text-xs text-muted">{l.orderNumber}</p>
              <strong>{l.description}</strong>
              <p className="text-sm">
                {l.quantity - l.returnedQuantity} unidades disponibles
              </p>
              <Button
                disabled={l.quantity <= l.returnedQuantity}
                onClick={() => setSelected(l)}
              >
                Seleccionar producto
              </Button>
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
    </div>
  );
}
function RefundForm({
  item,
  onSuccess,
}: {
  item: z.infer<typeof returnSchema>;
  onSuccess: () => void;
}) {
  const sources = useOperation(["refund-sources", item.productReturnId], (s) =>
    closure.sources(item.productReturnId, s),
  );
  const shifts = useOperation(["open-shifts"], (s) => reception.openShifts(s));
  if (sources.isPending || shifts.isPending) return <Loading />;
  if (sources.error || shifts.error)
    return (
      <ErrorState
        error={(sources.error ?? shifts.error)!}
        retry={() => {
          sources.refetch();
          shifts.refetch();
        }}
      />
    );
  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold">
        Importe a reembolsar: {item.amount.toFixed(2)}
      </p>
      <p className="text-sm text-muted">
        Reparte el importe entre los medios originales. Solo el efectivo produce
        salida de caja.
      </p>
      <OperationForm
        path={`store/returns/${item.productReturnId}/process`}
        onSuccess={onSuccess}
        label="Confirmar reembolso"
        fields={[
          ...sources.data.map((s) => ({
            name: String(s.paymentSplitId),
            label: `${s.methodName} · saldo ${Math.max(0, s.amount - s.refundedAmount).toFixed(2)}`,
            type: "number" as const,
            min: 0,
            max: s.amount - s.refundedAmount,
            step: "0.0001",
          })),
          {
            name: "cash",
            label: "Caja para salida de efectivo (si corresponde)",
            type: "select",
            options: shifts.data.items.map((s) => ({
              value: String(s.cashShiftId),
              label: `${s.registerName} · #${s.cashShiftId}`,
            })),
          },
        ]}
        body={(v, requestId) => ({
          requestId,
          cashShiftId: v.cash ? Number(v.cash) : null,
          splits: sources.data
            .filter((s) => Number(v[String(s.paymentSplitId)]) > 0)
            .map((s) => ({
              paymentSplitId: s.paymentSplitId,
              amount: Number(v[String(s.paymentSplitId)]),
            })),
        })}
      />
    </div>
  );
}
