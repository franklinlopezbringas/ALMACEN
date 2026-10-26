"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, DoorOpen, LockKeyhole, RefreshCw } from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { reception } from "@/lib/api/reception";
import { can } from "@/lib/auth/permissions";
import { moneyInput, type Shift } from "@/lib/api/reception-contracts";
import { money, shortDate, timeOfDay } from "@/lib/utils";
import { useOperation } from "./common";
const cashForm = z.object({
  amount: moneyInput,
  notes: z.string().trim().max(500),
  registerId: z.number().int().min(0),
});
type CashForm = z.infer<typeof cashForm>;

export function CashWorkspace() {
  const user = useSession();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const context = useOperation(["context"], (s) => reception.context(s));
  const q = useOperation(["shifts", page], (s) => reception.shifts(page, s));
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState<Shift | null>(null);
  const [selected, setSelected] = useState<Shift | null>(null);
  const [notice, setNotice] = useState("");
  if (context.isPending || q.isPending) return <Loading />;
  if (context.error || q.error)
    return (
      <ErrorState
        error={(context.error ?? q.error)!}
        retry={() => {
          context.refetch();
          q.refetch();
        }}
      />
    );
  const currency = context.data.currencyCode;
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: [user.organizationPublicId] });
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Wallet size={21} />
            Mi caja
          </h2>
          <p className="mt-1 text-xs text-muted">
            {context.data.employeeName ?? "Sin perfil de empleado activo"} ·
            Solo tus turnos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Actualizar caja"
            onClick={refresh}
          >
            <RefreshCw />
          </Button>
          {can(user, "CASH.OPEN") && (
            <Button
              onClick={() => setOpen(true)}
              disabled={!context.data.employeeId}
            >
              <DoorOpen />
              Abrir caja
            </Button>
          )}
        </div>
      </div>
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {!q.data.items.length ? (
        <Empty
          title="Todavía no tienes turnos de caja"
          description="Abre una caja para recibir efectivo. Los pagos digitales se registran por separado."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {q.data.items.map((s) => (
            <article key={s.cashShiftId} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{s.registerName}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {shortDate(s.openedAtUtc)} · Apertura{" "}
                    {timeOfDay(s.openedAtUtc)}
                  </p>
                </div>
                <Badge status={s.status} />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted">Fondo inicial</dt>
                  <dd className="mt-1 font-semibold">
                    {money(s.openingAmount, currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Efectivo esperado</dt>
                  <dd className="mt-1 text-xl font-semibold">
                    {money(s.expectedAmount, currency)}
                  </dd>
                </div>
                {s.countedAmount !== null && (
                  <>
                    <div>
                      <dt className="text-xs text-muted">Contado</dt>
                      <dd className="mt-1">
                        {money(s.countedAmount, currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Diferencia</dt>
                      <dd className="mt-1">
                        {money(s.differenceAmount ?? 0, currency)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
              {s.closingNotes || s.openingNotes ? (
                <p className="mt-4 text-xs leading-5 text-muted break-words">
                  {s.closingNotes ?? s.openingNotes}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelected(s)}
                >
                  Ver movimientos
                </Button>
                {s.status === "OPEN" && can(user, "CASH.CLOSE") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setClosing(s)}
                  >
                    <LockKeyhole />
                    Cerrar caja
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {q.data.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={q.data.totalPages}
          total={q.data.total}
          onPage={setPage}
        />
      )}
      <CashDialog
        open={open || !!closing}
        shift={closing}
        employeeId={context.data.employeeId}
        currency={currency}
        onClose={() => {
          setOpen(false);
          setClosing(null);
        }}
        onDone={async (message) => {
          setNotice(message);
          setOpen(false);
          setClosing(null);
          await refresh();
        }}
      />
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title={selected?.registerName ?? "Movimientos de caja"}
        description="Historial de efectivo. Las operaciones financieras se conservan."
      >
        {selected && (
          <CashMovements
            key={selected.cashShiftId}
            id={selected.cashShiftId}
            currency={currency}
          />
        )}
      </Dialog>
    </div>
  );
}
function CashMovements({ id, currency }: { id: number; currency: string }) {
  const [page, setPage] = useState(1);
  const q = useOperation(["movements", id, page], (s) =>
    reception.movements(id, page, s),
  );
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      {q.data.items.length ? (
        <ul className="divide-y divide-line">
          {q.data.items.map((m) => (
            <li
              key={m.cashMovementId}
              className="flex justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="break-words text-sm">{m.description}</p>
                <p className="mt-1 text-xs text-muted">
                  {shortDate(m.createdAtUtc)} · {timeOfDay(m.createdAtUtc)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold">
                {["INCOME", "ADJUSTMENT_IN"].includes(m.movementType)
                  ? "+"
                  : "−"}
                {money(m.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title="Sin movimientos de efectivo"
          description="El fondo de apertura se muestra en el resumen. Los pagos digitales no generan movimientos físicos."
        />
      )}
      <Pagination
        page={page}
        totalPages={q.data.totalPages}
        total={q.data.total}
        onPage={setPage}
      />
    </div>
  );
}
function CashDialog({
  open,
  shift,
  employeeId,
  currency,
  onClose,
  onDone,
}: {
  open: boolean;
  shift: Shift | null;
  employeeId: number | null;
  currency: string;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={shift ? "Cerrar caja" : "Abrir caja"}
      description={
        shift
          ? "Cuenta el efectivo físico antes de confirmar. El servidor calculará la diferencia final."
          : "Registra el fondo inicial que recibes en efectivo."
      }
    >
      {open && (
        <CashFields
          key={shift?.cashShiftId ?? "open"}
          shift={shift}
          employeeId={employeeId}
          currency={currency}
          onDone={onDone}
        />
      )}
    </Dialog>
  );
}
function CashFields({
  shift,
  employeeId,
  currency,
  onDone,
}: {
  shift: Shift | null;
  employeeId: number | null;
  currency: string;
  onDone: (message: string) => Promise<void>;
}) {
  const [page, setPage] = useState(1);
  const registers = useOperation(
    ["registers", page],
    (s) => reception.registers(page, s),
    !shift,
  );
  const form = useForm<CashForm>({
    resolver: zodResolver(cashForm),
    defaultValues: { amount: 0, registerId: 0, notes: "" },
  });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: async (data: CashForm) => {
      if (shift) {
        const result = await reception.close(shift.cashShiftId, {
          countedAmount: data.amount,
          closingNotes: data.notes || null,
        });
        return `Caja cerrada. Esperado: ${money(result.expectedAmount, currency)} · Contado: ${money(result.countedAmount, currency)} · Diferencia: ${money(result.differenceAmount, currency)}.${result.status === "REVIEW_REQUIRED" ? " Requiere revisión." : ""}`;
      }
      if (!employeeId || !data.registerId)
        throw new Error("Selecciona una caja disponible.");
      await reception.open({
        cashRegisterId: data.registerId,
        employeeId,
        openingAmount: data.amount,
        openingNotes: data.notes || null,
      });
      return "Caja abierta. Ya puedes recibir efectivo en esta sede.";
    },
    onSuccess: onDone,
  });
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit((data) => {
        setError("");
        if (!shift && !data.registerId) {
          setError("Selecciona una caja disponible.");
          return;
        }
        mutation.mutate(data);
      })}
    >
      <fieldset disabled={mutation.isPending} className="space-y-4">
        {!shift && (
          <>
            <label className="label">
              Caja
              <select
                className="field mt-1"
                {...form.register("registerId", { valueAsNumber: true })}
              >
                <option value={0}>Seleccionar caja</option>
                {registers.data?.items.map((r) => (
                  <option
                    key={r.cashRegisterId}
                    value={r.cashRegisterId}
                    disabled={r.isOpen}
                  >
                    {r.name} · {r.branchName}
                    {r.isOpen ? " · Ocupada" : ""}
                  </option>
                ))}
              </select>
            </label>
            {registers.isPending && <Loading />}
            {registers.error && (
              <ErrorState
                error={registers.error}
                retry={() => registers.refetch()}
              />
            )}
            {registers.data && registers.data.totalPages > 1 && (
              <Pagination
                page={page}
                total={registers.data.total}
                totalPages={registers.data.totalPages}
                onPage={setPage}
              />
            )}
          </>
        )}
        <label className="label">
          {shift ? "Efectivo contado" : "Fondo inicial"}
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0001"
            className="field mt-1"
            {...form.register("amount", { valueAsNumber: true })}
          />
        </label>
        {form.formState.errors.amount && (
          <p role="alert" className="text-sm text-rose-700">
            Ingresa un importe válido con hasta 4 decimales.
          </p>
        )}
        <label className="label">
          Notas {shift ? "de cierre" : "de apertura"}
          <textarea
            className="field mt-1 min-h-20"
            {...form.register("notes")}
            maxLength={500}
          />
        </label>
      </fieldset>
      {shift && (
        <p className="text-sm text-muted">
          Esperado al consultar: {money(shift.expectedAmount, currency)}. Puede
          variar si se registra un pago antes del cierre.
        </p>
      )}
      {(error || mutation.error) && (
        <p role="alert" className="text-sm text-rose-700">
          {error || mutation.error?.message} Revisa el estado de la caja antes
          de repetir.
        </p>
      )}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending
          ? "Guardando…"
          : shift
            ? "Confirmar cierre"
            : "Confirmar apertura"}
      </Button>
    </form>
  );
}
