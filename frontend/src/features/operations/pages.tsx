"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  Check,
  Clock3,
  Gift,
  Package,
  Ticket,
  Users,
} from "lucide-react";
import { gymflow } from "@/lib/api/gymflow";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { money, shortDate, timeOfDay } from "@/lib/utils";
import { ClassParticipants } from "./class-participants";
import { can } from "@/lib/auth/permissions";
export function PageHeading({
  title,
  subtitle,
  kicker = "TU GIMNASIO",
}: {
  title: string;
  subtitle: string;
  kicker?: string;
}) {
  return (
    <div className="mb-7">
      <p className="eyebrow mb-2 text-muted">{kicker}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>
    </div>
  );
}
export function MembershipsPage({
  administrative = false,
}: {
  administrative?: boolean;
}) {
  const user = useSession();
  const [days, setDays] = useState(7);
  const q = useQuery({
    queryKey: [user.organizationPublicId, "expiring", days],
    queryFn: ({ signal }) => gymflow.expiring(signal, days),
  });
  return (
    <>
      <PageHeading
        title={administrative ? "Membresías" : "Membresías por vencer"}
        subtitle="Vista disponible: membresías activas próximas a vencer."
      />
      {administrative && (
        <div className="panel mb-5 flex flex-wrap items-center justify-between gap-4 p-4">
          <span className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            Por vencer
          </span>
          <div className="flex items-center gap-3">
            <label htmlFor="membership-period" className="text-sm text-muted">
              Periodo
            </label>
            <select
              id="membership-period"
              className="field w-auto"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[7, 15, 30, 90].map((d) => (
                <option key={d} value={d}>
                  Próximos {d} días
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <section className="panel overflow-hidden">
        {q.isPending ? (
          <div className="p-5">
            <Loading />
          </div>
        ) : q.error ? (
          <div className="p-5">
            <ErrorState error={q.error} retry={() => q.refetch()} />
          </div>
        ) : !q.data?.length ? (
          <Empty
            title="Sin vencimientos en este periodo"
            description={`No hay membresías activas por vencer en los próximos ${days} días.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Socio</th>
                  <th>Plan</th>
                  <th>Vencimiento</th>
                  <th>Tiempo restante</th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((m) => (
                  <tr key={m.membershipPublicId}>
                    <td>
                      <p className="font-semibold">{m.fullName}</p>
                      <p className="mt-1 text-xs text-muted">{m.memberCode}</p>
                    </td>
                    <td>{m.planName}</td>
                    <td>{shortDate(m.endDate)}</td>
                    <td>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
                        {m.daysRemaining === 0
                          ? "Hoy"
                          : m.daysRemaining + " días"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line p-4 text-xs text-muted">
              {q.data.length} vencimientos · Hasta 100 resultados próximos
            </p>
          </div>
        )}
      </section>
    </>
  );
}
export function ClassesPage() {
  const user = useSession();
  const admin = user.roles.includes("ADMIN");
  const [selected, setSelected] = useState<
    Awaited<ReturnType<typeof gymflow.classes>>["items"][number] | null
  >(null);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: [user.organizationPublicId, "classes", page],
    queryFn: ({ signal }) => gymflow.classes(page, signal),
  });
  const reserve = useMutation({
    mutationFn: gymflow.reserve,
    onSuccess: () => {
      cache.invalidateQueries({
        queryKey: [user.organizationPublicId, "classes"],
      });
      setNotice(
        "Solicitud registrada. Si el cupo está completo, pasas a la lista de espera.",
      );
    },
  });
  const allow = user.roles.includes("MEMBER") && can(user, "CLASSES.RESERVE");
  return (
    <>
      <PageHeading
        title="Agenda de clases"
        subtitle={
          admin
            ? "Consulta fecha, horario, estado y ocupación de cada sesión. Hora de Lima."
            : "Encuentros que impulsan tu comunidad. Horarios en hora de Lima."
        }
      />
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {reserve.error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800"
        >
          {reserve.error.message}
        </p>
      )}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <div className="panel">
          <Empty
            title="Pronto, más movimiento"
            description="Aquí aparecerán las próximas sesiones programadas de tu gimnasio."
          />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {q.data.items.map((c) => (
            <article key={c.classSessionId} className="panel p-6">
              <div className="mb-5 flex justify-between">
                <span className="rounded-xl bg-canvas p-3 text-primary">
                  <CalendarDays size={24} />
                </span>
                <Badge status={c.status} />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                {c.className}
              </h2>
              {admin && (
                <p className="mt-2 text-sm text-muted">
                  Coach: {c.coachName ?? "Sin asignar"}
                </p>
              )}
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <CalendarDays size={15} />
                {shortDate(c.startsAtUtc)}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <Clock3 size={15} />
                {timeOfDay(c.startsAtUtc)} – {timeOfDay(c.endsAtUtc)}
              </p>
              <div className="mb-2 mt-6 flex justify-between text-xs">
                <span className="text-muted">Plazas reservadas</span>
                <span className="font-semibold">
                  {c.reserved} / {c.capacity}
                </span>
              </div>
              <div className="h-2 rounded-full bg-canvas">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, c.capacity ? (c.reserved / c.capacity) * 100 : 0)}%`,
                  }}
                />
              </div>
              {admin && (
                <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted">
                    {c.availablePlaces} plazas libres
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Ver sesión ${c.className}`}
                    onClick={() => setSelected(c)}
                  >
                    Ver sesión
                  </Button>
                </div>
              )}
              {allow && (
                <Button
                  className="mt-5 w-full"
                  disabled={reserve.isPending}
                  onClick={() => reserve.mutate(c.classSessionId)}
                >
                  {reserve.isPending
                    ? "Procesando…"
                    : c.reserved >= c.capacity
                      ? "Unirme a la lista de espera"
                      : "Reservar plaza"}
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      {q.data && (
        <div className="mt-5">
          <Pagination
            page={page}
            totalPages={q.data.totalPages}
            total={q.data.total}
            onPage={setPage}
          />
        </div>
      )}
      {admin && (
        <Dialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={selected?.className ?? "Sesión"}
          description="Resumen de la sesión · hora de Lima."
        >
          {selected && (
            <div className="space-y-5">
              <Badge status={selected.status} />
              <dl className="grid grid-cols-2 gap-5 text-sm">
                <div>
                  <dt className="text-xs text-muted">Fecha</dt>
                  <dd className="mt-1">{shortDate(selected.startsAtUtc)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Horario</dt>
                  <dd className="mt-1">
                    {timeOfDay(selected.startsAtUtc)} –{" "}
                    {timeOfDay(selected.endsAtUtc)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Capacidad</dt>
                  <dd className="mt-1">{selected.capacity} plazas</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Reservadas / asistidas</dt>
                  <dd className="mt-1">{selected.reserved}</dd>
                </div>
              </dl>
              <p className="text-sm text-muted">
                Coach: {selected.coachName ?? "Sin asignar"}
              </p>
              {(can(user, "CLASSES.MANAGE") ||
                can(user, "CLASSES.RESERVE_FOR_OTHERS") ||
                can(user, "TRAINING.MEMBERS_VIEW")) && (
                <ClassParticipants
                  key={selected.classSessionId}
                  id={selected.classSessionId}
                />
              )}
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
export function ProductsPage() {
  const user = useSession();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: [user.organizationPublicId, "products", page],
    queryFn: ({ signal }) => gymflow.products("", page, signal),
  });
  return (
    <>
      <PageHeading
        title="Catálogo del gimnasio"
        subtitle="Productos para acompañar cada entrenamiento."
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <div className="panel">
          <Empty
            title="Un catálogo por descubrir"
            description="Los productos disponibles aparecerán aquí."
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.items.map((p) => (
            <article key={p.publicId} className="panel overflow-hidden">
              <div className="flex h-32 items-center justify-center bg-[linear-gradient(120deg,#e8eee3,#f5f7f1)] text-primary/60">
                <Package size={42} strokeWidth={1.2} />
              </div>
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="eyebrow text-muted">{p.sku}</span>
                  <Badge status={p.status} />
                </div>
                <h2 className="text-lg font-semibold">{p.name}</h2>
                <div className="mt-5 flex justify-between">
                  <p className="text-xl font-semibold">
                    {money(p.price, p.currencyCode)}
                  </p>
                  <span className="text-xs text-muted">
                    {p.stock === null
                      ? "Consultar disponibilidad"
                      : p.stock + " disponibles"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {q.data && (
        <Pagination
          page={page}
          totalPages={q.data.totalPages}
          total={q.data.total}
          onPage={setPage}
        />
      )}
    </>
  );
}
export function NotificationsPage() {
  const user = useSession();
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: [user.organizationPublicId, "notifications", user.email, page],
    queryFn: ({ signal }) => gymflow.notifications(page, signal),
  });
  const read = useMutation({
    mutationFn: gymflow.markRead,
    onSuccess: () =>
      cache.invalidateQueries({
        queryKey: [user.organizationPublicId, "notifications"],
      }),
  });
  return (
    <>
      <PageHeading
        title="Tus notificaciones"
        subtitle="Lo importante, a la vista. Estos mensajes son solo para ti."
      />
      <section className="panel overflow-hidden">
        {read.error && (
          <p role="alert" className="p-5 text-sm text-rose-700">
            {read.error.message}
          </p>
        )}
        {q.isPending ? (
          <div className="p-5">
            <Loading />
          </div>
        ) : q.error ? (
          <div className="p-5">
            <ErrorState error={q.error} retry={() => q.refetch()} />
          </div>
        ) : !q.data?.items.length ? (
          <Empty
            title="Estás al día"
            description="Cuando tengas novedades, las encontrarás aquí."
          />
        ) : (
          <ul className="divide-y divide-line">
            {q.data.items.map((n) => (
              <li key={n.id} className="flex flex-wrap gap-4 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-canvas text-primary">
                  <Bell size={20} />
                </span>
                <div className="min-w-40 flex-1">
                  <h2 className="text-sm font-semibold">{n.title}</h2>
                  <p className="my-2 text-sm leading-6 text-muted">{n.body}</p>
                  <p className="text-xs text-muted">
                    {shortDate(n.createdAtUtc)}
                  </p>
                </div>
                {!n.readAtUtc ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={read.isPending}
                    onClick={() => read.mutate(n.id)}
                  >
                    <Check />
                    Marcar leído
                  </Button>
                ) : (
                  <span className="text-xs text-muted">Leído</span>
                )}
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
    </>
  );
}
export function TrainerPage() {
  const user = useSession();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: [user.organizationPublicId, "assigned", user.email, page],
    queryFn: ({ signal }) => gymflow.assigned(page, signal),
  });
  return (
    <>
      <PageHeading
        title="Personas que avanzan contigo"
        subtitle="Tu comunidad asignada. Acompaña cada objetivo, un entrenamiento a la vez."
        kicker="ESPACIO DEL ENTRENADOR"
      />
      <section className="panel overflow-hidden">
        {q.isPending ? (
          <div className="p-5">
            <Loading />
          </div>
        ) : q.error ? (
          <div className="p-5">
            <ErrorState error={q.error} retry={() => q.refetch()} />
          </div>
        ) : !q.data?.items.length ? (
          <Empty
            title="Tu próximo acompañamiento está por empezar"
            description="Los socios asignados a tu perfil aparecerán aquí."
          />
        ) : (
          <div className="divide-y divide-line">
            {q.data.items.map((m) => (
              <div className="flex items-center gap-4 p-5" key={m.memberId}>
                <span className="rounded-xl bg-canvas p-3 text-primary">
                  <Users size={22} />
                </span>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold">{m.fullName}</h2>
                  <p className="mt-1 text-xs text-muted">{m.memberCode}</p>
                </div>
                {m.membershipStatus ? (
                  <Badge status={m.membershipStatus} />
                ) : (
                  <span className="text-xs text-muted">
                    Sin membresía vigente
                  </span>
                )}
              </div>
            ))}
          </div>
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
    </>
  );
}
export function RewardsPage() {
  const user = useSession();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: [user.organizationPublicId, "rewards", page],
    queryFn: ({ signal }) => gymflow.rewards(page, signal),
  });
  const balance = useQuery({
    queryKey: [user.organizationPublicId, "balance", user.email],
    queryFn: ({ signal }) => gymflow.balance(signal),
  });
  return (
    <>
      <PageHeading
        title="Tu constancia tiene recompensa"
        subtitle="Descubre los beneficios de seguir en movimiento."
        kicker="GYMPOINTS"
      />
      <section className="hero-lines mb-6 rounded-2xl bg-ink p-7 text-white">
        <p className="text-sm text-white/60">Tus GymPoints disponibles</p>
        {balance.isPending ? (
          <p className="mt-4">Cargando saldo…</p>
        ) : balance.error ? (
          <p role="alert" className="mt-4 text-sm">
            {balance.error.message}
          </p>
        ) : (
          <p className="my-3 text-5xl font-semibold tracking-tight text-lime">
            {balance.data?.currentBalance.toLocaleString("es-PE")}{" "}
            <span className="text-base">pts</span>
          </p>
        )}
        <p className="text-xs text-white/55">Cada paso suma a tu historia.</p>
      </section>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <div className="panel">
          <Empty title="Pronto, nuevas recompensas" />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.items.map((r) => (
            <article key={r.publicId} className="panel p-6">
              <Gift className="mb-5 text-primary" size={28} />
              <h2 className="text-lg font-semibold">{r.name}</h2>
              <p className="my-3 text-sm leading-6 text-muted">
                {r.description}
              </p>
              <p className="font-semibold text-primary">
                {r.pointsCost} GymPoints
              </p>
            </article>
          ))}
        </div>
      )}
      {q.data && (
        <Pagination
          page={page}
          totalPages={q.data.totalPages}
          total={q.data.total}
          onPage={setPage}
        />
      )}
      <p className="mt-5 text-xs text-muted">
        Consulta con recepción para gestionar tus recompensas.
      </p>
    </>
  );
}
export function MemberHome() {
  return (
    <>
      <div className="hero-lines mb-8 flex items-center justify-between rounded-2xl bg-ink p-8 text-white">
        <div>
          <p className="eyebrow text-lime">ESTE ES TU ESPACIO</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Tu mejor versión, un día a la vez.
          </h1>
          <p className="mt-3 text-sm text-white/60">
            Encuentra una clase y sigue sumando a tu meta.
          </p>
        </div>
        <Ticket size={40} className="hidden text-lime md:block" />
      </div>
      <ClassesPage />
    </>
  );
}
