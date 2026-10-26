"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, ShieldX } from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import { reception } from "@/lib/api/reception";
import {
  accessReason,
  checkInSchema,
  type Debt,
  type Payment,
} from "@/lib/api/reception-contracts";
import { can } from "@/lib/auth/permissions";
import { money, shortDate, timeOfDay } from "@/lib/utils";
import { BranchPicker, useOperation, todayLima, dayStartUtc } from "./common";
import { TenderForm, Receipt } from "./tender";
import { ClassParticipants } from "@/features/operations/class-participants";

import { ExceptionForm } from "./exceptions";

export function CheckIn({ memberId }: { memberId: number }) {
  const user = useSession();
  const cache = useQueryClient();
  const [branch, setBranch] = useState(0);
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      gymflow.checkIn(
        checkInSchema.parse({
          memberId,
          branchId: branch,
          accessMethod: "MANUAL",
          deviceId: null,
        }),
      ),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: [user.organizationPublicId] }),
  });
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Registrar ingreso real</h3>
      <BranchPicker
        value={branch}
        onChange={setBranch}
        disabled={mutation.isPending || mutation.isSuccess}
      />
      <p className="text-xs leading-5 text-muted">
        Confirma cuando el socio ingrese al gimnasio. Una excepción aprobada por
        sí sola no registra asistencia.
      </p>
      {!mutation.isSuccess && (
        <Button
          disabled={mutation.isPending}
          onClick={() => {
            setError("");
            if (!branch) {
              setError("Selecciona la sede del ingreso.");
              return;
            }
            mutation.mutate();
          }}
        >
          {mutation.isPending ? "Verificando…" : "Confirmar check-in"}
        </Button>
      )}
      {(error || mutation.error) && (
        <p role="alert" className="text-sm text-rose-700">
          {error || mutation.error?.message}
        </p>
      )}
      {mutation.data && (
        <div
          role="status"
          className={`rounded-xl p-4 ${mutation.data.allowed ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
        >
          {mutation.data.allowed ? <CheckCircle2 /> : <ShieldX />}
          <p className="mt-2 font-semibold">
            {mutation.data.allowed ? "Ingreso permitido" : "Ingreso bloqueado"}
          </p>
          <p className="mt-1 text-sm">
            {mutation.data.reasonCode
              ? (accessReason[mutation.data.reasonCode] ??
                "Revisa la situación del socio con administración.")
              : "Asistencia registrada correctamente."}
          </p>
          <p className="mt-2 text-xs">
            {timeOfDay(mutation.data.occurredAtUtc)} · Registro #
            {mutation.data.attendanceEventId}
          </p>
        </div>
      )}
      {mutation.data &&
        !mutation.data.allowed &&
        can(user, "ACCESS.EXCEPTION_REQUEST") && (
          <ExceptionForm memberId={memberId} />
        )}
    </div>
  );
}
export function QrCheckIn() {
  const user = useSession();
  const cache = useQueryClient();
  const [branch, setBranch] = useState(0);
  const [credential, setCredential] = useState("");
  const mutation = useMutation({
    mutationFn: () => reception.qrCheckIn(credential.trim(), branch),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: [user.organizationPublicId] }),
  });
  return (
    <section className="panel p-5">
      <h2 className="font-semibold">Ingreso con lector QR</h2>
      <p className="mt-2 text-sm text-muted">
        Lee el código vigente del socio con un escáner conectado o pega el valor
        leído. Confirma solo al producirse el ingreso.
      </p>
      <form
        className="mt-4 grid items-end gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <BranchPicker
          value={branch}
          onChange={setBranch}
          disabled={mutation.isPending || mutation.isSuccess}
        />
        <label className="label">
          Código QR leído
          <input
            className="field mt-1"
            autoComplete="off"
            maxLength={200}
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            disabled={mutation.isPending || mutation.isSuccess}
          />
        </label>
        <Button
          type="submit"
          disabled={
            !branch ||
            !credential.trim() ||
            mutation.isPending ||
            mutation.isSuccess
          }
        >
          {mutation.isPending ? "Verificando…" : "Confirmar ingreso QR"}
        </Button>
      </form>
      {mutation.error && (
        <p role="alert" className="mt-4 text-sm text-rose-700">
          {mutation.error.message} Verifica la credencial y el historial antes
          de repetir.
        </p>
      )}
      {mutation.data && (
        <div role="status" className="mt-4 space-y-2">
          <p className="font-semibold">
            {mutation.data.allowed ? "Ingreso permitido" : "Ingreso bloqueado"}
          </p>
          <p className="text-sm text-muted">
            {mutation.data.reasonCode
              ? (accessReason[mutation.data.reasonCode] ?? "Revisar acceso.")
              : "Asistencia registrada."}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              mutation.reset();
              setCredential("");
            }}
          >
            Siguiente socio
          </Button>
        </div>
      )}
    </section>
  );
}
export function Debts({
  memberId,
  homeBranchId,
}: {
  memberId: number;
  homeBranchId: number | null;
}) {
  const user = useSession();
  const [page, setPage] = useState(1);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [paid, setPaid] = useState<Payment | null>(null);
  const [locked, setLocked] = useState(false);
  const [branch, setBranch] = useState(homeBranchId ?? 0);
  const q = useOperation(["debts", memberId, page], (s) =>
    reception.debts(memberId, page, s),
  );
  if (paid)
    return (
      <div className="space-y-5">
        <Receipt id={paid.publicId} />
        <Button
          variant="secondary"
          onClick={() => {
            setPaid(null);
            setDebt(null);
          }}
        >
          Volver a cuentas pendientes
        </Button>
      </div>
    );
  if (debt)
    return (
      <div className="space-y-4">
        <Button variant="ghost" disabled={locked} onClick={() => setDebt(null)}>
          ← Cuentas pendientes
        </Button>
        <h3 className="font-semibold">{debt.description}</h3>
        <BranchPicker value={branch} onChange={setBranch} disabled={locked} />
        <TenderForm
          key={debt.receivableId}
          amount={debt.balanceAmount}
          currency={debt.currencyCode}
          branchId={branch}
          exact={false}
          onLock={setLocked}
          onSuccess={setPaid}
          onSubmit={(t) =>
            reception.pay({
              ...t,
              memberId,
              branchId: branch,
              orderId: null,
              currencyCode: debt.currencyCode,
              source: "RECEPTION",
              allocations: [
                { receivableId: debt.receivableId, amount: t.totalAmount },
              ],
            })
          }
        />
      </div>
    );
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <h3 className="mb-3 font-semibold">Cuentas pendientes</h3>
      {q.data.items.length ? (
        <ul className="divide-y divide-line">
          {q.data.items.map((d) => (
            <li key={d.receivableId} className="py-4">
              <div className="flex justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{d.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    Vence {shortDate(d.dueDate)} · Total{" "}
                    {money(d.totalAmount, d.currencyCode)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">
                  {money(d.balanceAmount, d.currencyCode)}
                </p>
              </div>
              {can(user, "PAYMENTS.CREATE") && (
                <Button
                  className="mt-3"
                  variant="secondary"
                  size="sm"
                  onClick={() => setDebt(d)}
                >
                  Cobrar esta cuenta
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title="Sin deuda pendiente"
          description="Las cuentas consultadas no tienen saldo por cobrar."
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
export function AccessHistory({
  memberId,
  branchId,
}: {
  memberId?: number;
  branchId?: number;
}) {
  const [page, setPage] = useState(1);
  const [date, setDate] = useState(todayLima);
  const until = new Date(
    new Date(dayStartUtc(date)).getTime() + 86400000 - 1,
  ).toISOString();
  const q = useOperation(["access", memberId, branchId, date, page], (s) =>
    reception.events(
      { memberId, branchId, fromUtc: dayStartUtc(date), toUtc: until, page },
      s,
    ),
  );
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <h2 className="font-semibold">Historial de accesos</h2>
        <label className="text-xs text-muted">
          Fecha · Lima
          <input
            aria-label="Fecha de accesos"
            type="date"
            className="field mt-1"
            value={date}
            max={todayLima()}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                setPage(1);
              }
            }}
          />
        </label>
      </div>
      {q.isPending ? (
        <div className="px-5">
          <Loading />
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : q.data.items.length ? (
        <ul className="divide-y divide-line">
          {q.data.items.map((a) => (
            <li
              key={a.attendanceEventId}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div>
                <p className="text-sm font-semibold">{a.fullName}</p>
                <p className="mt-1 text-xs text-muted">
                  {a.memberCode} · {timeOfDay(a.occurredAtUtc)} ·{" "}
                  {a.accessMethod === "MANUAL" ? "Manual" : a.accessMethod}
                </p>
                {a.reasonCode && (
                  <p className="mt-1 max-w-sm text-xs text-muted">
                    {accessReason[a.reasonCode] ?? "Revisión de acceso"}
                  </p>
                )}
              </div>
              <Badge status={a.result} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title="Sin accesos en esta fecha"
          description="Aquí aparecen ingresos y también intentos bloqueados; estos últimos no cuentan como asistencia."
        />
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
export function MemberPayments({ memberId }: { memberId: number }) {
  const [page, setPage] = useState(1);
  const [receipt, setReceipt] = useState<string | null>(null);
  const q = useOperation(["payments", memberId, page], (s) =>
    reception.payments(memberId, page, s),
  );
  if (receipt)
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setReceipt(null)}>
          ← Pagos del socio
        </Button>
        <Receipt id={receipt} />
      </div>
    );
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <h3 className="font-semibold">Pagos del socio</h3>
      {q.data.items.length ? (
        <ul className="divide-y divide-line">
          {q.data.items.map((p) => (
            <li
              key={p.publicId}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div>
                <p className="text-sm font-semibold">
                  {money(p.totalAmount, p.currencyCode)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {shortDate(p.receivedAtUtc)} · {timeOfDay(p.receivedAtUtc)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReceipt(p.publicId)}
              >
                Ver constancia
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="Sin pagos registrados" />
      )}
      <Pagination
        page={page}
        total={q.data.total}
        totalPages={q.data.totalPages}
        onPage={setPage}
      />
    </div>
  );
}
export function ReserveClass({
  memberId,
  initialSession,
}: {
  memberId: number;
  initialSession?: number;
}) {
  const user = useSession();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [session, setSession] = useState(initialSession ?? 0);
  const q = useOperation(["classes", page], (s) => gymflow.classes(page, s));
  const mutation = useMutation({
    mutationFn: () => gymflow.reserveFor(session, memberId),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: [user.organizationPublicId] }),
  });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Reservar una clase</h3>
      {q.data.items.length ? (
        <>
          <label className="label">
            Sesión
            <select
              className="field mt-1"
              disabled={mutation.isPending || mutation.isSuccess}
              value={session}
              onChange={(e) => setSession(Number(e.target.value))}
            >
              <option value={0}>Seleccionar sesión</option>
              {q.data.items.map((c) => (
                <option key={c.classSessionId} value={c.classSessionId}>
                  {c.className} · {shortDate(c.startsAtUtc)}{" "}
                  {timeOfDay(c.startsAtUtc)} ·{" "}
                  {c.availablePlaces > 0
                    ? `${c.availablePlaces} cupos`
                    : "Lista de espera"}
                </option>
              ))}
            </select>
          </label>
          {q.data.totalPages > 1 && (
            <Pagination
              page={page}
              total={q.data.total}
              totalPages={q.data.totalPages}
              onPage={(p) => {
                if (!mutation.isPending && !mutation.isSuccess) {
                  setPage(p);
                  setSession(0);
                }
              }}
            />
          )}
          <p className="text-xs text-muted">
            Si el último cupo se ocupa antes de confirmar, la reserva ingresará
            a lista de espera.
          </p>
          {mutation.error && (
            <p role="alert" className="text-sm text-rose-700">
              {mutation.error.message}
            </p>
          )}
          {mutation.isSuccess ? (
            <>
              <p
                role="status"
                className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                Reserva registrada. Consulta su estado en la lista de
                participantes.
              </p>
              <ClassParticipants id={session} />
            </>
          ) : (
            <Button
              disabled={!session || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Reservando…" : "Confirmar reserva"}
            </Button>
          )}
        </>
      ) : (
        <Empty title="No hay sesiones próximas" />
      )}
    </div>
  );
}
const renewalSchema = z.object({
  planVersionId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export function RenewMembership({
  memberId,
  previousId,
  homeBranchId,
  suggestedDate,
}: {
  memberId: number;
  previousId: number | null;
  homeBranchId: number | null;
  suggestedDate: string;
}) {
  const user = useSession();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [requestId] = useState(() => crypto.randomUUID());
  const plans = useOperation(["plans", page], (s) =>
    gymflow.adminPlans({ page, status: "ACTIVE" }, s),
  );
  const form = useForm<z.infer<typeof renewalSchema>>({
    resolver: zodResolver(renewalSchema),
    defaultValues: { planVersionId: 0, startDate: suggestedDate },
  });
  const [submitted, setSubmitted] = useState<z.infer<
    typeof renewalSchema
  > | null>(null);
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof renewalSchema>) =>
      reception.membership({
        ...data,
        memberId,
        homeBranchId,
        previousMembershipId: previousId,
        origin: "RECEPTION",
        requestId,
      }),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: [user.organizationPublicId] }),
  });
  if (plans.isPending) return <Loading />;
  if (plans.error)
    return <ErrorState error={plans.error} retry={() => plans.refetch()} />;
  if (mutation.data)
    return (
      <div role="status" className="space-y-3 rounded-xl bg-emerald-50 p-5">
        <h3 className="font-semibold">Membresía registrada</h3>
        <p className="text-sm">
          {shortDate(mutation.data.startDate)} –{" "}
          {shortDate(mutation.data.endDate)} ·{" "}
          {money(mutation.data.contractedPrice, mutation.data.currencyCode)}
        </p>
        <p className="text-sm">
          {mutation.data.receivableId
            ? "Se generó la cuenta por cobrar. Registra el pago por separado en Cobrar."
            : "Este plan no genera deuda."}
        </p>
      </div>
    );
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit((data) => {
        setSubmitted(data);
        mutation.mutate(data);
      })}
    >
      <h3 className="font-semibold">
        {previousId ? "Renovar membresía" : "Activar membresía"}
      </h3>
      <fieldset disabled={!!submitted} className="space-y-4">
        <label className="label">
          Plan vigente
          <select
            className="field mt-1"
            {...form.register("planVersionId", { valueAsNumber: true })}
          >
            <option value={0}>Seleccionar plan</option>
            {plans.data.items
              .filter((p) => p.terms && p.planVersionId)
              .map((p) => (
                <option key={p.publicId} value={p.planVersionId!}>
                  {p.name} · {money(p.terms!.price, p.terms!.currencyCode)}
                </option>
              ))}
          </select>
        </label>
        <label className="label">
          Fecha de inicio
          <input
            type="date"
            className="field mt-1"
            {...form.register("startDate")}
          />
        </label>
      </fieldset>
      {plans.data.totalPages > 1 && (
        <Pagination
          page={page}
          total={plans.data.total}
          totalPages={plans.data.totalPages}
          onPage={(p) => {
            if (!submitted) setPage(p);
          }}
        />
      )}
      <p className="text-xs leading-5 text-muted">
        Se crea un contrato nuevo y, si tiene precio, una cuenta por cobrar.
        Esto no registra un pago ni movimiento de caja.{" "}
        {previousId
          ? "La membresía anterior conserva su historial y queda vinculada."
          : ""}
      </p>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-rose-700">
          Selecciona un plan y una fecha válidos.
        </p>
      )}
      {mutation.error && (
        <p role="alert" className="text-sm text-rose-700">
          {mutation.error.message}
        </p>
      )}
      {submitted ? (
        <Button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(submitted)}
        >
          {mutation.isPending
            ? "Registrando…"
            : "Reintentar la misma solicitud"}
        </Button>
      ) : (
        <Button type="submit">Confirmar membresía</Button>
      )}
    </form>
  );
}
