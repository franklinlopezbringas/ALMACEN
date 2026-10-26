"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  DoorOpen,
  Plus,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  ErrorState,
  Loading,
  NoPermission,
} from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import { can, homeFor } from "@/lib/auth/permissions";
import { money, shortDate, timeOfDay } from "@/lib/utils";
import { OperationalAlerts } from "./operational-alerts";
export function Dashboard() {
  const user = useSession();
  const base = homeFor(user.roles);
  const admin = user.roles.includes("ADMIN");
  const summary = useQuery({
    queryKey: [user.organizationPublicId, "dashboard"],
    queryFn: ({ signal }) => gymflow.dashboard(signal),
    enabled: can(user, "DASHBOARD.VIEW"),
  });
  const expiring = useQuery({
    queryKey: [user.organizationPublicId, "expiring"],
    queryFn: ({ signal }) => gymflow.expiring(signal),
    enabled: can(user, "MEMBERSHIPS.VIEW"),
  });
  const classes = useQuery({
    queryKey: [user.organizationPublicId, "classes", 1],
    queryFn: ({ signal }) => gymflow.classes(1, signal),
    enabled: can(user, "CLASSES.VIEW"),
  });
  if (!can(user, "DASHBOARD.VIEW")) return <NoPermission />;
  const stats = summary.data;
  const today = new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Lima",
  }).format(new Date());
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow mb-2 text-muted">VISTA GENERAL</p>
          <h1 className="text-[32px] leading-tight font-semibold tracking-[-1.3px]">
            {admin ? "Resumen del gimnasio" : "Tu gimnasio, en movimiento"}
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Socios, accesos y prioridades de la operación.
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-xs capitalize text-muted">
          <CalendarDays size={15} />
          {today}
        </span>
      </div>
      <section className="hero-lines relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-[20px] bg-ink px-7 py-5 text-white">
        <div className="relative z-10">
          <span className="eyebrow text-lime">GESTIÓN DIARIA</span>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Gestiona tu comunidad.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
            Registra socios y revisa sus datos de contacto.
          </p>
        </div>
        {can(user, "MEMBERS.CREATE") && (
          <Button asChild variant="lime">
            <Link href={base + "/socios?nuevo=1"}>
              <Plus />
              Registrar socio
            </Link>
          </Button>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-20 size-72 rounded-full border-[45px] border-white/[0.035]"
        />
      </section>
      {summary.isPending ? (
        <Loading />
      ) : summary.error ? (
        <ErrorState error={summary.error} retry={() => summary.refetch()} />
      ) : (
        stats && (
          <section
            aria-label="Indicadores del gimnasio"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {[
              {
                label: "Socios activos",
                value: stats.activeMembers,
                icon: Users,
                foot: "Comunidad actual",
                color: "bg-emerald-50 text-emerald-800",
              },
              {
                label: "Accesos de hoy",
                value: stats.entriesToday,
                icon: DoorOpen,
                foot: "Accesos permitidos",
                color: "bg-sky-50 text-sky-800",
              },
              {
                label: "Por vencer",
                value: stats.expiringMembershipsNext7Days,
                icon: Ticket,
                foot: "En los próximos 7 días",
                color: "bg-amber-50 text-amber-800",
              },
              {
                label: "Saldo por cobrar",
                value: money(stats.outstandingReceivables),
                icon: Wallet,
                foot: "Cuentas pendientes",
                color: "bg-violet-50 text-violet-800",
              },
            ].map((s) => (
              <article className="panel p-5" key={s.label}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted">{s.label}</p>
                  <span
                    className={
                      "grid size-9 place-items-center rounded-xl " + s.color
                    }
                  >
                    <s.icon size={17} />
                  </span>
                </div>
                <p className="mb-4 mt-5 text-3xl font-semibold tracking-[-1px]">
                  {s.value}
                </p>
                <div className="flex items-center gap-1.5 border-t border-line pt-3 text-xs text-muted">
                  <span className="size-1.5 rounded-full bg-primary/40" />
                  {s.foot}
                </div>
              </article>
            ))}
          </section>
        )
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
        {can(user, "MEMBERSHIPS.VIEW") && (
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line p-5">
              <div>
                <h2 className="font-semibold">Próximos vencimientos</h2>
                <p className="mt-1 text-xs text-muted">
                  Membresías activas · próximos 7 días.
                </p>
              </div>
              <Link
                href={base + "/membresias"}
                className="flex items-center gap-1 text-xs font-semibold text-primary"
              >
                Ver todas
                <ArrowUpRight size={15} />
              </Link>
            </div>
            {expiring.isPending ? (
              <div className="px-5">
                <Loading />
              </div>
            ) : expiring.error ? (
              <div className="p-5">
                <ErrorState
                  error={expiring.error}
                  retry={() => expiring.refetch()}
                />
              </div>
            ) : !expiring.data?.length ? (
              <Empty
                title="Todo al día"
                description="No hay membresías por vencer en los próximos 7 días."
              />
            ) : (
              <ul className="divide-y divide-line">
                {expiring.data.slice(0, 5).map((m) => (
                  <li
                    key={m.membershipPublicId}
                    className="flex items-center gap-3 px-5 py-4"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-xs font-semibold">
                      {m.fullName
                        .split(" ")
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {m.fullName}
                      </p>
                      <p className="mt-1 text-xs text-muted">{m.planName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium">
                        {shortDate(m.endDate)}
                      </p>
                      <p className="mt-1 text-[11px] text-amber-800">
                        {m.daysRemaining === 0
                          ? "Vence hoy"
                          : `En ${m.daysRemaining} días`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {can(user, "CLASSES.VIEW") && (
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line p-5">
              <div>
                <h2 className="font-semibold">Próximas clases</h2>
                <p className="mt-1 text-xs text-muted">
                  Horarios y plazas reservadas.
                </p>
              </div>
              <Link
                href={base + "/clases"}
                className="grid size-9 place-items-center rounded-lg border border-line"
                aria-label="Ver todas las clases"
              >
                <ArrowUpRight size={17} />
              </Link>
            </div>
            {classes.isPending ? (
              <div className="px-5">
                <Loading />
              </div>
            ) : classes.error ? (
              <div className="p-5">
                <ErrorState
                  error={classes.error}
                  retry={() => classes.refetch()}
                />
              </div>
            ) : !classes.data?.items.length ? (
              <Empty
                title="Una pausa en la agenda"
                description="Las próximas sesiones programadas aparecerán aquí."
              />
            ) : (
              <div className="space-y-3 p-5">
                {classes.data.items.slice(0, 3).map((c) => (
                  <div
                    key={c.classSessionId}
                    className="rounded-xl border border-line p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <h3 className="text-sm font-semibold">{c.className}</h3>
                      <span className="text-xs text-muted">
                        {c.reserved}/{c.capacity} plazas
                      </span>
                    </div>
                    <p className="my-3 flex items-center gap-1.5 text-xs text-muted">
                      <Clock3 size={13} />
                      {shortDate(c.startsAtUtc)} · {timeOfDay(c.startsAtUtc)}
                    </p>
                    <div
                      aria-label={`${c.reserved} de ${c.capacity} plazas reservadas`}
                      className="h-1.5 rounded-full bg-canvas"
                    >
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{
                          width: `${Math.min(100, c.capacity ? (c.reserved / c.capacity) * 100 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      {admin ? (
        <OperationalAlerts summary={summary.data} classes={classes.data} />
      ) : (
        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Conoce a tu comunidad",
              description: "Socios y contacto en un solo lugar.",
              url: "/socios",
              icon: Users,
              permission: "MEMBERS.VIEW",
            },
            {
              label: "De interés a compromiso",
              description: "Acompaña a tus próximos socios.",
              url: "/crm",
              icon: ArrowDownLeft,
              permission: "PROSPECTS.VIEW",
            },
            {
              label: "Una opción para cada meta",
              description: "Consulta los planes de tu gimnasio.",
              url: "/planes",
              icon: Ticket,
            },
          ]
            .filter((item) => can(user, item.permission))
            .map((item) => (
              <Link
                key={item.url}
                href={base + item.url}
                className="group flex items-center gap-4 rounded-2xl border border-line p-5 transition-colors hover:bg-white"
              >
                <item.icon size={22} className="shrink-0 text-primary" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">{item.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {item.description}
                  </p>
                </div>
                <ArrowRight
                  size={17}
                  className="text-muted transition-transform group-hover:translate-x-1"
                />
              </Link>
            ))}
        </section>
      )}
    </div>
  );
}
