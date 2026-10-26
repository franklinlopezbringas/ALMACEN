"use client";
import { useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Printer, CheckCircle2 } from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Loading, ErrorState } from "@/components/ui/states";
import { reception } from "@/lib/api/reception";
import { ApiError } from "@/lib/api/client";
import {
  moneyUnits,
  splitFormSchema,
  type SplitForm,
  type Payment,
  type PosInput,
} from "@/lib/api/reception-contracts";
import { money, shortDate, timeOfDay } from "@/lib/utils";
import { useOperation } from "./common";

export function Receipt({ id }: { id: string }) {
  const q = useOperation(["receipt", id], (s) => reception.receipt(id, s));
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { payment, splits, items, memberName } = q.data;
  return (
    <div className="reception-receipt space-y-5">
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-3 text-primary" />
        <h3 className="text-xl font-semibold">Pago registrado</h3>
        <p className="mt-2 break-all text-xs text-muted">
          {payment.receiptNumber}
        </p>
        <p className="mt-2 text-xs text-muted">
          {shortDate(payment.receivedAtUtc)} ·{" "}
          {timeOfDay(payment.receivedAtUtc)} ·{" "}
          {memberName ?? "Venta de mostrador"}
        </p>
      </div>
      {items.length > 0 && (
        <ul className="divide-y divide-line">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between gap-4 py-3 text-sm">
              <span>
                {item.quantity} × {item.description}
              </span>
              <span>{money(item.totalAmount, payment.currencyCode)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="flex justify-between text-xl font-semibold">
        <span>Total</span>
        <span>{money(payment.totalAmount, payment.currencyCode)}</span>
      </p>
      <dl className="space-y-2 border-y border-line py-4">
        {splits.map((s, i) => (
          <div key={i} className="flex justify-between gap-3 text-sm">
            <dt>
              {s.method}
              {s.externalReference && (
                <span className="block text-xs text-muted break-all">
                  Ref. {s.externalReference}
                </span>
              )}
            </dt>
            <dd>{money(s.amount, payment.currencyCode)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm">
        Ingreso a caja física:{" "}
        <strong>
          {money(
            splits
              .filter((s) => s.isCash)
              .reduce((sum, s) => sum + s.amount, 0),
            payment.currencyCode,
          )}
        </strong>
      </p>
      <p className="text-xs leading-5 text-muted">
        Constancia interna de pago. No sustituye un comprobante fiscal
        electrónico.
      </p>
      <Button
        className="print:hidden"
        variant="secondary"
        onClick={() => window.print()}
      >
        <Printer />
        Imprimir constancia
      </Button>
    </div>
  );
}
export type Tender = {
  requestId: string;
  splits: PosInput["splits"];
  cashShiftId: number | null;
  totalAmount: number;
};
export function TenderForm({
  amount,
  currency,
  branchId,
  exact,
  onSubmit,
  onLock,
  onSuccess,
}: {
  amount: number;
  currency: string;
  branchId: number;
  exact: boolean;
  onSubmit: (t: Tender) => Promise<Payment>;
  onLock?: (locked: boolean) => void;
  onSuccess: (payment: Payment) => void;
}) {
  const user = useSession();
  const cache = useQueryClient();
  const methods = useOperation(["methods"], (s) => reception.methods(1, s));
  const shifts = useOperation(["open-shifts"], (s) => reception.openShifts(s));
  const [shiftId, setShiftId] = useState(0);
  const [attempt, setAttempt] = useState<Tender | null>(null);
  const [problem, setProblem] = useState("");
  const form = useForm<SplitForm>({
    resolver: zodResolver(splitFormSchema),
    defaultValues: {
      splits: [{ paymentMethodId: 0, amount, externalReference: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "splits",
  });
  const values = useWatch({ control: form.control, name: "splits" });
  const total =
    values.reduce((sum, s) => sum + moneyUnits(Number(s.amount) || 0), 0) /
    10000;
  const cash =
    values
      .filter(
        (s) =>
          methods.data?.items.find(
            (m) => m.paymentMethodId === Number(s.paymentMethodId),
          )?.isCash,
      )
      .reduce((sum, s) => sum + moneyUnits(Number(s.amount) || 0), 0) / 10000;
  const available =
    shifts.data?.items.filter(
      (s) => s.status === "OPEN" && s.branchId === branchId,
    ) ?? [];
  const chosenShift =
    shiftId || (available.length === 1 ? available[0].cashShiftId : 0);
  const mutation = useMutation({
    mutationFn: onSubmit,
    onSuccess: async (p) => {
      await cache.invalidateQueries({ queryKey: [user.organizationPublicId] });
      setAttempt(null);
      onLock?.(false);
      onSuccess(p);
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        [400, 403, 404, 409].includes(error.status)
      ) {
        setAttempt(null);
        onLock?.(false);
      }
    },
  });
  if (methods.isPending || shifts.isPending) return <Loading />;
  if (methods.error || shifts.error)
    return (
      <ErrorState
        error={(methods.error ?? shifts.error)!}
        retry={() => {
          methods.refetch();
          shifts.refetch();
        }}
      />
    );
  const submit = (data: SplitForm) => {
    setProblem("");
    if (
      !branchId ||
      moneyUnits(total) <= 0 ||
      moneyUnits(total) > moneyUnits(amount) ||
      (exact && moneyUnits(total) !== moneyUnits(amount))
    ) {
      setProblem(
        exact
          ? "Los medios de pago deben sumar el total de la venta."
          : "El pago debe ser mayor que cero y no superar la deuda.",
      );
      return;
    }
    if (cash > 0 && !available.some((s) => s.cashShiftId === chosenShift)) {
      setProblem("Abre tu caja en esta sede antes de recibir efectivo.");
      return;
    }
    const payload: Tender = {
      requestId: crypto.randomUUID(),
      totalAmount: total,
      cashShiftId: cash > 0 ? chosenShift : null,
      splits: data.splits.map((s) => ({
        paymentMethodId: s.paymentMethodId,
        amount: s.amount,
        externalReference: s.externalReference || null,
        providerTransactionId: null,
      })),
    };
    setAttempt(payload);
    onLock?.(true);
    mutation.mutate(payload);
  };
  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Medios de pago</h3>
        <span className="text-sm text-muted">
          {exact ? "Total" : "Deuda"}: {money(amount, currency)}
        </span>
      </div>
      <fieldset
        disabled={!!attempt || mutation.isPending}
        className="space-y-4"
      >
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-xl border border-line p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-3">
              <label className="text-xs font-medium">
                Medio {index + 1}
                <select
                  className="field mt-1"
                  {...form.register(`splits.${index}.paymentMethodId`, {
                    valueAsNumber: true,
                  })}
                >
                  <option value={0}>Seleccionar</option>
                  {methods.data.items.map((m) => (
                    <option key={m.paymentMethodId} value={m.paymentMethodId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium">
                Importe {index + 1}
                <input
                  className="field mt-1"
                  inputMode="decimal"
                  type="number"
                  step="0.0001"
                  min="0.01"
                  {...form.register(`splits.${index}.amount`, {
                    valueAsNumber: true,
                  })}
                />
              </label>
            </div>
            <label className="mt-3 block text-xs font-medium">
              Referencia {index + 1} · opcional
              <input
                className="field mt-1"
                {...form.register(`splits.${index}.externalReference`)}
                maxLength={150}
              />
            </label>
            {form.formState.errors.splits?.[index] && (
              <p role="alert" className="mt-2 text-xs text-rose-700">
                Selecciona un medio e ingresa un importe válido con hasta 4
                decimales.
              </p>
            )}
            {fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Quitar medio ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 />
                Quitar
              </Button>
            )}
          </div>
        ))}
        {fields.length < 5 && (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              append({
                paymentMethodId: 0,
                amount: Math.max(
                  0,
                  (moneyUnits(amount) - moneyUnits(total)) / 10000,
                ),
                externalReference: "",
              })
            }
          >
            <Plus />
            Agregar medio de pago
          </Button>
        )}
        {cash > 0 && (
          <label className="label">
            Caja de efectivo
            <select
              className="field mt-1"
              value={chosenShift}
              onChange={(e) => setShiftId(Number(e.target.value))}
            >
              <option value={0}>Seleccionar caja abierta</option>
              {available.map((s) => (
                <option value={s.cashShiftId} key={s.cashShiftId}>
                  {s.registerName}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      <div className="rounded-xl bg-canvas p-4 text-sm">
        <p className="flex justify-between font-semibold">
          <span>A cobrar</span>
          <span>{money(total, currency)}</span>
        </p>
        <p className="mt-2 flex justify-between text-muted">
          <span>A caja física</span>
          <span>{money(cash, currency)}</span>
        </p>
        {!exact && (
          <p className="mt-2 flex justify-between text-muted">
            <span>Saldo después del pago</span>
            <span>
              {money(
                Math.max(0, (moneyUnits(amount) - moneyUnits(total)) / 10000),
                currency,
              )}
            </span>
          </p>
        )}
      </div>
      <p className="text-xs leading-5 text-muted">
        Confirma la recepción del dinero antes de registrar. Yape y tarjeta se
        registran como pagos; no ingresan a la caja física.
      </p>
      {(problem || mutation.error) && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800"
        >
          {problem || mutation.error?.message}
        </p>
      )}
      {attempt && !mutation.isPending ? (
        <>
          <p className="text-xs text-muted">
            Resultado pendiente de confirmar. Reintenta la misma solicitud sin
            modificarla; no se duplicará el cobro.
          </p>
          <Button type="button" onClick={() => mutation.mutate(attempt)}>
            Confirmar resultado de la solicitud
          </Button>
        </>
      ) : (
        <Button type="submit" disabled={mutation.isPending || !branchId}>
          {mutation.isPending
            ? "Registrando…"
            : exact
              ? "Confirmar venta y pago"
              : "Registrar pago"}
        </Button>
      )}
    </form>
  );
}
