"use client";
import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronRight,
  ContactRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
  DoorOpen,
  Clock3,
  X,
  type LucideIcon,
} from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { authApi } from "@/lib/api/client";
import {
  can,
  roleHome,
  roleLabel,
  type UserSession,
  type Role,
} from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
const SessionContext = createContext<UserSession | null>(null);
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Workspace session missing");
  return value;
}
type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
};
const adminNav: NavItem[] = [
  {
    path: "",
    label: "Resumen",
    icon: LayoutDashboard,
    permission: "DASHBOARD.VIEW",
  },
  { path: "/socios", label: "Socios", icon: Users, permission: "MEMBERS.VIEW" },
  {
    path: "/crm",
    label: "Prospectos",
    icon: ContactRound,
    permission: "PROSPECTS.VIEW",
  },
  {
    path: "/membresias",
    label: "Membresías",
    icon: Ticket,
    permission: "MEMBERSHIPS.VIEW",
  },
  {
    path: "/clases",
    label: "Clases",
    icon: CalendarDays,
    permission: "CLASSES.VIEW",
  },
  {
    path: "/catalogo",
    label: "Catálogo",
    icon: Package,
    permission: "STORE.VIEW",
  },
  { path: "/planes", label: "Planes", icon: Wallet },
  { path: "/solicitudes", label: "Solicitudes", icon: Bell },
  { path: "/notificaciones", label: "Notificaciones", icon: Bell },
];
const receptionNav: NavItem[] = [
  { path: "", label: "Inicio", icon: LayoutDashboard },
  { path: "/socios", label: "Socios", icon: Users, permission: "MEMBERS.VIEW" },
  {
    path: "/accesos",
    label: "Accesos",
    icon: DoorOpen,
    permission: "ACCESS.CHECKIN",
  },
  {
    path: "/pagos-caja",
    label: "Pagos y Caja",
    icon: Wallet,
    permission: "PAYMENTS.VIEW",
  },
  { path: "/tienda", label: "Tienda", icon: Package, permission: "STORE.VIEW" },
  {
    path: "/clases",
    label: "Clases",
    icon: CalendarDays,
    permission: "CLASSES.VIEW",
  },
  { path: "/atencion", label: "Atención", icon: ContactRound },
  {
    path: "/mi-turno",
    label: "Mi turno",
    icon: Clock3,
    permission: "CASH.VIEW",
  },
];
const memberNav: NavItem[] = [
  { path: "", label: "Mi espacio", icon: LayoutDashboard },
  {
    path: "/clases",
    label: "Clases",
    icon: CalendarDays,
    permission: "CLASSES.VIEW",
  },
  {
    path: "/catalogo",
    label: "Catálogo",
    icon: Package,
    permission: "STORE.VIEW",
  },
  {
    path: "/premios",
    label: "GymPoints",
    icon: Ticket,
    permission: "LOYALTY.VIEW",
  },
  { path: "/notificaciones", label: "Notificaciones", icon: Bell },
];
const trainerNav: NavItem[] = [
  {
    path: "",
    label: "Mis socios",
    icon: Users,
    permission: "TRAINING.MEMBERS_VIEW",
  },
  {
    path: "/clases",
    label: "Agenda de clases",
    icon: CalendarDays,
    permission: "CLASSES.VIEW",
  },
  { path: "/notificaciones", label: "Notificaciones", icon: Bell },
];
export function WorkspaceShell({
  user,
  role,
  children,
}: {
  user: UserSession;
  role: Role;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobile, setMobile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const base = roleHome[role];
  const nav = (
    role === "MEMBER"
      ? memberNav
      : role === "TRAINER"
        ? trainerNav
        : role === "RECEPTION"
          ? receptionNav
          : adminNav
  ).filter((n) => can(user, n.permission));
  const current =
    nav.find((n) =>
      n.path ? pathname.startsWith(base + n.path) : pathname === base,
    )?.label ?? "Mi espacio";
  async function logout() {
    setSigningOut(true);
    try {
      await authApi.logout();
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("No se pudo cerrar la sesión. Intenta de nuevo.");
      setSigningOut(false);
    }
  }
  const navigation = (
    <>
      <div className="flex items-center gap-3 border-y border-white/10 py-5">
        <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-lime">
          <Settings2 size={19} />
        </span>
        <div>
          <p className="text-sm font-semibold">
            {process.env.NEXT_PUBLIC_ORGANIZATION_NAME ?? "GymFlow"}
          </p>
          <p className="mt-1 text-xs text-white/50">Espacio de trabajo</p>
        </div>
      </div>
      <p className="eyebrow mb-3 mt-7 text-white/40">
        {role === "MEMBER" ? "Mi gimnasio" : "Gestión"}
      </p>
      <nav aria-label="Navegación principal" className="space-y-1">
        {nav.map((n) => {
          const active = n.path
            ? pathname.startsWith(base + n.path)
            : pathname === base;
          return (
            <Link
              onClick={() => setMobile(false)}
              aria-current={active ? "page" : undefined}
              key={n.path}
              href={base + n.path}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition-colors",
                active
                  ? "bg-lime font-semibold text-ink"
                  : "text-white/65 hover:bg-white/10 hover:text-white",
              )}
            >
              <n.icon size={19} />
              {n.label}
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-12">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <ShieldCheck className="mb-3 text-lime" size={21} />
          <p className="text-sm font-semibold">
            {role === "ADMIN"
              ? "Administración"
              : role === "RECEPTION"
                ? "Operación de recepción"
                : "Cada detalle cuenta."}
          </p>
          <p className="mt-2 text-xs leading-5 text-white/55">
            {role === "ADMIN"
              ? "Socios, membresías y operación del gimnasio."
              : role === "RECEPTION"
                ? "Socios, cobros y accesos. Tu jornada, en un solo lugar."
                : "Más tiempo para tu comunidad. Todo lo demás, en su lugar."}
          </p>
        </div>
        <Link
          href="/"
          className="mt-5 flex items-center gap-2 px-2 text-xs text-white/55 hover:text-white"
        >
          Ver web pública
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </>
  );
  return (
    <SessionContext.Provider value={user}>
      <div className="min-h-dvh">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col overflow-y-auto overscroll-contain bg-ink px-5 py-7 text-white lg:flex">
          <div className="mb-8 px-2">
            <Brand dark />
          </div>
          {navigation}
        </aside>
        <Dialog
          open={mobile}
          onOpenChange={setMobile}
          title="Tu espacio GymFlow"
          description="Elige una sección para continuar."
        >
          <div className="-mx-6 -mb-6 flex flex-col rounded-b-2xl bg-ink p-5 text-white">
            {navigation}
          </div>
        </Dialog>
        <div className="lg:pl-[244px]">
          <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-line bg-white/95 px-5 backdrop-blur-md lg:px-9">
            <div className="flex items-center gap-3">
              <Button
                className="lg:hidden"
                variant="ghost"
                size="icon"
                aria-label="Abrir menú"
                onClick={() => setMobile(true)}
              >
                <Menu />
              </Button>
              <div className="hidden items-center gap-2 text-sm text-muted sm:flex">
                <span>{roleLabel[role]}</span>
                <ChevronRight size={13} />
                <span className="font-medium text-ink">{current}</span>
              </div>
              <span className="text-lg font-semibold sm:hidden">GymFlow</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {can(user, "MEMBERS.VIEW") && (
                <Link
                  className="hidden items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-muted md:flex"
                  href={base + "/socios"}
                >
                  <Search size={15} />
                  Buscar socio
                </Link>
              )}
              <Link
                href={
                  role === "RECEPTION"
                    ? base + "/atencion?tab=avisos"
                    : base + "/notificaciones"
                }
                aria-label="Ver notificaciones"
                className="grid size-10 place-items-center rounded-lg text-muted hover:bg-canvas"
              >
                <Bell size={19} />
              </Link>
              <span className="hidden h-7 w-px bg-line sm:block" />
              <div className="hidden text-right xl:block">
                <p className="max-w-48 truncate text-xs font-semibold">
                  {user.email}
                </p>
                <p className="mt-1 text-[11px] text-muted">{roleLabel[role]}</p>
              </div>
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-full border border-line bg-canvas text-sm font-semibold"
              >
                {user.email.slice(0, 2).toUpperCase()}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar sesión"
                disabled={signingOut}
                onClick={logout}
              >
                <LogOut />
              </Button>
            </div>
          </header>
          <main
            id="main-content"
            className="mx-auto max-w-[1600px] px-5 py-7 md:px-8 lg:p-9"
          >
            {error && (
              <p
                role="alert"
                className="mb-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-800"
              >
                {error}
                <button
                  className="float-right"
                  aria-label="Descartar error"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </p>
            )}
            {children}
          </main>
          <footer className="flex flex-wrap justify-between gap-2 px-8 py-6 text-[11px] text-muted">
            <span>
              {role === "ADMIN"
                ? "GymFlow · Administración del gimnasio"
                : "GymFlow · Más cerca de tu comunidad."}
            </span>
            <span>Tu información, en tu espacio.</span>
          </footer>
        </div>
      </div>
    </SessionContext.Provider>
  );
}
