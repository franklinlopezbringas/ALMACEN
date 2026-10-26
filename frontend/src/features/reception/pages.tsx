"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  DoorOpen,
  Users,
  Wallet,
  ShoppingBag,
} from "lucide-react";
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
import { gymflow } from "@/lib/api/gymflow";
import { reception } from "@/lib/api/reception";
import { can } from "@/lib/auth/permissions";
import { shortDate, timeOfDay, money } from "@/lib/utils";
import { PeoplePage } from "@/features/people/people-page";
import { NotificationsPage } from "@/features/operations/pages";
import { ClassParticipants } from "@/features/operations/class-participants";
import {
  MemberLookup,
  ReceptionHeading,
  useOperation,
  todayLima,
  dayStartUtc,
} from "./common";
import { ReceptionMembers, MemberDialog } from "./members";
import { Handoffs } from "./handoffs";
import { Incidents, Messages } from "./attention";
import { CashWorkspace } from "./cash";

export function ReceptionHome() {
  const user = useSession();
  const shifts = useOperation(
    ["open-shifts"],
    (s) => reception.openShifts(s),
    can(user, "CASH.VIEW"),
  );
  const context = useOperation(
    ["context"],
    (s) => reception.context(s),
    can(user, "CASH.VIEW"),
  );
  const expiring = useOperation(
    ["expiring"],
    (s) => gymflow.expiring(s, 7),
    can(user, "MEMBERSHIPS.VIEW"),
  );
  const events = useOperation(
    ["recent"],
    (s) =>
      reception.events(
        { fromUtc: dayStartUtc(todayLima()), page: 1, pageSize: 5 },
        s,
      ),
    can(user, "ACCESS.CHECKIN"),
  );
  const open = shifts.data?.items.filter((s) => s.status === "OPEN") ?? [];
  return (
    <div className="space-y-6">
      <ReceptionHeading
        title="Inicio"
        description="Socios, ingresos y prioridades de atención. Todo a mano para tu jornada."
      />
      <div className="hero-lines flex flex-wrap items-center justify-between gap-5 rounded-[20px] bg-ink px-6 py-5 text-white">
        <div>
          <p className="eyebrow text-lime">MOSTRADOR GYMFLOW</p>
          <h2 className="mt-2 text-xl font-semibold">¿A quién atendemos?</h2>
          <p className="mt-2 text-sm text-white/65">
            Busca un socio para cobrar, registrar un ingreso o reservar una
            clase.
          </p>
        </div>
        <Button asChild variant="lime">
          <Link href="/recepcion/socios">
            <Users />
            Buscar socio
          </Link>
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["/accesos", "Registrar ingreso", DoorOpen, "ACCESS.CHECKIN"],
            ["/pagos-caja", "Cobrar a un socio", Wallet, "PAYMENTS.VIEW"],
            ["/tienda", "Nueva venta", ShoppingBag, "STORE.VIEW"],
            ["/clases", "Reservar clase", CalendarDays, "CLASSES.VIEW"],
          ] as const
        ).map(
          ([path, label, Icon, permission]) =>
            can(user, permission as string) && (
              <Link
                key={path as string}
                href={"/recepcion" + path}
                className="panel flex items-center gap-3 p-4 text-sm font-semibold transition-colors hover:border-primary"
              >
                <span className="rounded-lg bg-canvas p-2 text-primary">
                  <Icon size={20} />
                </span>
                {label as string}
                <ArrowUpRight size={16} className="ml-auto text-muted" />
              </Link>
            ),
        )}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Caja actual</h2>
            <Link
              className="text-xs font-semibold text-primary"
              href="/recepcion/mi-turno"
            >
              Ver mi turno →
            </Link>
          </div>
          {!can(user, "CASH.VIEW") ? (
            <NoPermission />
          ) : shifts.isPending || context.isPending ? (
            <Loading />
          ) : shifts.error || context.error ? (
            <ErrorState
              error={(shifts.error ?? context.error)!}
              retry={() => {
                shifts.refetch();
                context.refetch();
              }}
            />
          ) : open.length ? (
            <ul className="mt-4 space-y-4">
              {open.map((s) => (
                <li key={s.cashShiftId} className="rounded-xl bg-canvas p-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">
                      {s.registerName}
                    </span>
                    <Badge status={s.status} />
                  </div>
                  <p className="mt-3 text-2xl font-semibold">
                    {money(s.expectedAmount, context.data.currencyCode)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Efectivo esperado · Apertura {timeOfDay(s.openedAtUtc)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-xl bg-canvas p-5">
              <p className="font-semibold">Sin caja abierta</p>
              <p className="mt-2 text-sm text-muted">
                Abre tu caja antes de recibir efectivo.
              </p>
              <Button asChild variant="secondary" className="mt-4">
                <Link href="/recepcion/mi-turno">Ir a apertura</Link>
              </Button>
            </div>
          )}
        </section>
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <h2 className="font-semibold">Membresías por vencer</h2>
            <span className="text-xs text-muted">Próximos 7 días</span>
          </div>
          {!can(user, "MEMBERSHIPS.VIEW") ? (
            <NoPermission />
          ) : expiring.isPending ? (
            <Loading />
          ) : expiring.error ? (
            <ErrorState
              error={expiring.error}
              retry={() => expiring.refetch()}
            />
          ) : expiring.data.length ? (
            <ul className="divide-y divide-line">
              {expiring.data.slice(0, 5).map((m) => (
                <li key={m.membershipPublicId} className="px-5 py-4">
                  <p className="text-sm font-semibold">{m.fullName}</p>
                  <div className="mt-1 flex justify-between gap-3 text-xs text-muted">
                    <span>
                      {m.memberCode} · {m.planName}
                    </span>
                    <span>{shortDate(m.endDate)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="Sin vencimientos próximos"
              description="No hay membresías activas por vencer en los próximos 7 días."
            />
          )}
          <Link
            className="block border-t border-line px-5 py-4 text-sm font-semibold text-primary"
            href="/recepcion/socios"
          >
            Consultar ficha y renovar →
          </Link>
        </section>
      </div>
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <h2 className="font-semibold">Accesos recientes</h2>
          <Link
            href="/recepcion/accesos"
            className="text-xs font-semibold text-primary"
          >
            Historial del día →
          </Link>
        </div>
        {!can(user, "ACCESS.CHECKIN") ? (
          <NoPermission />
        ) : events.isPending ? (
          <Loading />
        ) : events.error ? (
          <ErrorState error={events.error} retry={() => events.refetch()} />
        ) : events.data.items.length ? (
          <ul className="divide-y divide-line">
            {events.data.items.map((e) => (
              <li
                key={e.attendanceEventId}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{e.fullName}</p>
                  <p className="mt-1 text-xs text-muted">
                    {e.memberCode} · {timeOfDay(e.occurredAtUtc)}
                  </p>
                </div>
                <Badge status={e.result} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            title="Aún no hay accesos hoy"
            description="Los ingresos confirmados y los intentos bloqueados aparecerán aquí."
          />
        )}
      </section>
      <div className="panel p-5">
        <h2 className="font-semibold">Continuar una atención</h2>
        <p className="mt-2 text-sm text-muted">
          Consulta deudas por socio en Pagos y Caja, y seguimientos pendientes
          en Atención.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/recepcion/pagos-caja">Consultar deuda</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/recepcion/atencion">Ver seguimientos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
export function ReceptionPayments() {
  const user = useSession();
  return (
    <div className="space-y-7">
      <ReceptionHeading
        title="Pagos y Caja"
        description="Consulta deuda, registra cobros parciales o mixtos y controla tu efectivo."
      />
      {can(user, "CASH.VIEW") && <CashWorkspace />}
      <ReceptionMembers paymentMode />
    </div>
  );
}
export function ReceptionShift() {
  return (
    <div className="space-y-6">
      <ReceptionHeading
        title="Mi turno"
        description="Caja y entrega de notas y pendientes al siguiente operador."
      />
      <Handoffs />
      <CashWorkspace />
    </div>
  );
}
export function ReceptionClasses() {
  const user = useSession();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [from, setFrom] = useState(todayLima());
  const [reserve, setReserve] = useState<number | null>(null);
  const [member, setMember] = useState<string | null>(null);
  const q = useOperation(["classes", page, from], (s) =>
    gymflow.classes(page, s, dayStartUtc(from)),
  );
  return (
    <div className="space-y-6">
      <ReceptionHeading
        title="Clases"
        description="Próximas sesiones, cupos y reservas. Horarios en hora de Lima."
      />
      <label className="label block max-w-xs">
        Sesiones desde (Lima)
        <input
          type="date"
          className="field mt-1"
          value={from}
          onChange={(e) => {
            if (e.target.value) {
              setFrom(e.target.value);
              setPage(1);
            }
          }}
        />
      </label>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <div className="panel">
          <Empty title="No hay sesiones próximas" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {q.data.items.map((c) => (
            <article className="panel p-5" key={c.classSessionId}>
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{c.className}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {shortDate(c.startsAtUtc)} · {timeOfDay(c.startsAtUtc)} –{" "}
                    {timeOfDay(c.endsAtUtc)}
                  </p>
                </div>
                <Badge status={c.status} />
              </div>
              <p className="mt-4 text-sm text-muted">
                Coach: {c.coachName ?? "Por asignar"}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-canvas p-4">
                <span className="text-sm">
                  {c.reserved} / {c.capacity} plazas
                </span>
                <strong className="text-sm">
                  {c.availablePlaces > 0
                    ? `${c.availablePlaces} libres`
                    : "Lista de espera"}
                </strong>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {can(user, "CLASSES.RESERVE_FOR_OTHERS") && (
                  <Button onClick={() => setReserve(c.classSessionId)}>
                    Reservar para socio
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => setSelected(c.classSessionId)}
                >
                  Participantes
                </Button>
              </div>
            </article>
          ))}
        </div>
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
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title="Participantes"
        description="Reservas confirmadas, asistencia registrada y lista de espera."
      >
        {selected && (
          <ClassParticipants
            id={selected}
            operational
            session={q.data?.items.find((c) => c.classSessionId === selected)}
          />
        )}
      </Dialog>
      <Dialog
        open={!!reserve && !member}
        onOpenChange={(v) => {
          if (!v) setReserve(null);
        }}
        title="Elegir socio"
        description="Busca al socio para reservar esta sesión."
      >
        <MemberLookup
          label="Reservar"
          onSelect={(m) => setMember(m.publicId)}
        />
      </Dialog>
      <MemberDialog
        id={member}
        onClose={() => {
          setMember(null);
          setReserve(null);
        }}
        initialAction="reservar"
        sessionId={reserve ?? undefined}
      />
    </div>
  );
}
export function ReceptionAttention() {
  const user = useSession();
  const params = useSearchParams();
  const [tab, setTab] = useState(
    ["avisos", "incidencias", "mensajes"].includes(params.get("tab") ?? "")
      ? params.get("tab")!
      : "prospectos",
  );
  return (
    <div className="space-y-6">
      <ReceptionHeading
        title="Atención"
        description="Prospectos, próximos contactos y avisos para tu operación."
      />
      <div className="flex flex-wrap gap-2" aria-label="Secciones de atención">
        {[
          ["prospectos", "Prospectos"],
          ["avisos", "Notificaciones"],
          ["incidencias", "Incidencias"],
          ["mensajes", "Mensajes"],
        ].map(([id, label]) => (
          <Button
            key={id}
            variant={tab === id ? "default" : "secondary"}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "prospectos" ? (
        can(user, "PROSPECTS.VIEW") ? (
          <PeoplePage prospect />
        ) : (
          <NoPermission />
        )
      ) : tab === "incidencias" ? (
        can(user, "MESSAGES.USE") ? (
          <Incidents />
        ) : (
          <NoPermission />
        )
      ) : tab === "mensajes" ? (
        can(user, "MESSAGES.USE") ? (
          <Messages />
        ) : (
          <NoPermission />
        )
      ) : (
        <NotificationsPage />
      )}
    </div>
  );
}
