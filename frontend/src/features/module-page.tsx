import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { can, type Role } from "@/lib/auth/permissions";
import { Loading, NoPermission } from "@/components/ui/states";
import { PeoplePage } from "./people/people-page";
import {
  ClassesPage,
  MembershipsPage,
  NotificationsPage,
  ProductsPage,
  RewardsPage,
  PageHeading,
} from "./operations/pages";
import { PlanCatalog } from "./plans/plan-catalog";
import { AdminProductsPage } from "./operations/admin-products";
import { AdminMembershipsPage } from "./operations/admin-memberships";
import { AdminPlans } from "./plans/admin-plans";
import { Exceptions } from "./reception/exceptions";
import { Returns } from "./reception/returns";
const permissions: Record<string, string | undefined> = {
  socios: "MEMBERS.VIEW",
  crm: "PROSPECTS.VIEW",
  membresias: "MEMBERSHIPS.VIEW",
  clases: "CLASSES.VIEW",
  catalogo: "STORE.VIEW",
  planes: undefined,
  notificaciones: undefined,
  premios: "LOYALTY.VIEW",
};
const sections: Record<Role, string[]> = {
  ADMIN: [
    "solicitudes",
    "socios",
    "crm",
    "membresias",
    "clases",
    "catalogo",
    "planes",
    "notificaciones",
  ],
  RECEPTION: [
    "socios",
    "crm",
    "membresias",
    "clases",
    "catalogo",
    "planes",
    "notificaciones",
  ],
  TRAINER: ["clases", "notificaciones"],
  MEMBER: ["clases", "catalogo", "premios", "notificaciones"],
};
export async function ModulePage({
  role,
  section,
}: {
  role: Role;
  section: string;
}) {
  const user = await requireRole(role);
  if (!sections[role].includes(section)) notFound();
  if (!can(user, permissions[section])) return <NoPermission />;
  const content =
    section === "solicitudes" && role === "ADMIN" ? (
      <div className="space-y-6">
        <PageHeading
          title="Solicitudes de Recepción"
          subtitle="Revisa excepciones y devoluciones con los permisos de aprobación."
        />
        <Exceptions />
        <Returns />
      </div>
    ) : section === "socios" ? (
      <PeoplePage />
    ) : section === "crm" ? (
      <PeoplePage prospect />
    ) : section === "membresias" ? (
      role === "ADMIN" ? (
        <AdminMembershipsPage />
      ) : (
        <MembershipsPage />
      )
    ) : section === "clases" ? (
      <ClassesPage />
    ) : section === "catalogo" ? (
      role === "ADMIN" ? (
        <AdminProductsPage />
      ) : (
        <ProductsPage />
      )
    ) : section === "notificaciones" ? (
      <NotificationsPage />
    ) : section === "premios" ? (
      <RewardsPage />
    ) : (
      <>
        <PageHeading
          title={
            role === "ADMIN" ? "Planes del gimnasio" : "Planes para cada meta"
          }
          subtitle={
            role === "ADMIN"
              ? "Gestiona planes, publicación, precios vigentes y condiciones."
              : "Oferta vigente de tu gimnasio. Precios y condiciones del catálogo público."
          }
        />
        {role === "ADMIN" ? (
          <AdminPlans />
        ) : (
          <PlanCatalog organization={user.organizationPublicId} />
        )}
      </>
    );
  return <Suspense fallback={<Loading />}>{content}</Suspense>;
}
