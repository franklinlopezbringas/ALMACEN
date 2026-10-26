import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Loading, NoPermission } from "@/components/ui/states";
import { ReceptionMembers } from "@/features/reception/members";
import {
  ReceptionPayments,
  ReceptionShift,
  ReceptionClasses,
  ReceptionAttention,
} from "@/features/reception/pages";
import { ReceptionStore } from "@/features/reception/store";
const permissions: Record<string, string | undefined> = {
  socios: "MEMBERS.VIEW",
  accesos: "ACCESS.CHECKIN",
  "pagos-caja": "PAYMENTS.VIEW",
  tienda: "STORE.VIEW",
  clases: "CLASSES.VIEW",
  atencion: undefined,
  "mi-turno": "CASH.VIEW",
};
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const user = await requireRole("RECEPTION");
  const { section } = await params;
  const legacy: Record<string, string> = {
    crm: "atencion",
    notificaciones: "atencion?tab=avisos",
    catalogo: "tienda",
    membresias: "socios",
    planes: "socios",
  };
  if (legacy[section]) redirect("/recepcion/" + legacy[section]);
  if (!(section in permissions)) notFound();
  if (!can(user, permissions[section])) return <NoPermission />;
  return (
    <Suspense fallback={<Loading />}>
      {section === "socios" ? (
        <ReceptionMembers />
      ) : section === "accesos" ? (
        <ReceptionMembers accessMode />
      ) : section === "pagos-caja" ? (
        <ReceptionPayments />
      ) : section === "tienda" ? (
        <ReceptionStore />
      ) : section === "clases" ? (
        <ReceptionClasses />
      ) : section === "atencion" ? (
        <ReceptionAttention />
      ) : (
        <ReceptionShift />
      )}
    </Suspense>
  );
}
