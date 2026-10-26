"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  DoorOpen,
  Wallet,
  Ticket,
  CalendarDays,
  ListChecks,
  History,
  Pencil,
} from "lucide-react";
import { useSession } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, Loading, Pagination } from "@/components/ui/states";
import { gymflow } from "@/lib/api/gymflow";
import { reception } from "@/lib/api/reception";
import { can } from "@/lib/auth/permissions";
import { money, shortDate } from "@/lib/utils";
import { PersonFormDialog } from "@/features/people/person-form";
import {
  ReceptionHeading,
  MemberLookup,
  useOperation,
  todayLima,
} from "./common";
import {
  CheckIn,
  QrCheckIn,
  Debts,
  MemberPayments,
  AccessHistory,
  ReserveClass,
  RenewMembership,
} from "./member-actions";
import { IncidentForm } from "./attention";
import { Exceptions } from "./exceptions";
export type MemberAction =
  | "ficha"
  | "checkin"
  | "cobrar"
  | "renovar"
  | "reservar"
  | "deuda"
  | "historial"
  | "editar"
  | "incidencia";

export function ReceptionMembers({
  paymentMode = false,
  accessMode = false,
}: {
  paymentMode?: boolean;
  accessMode?: boolean;
}) {
  const user = useSession();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(params.get("ficha"));
  const [create, setCreate] = useState(params.get("nuevo") === "1");
  return (
    <div className="space-y-6">
      {accessMode && <Exceptions />}
      {!paymentMode && (
        <ReceptionHeading
          title={accessMode ? "Accesos" : "Socios"}
          description={
            accessMode
              ? "Busca al socio y registra su ingreso. Revisa el resultado antes de dejarlo pasar."
              : "Busca, abre la ficha y resuelve la atención desde un solo lugar."
          }
        >
          {!accessMode && can(user, "MEMBERS.CREATE") && (
            <Button onClick={() => setCreate(true)}>
              <Plus />
              Registrar socio
            </Button>
          )}
        </ReceptionHeading>
      )}
      {paymentMode && (
        <div>
          <h2 className="text-xl font-semibold">Cobrar a un socio</h2>
          <p className="mt-1 text-sm text-muted">
            Busca al socio para consultar su deuda y registrar el pago.
          </p>
        </div>
      )}
      <MemberLookup
        onSelect={(m) => setSelected(m.publicId)}
        label={
          accessMode
            ? "Registrar ingreso"
            : paymentMode
              ? "Ver deuda y cobrar"
              : "Abrir ficha"
        }
      />
      <MemberDialog
        id={selected}
        onClose={() => setSelected(null)}
        initialAction={accessMode ? "checkin" : paymentMode ? "deuda" : "ficha"}
      />
      {can(user, "MEMBERS.CREATE") && (
        <PersonFormDialog open={create} onClose={() => setCreate(false)} />
      )}
      {accessMode && (
        <>
          <QrCheckIn />
          <AccessHistory />
        </>
      )}
    </div>
  );
}
export function MemberDialog({
  id,
  onClose,
  initialAction = "ficha",
  sessionId,
}: {
  id: string | null;
  onClose: () => void;
  initialAction?: MemberAction;
  sessionId?: number;
}) {
  return (
    <Dialog
      open={!!id}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Atención al socio"
      description="Datos, membresías y acciones de recepción."
    >
      {id && (
        <MemberWorkspace
          key={id}
          id={id}
          initialAction={initialAction}
          sessionId={sessionId}
        />
      )}
    </Dialog>
  );
}
function MemberWorkspace({
  id,
  initialAction,
  sessionId,
}: {
  id: string;
  initialAction: MemberAction;
  sessionId?: number;
}) {
  const user = useSession();
  const [action, setAction] = useState<MemberAction>(initialAction);
  const [page, setPage] = useState(1);
  const detail = useOperation(["member", id], (s) => reception.member(id, s));
  const memberships = useOperation(
    ["memberships", detail.data?.memberId, page],
    (s) => gymflow.memberships({ memberId: detail.data!.memberId, page }, s),
    !!detail.data && can(user, "MEMBERSHIPS.VIEW") && can(user, "MEMBERS.VIEW"),
  );
  const latest = useOperation(
    ["latest-membership", detail.data?.memberId],
    async (s) => {
      const first = await gymflow.memberships(
        { memberId: detail.data!.memberId, pageSize: 1, page: 1 },
        s,
      );
      const last =
        first.totalPages > 1
          ? await gymflow.memberships(
              {
                memberId: detail.data!.memberId,
                pageSize: 1,
                page: first.totalPages,
              },
              s,
            )
          : first;
      return last.items[0] ?? null;
    },
    !!detail.data && action === "renovar" && can(user, "MEMBERSHIPS.MANAGE"),
  );
  if (detail.isPending) return <Loading />;
  if (detail.error)
    return <ErrorState error={detail.error} retry={() => detail.refetch()} />;
  const m = detail.data;
  const previous = latest.data;
  const next =
    previous && previous.endDate >= todayLima()
      ? new Date(new Date(previous.endDate + "T12:00:00Z").getTime() + 86400000)
          .toISOString()
          .slice(0, 10)
      : todayLima();
  const actions = [
    ["checkin", "Check-in", DoorOpen, "ACCESS.CHECKIN"],
    ["cobrar", "Cobrar", Wallet, "PAYMENTS.CREATE"],
    ["renovar", "Renovar", Ticket, "MEMBERSHIPS.MANAGE"],
    ["reservar", "Reservar clase", CalendarDays, "CLASSES.RESERVE_FOR_OTHERS"],
    ["deuda", "Ver deuda", ListChecks, "PAYMENTS.VIEW"],
    ["historial", "Historial", History, "PAYMENTS.VIEW"],
    ["incidencia", "Crear incidencia", ListChecks, "MESSAGES.USE"],
  ] as const;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">
          {m.firstName} {m.lastName}
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-muted">{m.memberCode}</span>
          <Badge status={m.status} />
        </div>
      </div>
      {action === "ficha" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {actions
              .filter(([, , , permission]) => can(user, permission))
              .map(([key, label, Icon]) => (
                <Button
                  key={key}
                  variant="secondary"
                  size="sm"
                  className="justify-start"
                  onClick={() => setAction(key)}
                >
                  <Icon />
                  {label}
                </Button>
              ))}
          </div>
          <dl className="grid grid-cols-2 gap-4 border-y border-line py-4 text-sm">
            {[
              ["Teléfono", m.phone],
              ["Documento", m.documentNumber],
              ["Correo", m.email],
            ].map(([label, value]) => (
              <div
                key={label}
                className={label === "Correo" ? "col-span-2" : "min-w-0"}
              >
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 break-words">{value ?? "Sin registrar"}</dd>
              </div>
            ))}
          </dl>
          {can(user, "MEMBERS.UPDATE") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAction("editar")}
            >
              <Pencil />
              Actualizar contacto
            </Button>
          )}
          <h3 className="font-semibold">Membresías</h3>
          {memberships.isPending ? (
            <Loading />
          ) : memberships.error ? (
            <ErrorState
              error={memberships.error}
              retry={() => memberships.refetch()}
            />
          ) : memberships.data?.items.length ? (
            <>
              <ul className="space-y-3">
                {memberships.data.items.map((ms) => (
                  <li className="rounded-xl bg-canvas p-4" key={ms.publicId}>
                    <div className="flex justify-between gap-3">
                      <span className="text-sm font-semibold">
                        {ms.planName}
                      </span>
                      <Badge status={ms.status} />
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {shortDate(ms.startDate)} – {shortDate(ms.endDate)} ·{" "}
                      {money(ms.contractedPrice, ms.currencyCode)}
                    </p>
                  </li>
                ))}
              </ul>
              <Pagination
                page={page}
                totalPages={memberships.data.totalPages}
                total={memberships.data.total}
                onPage={setPage}
              />
            </>
          ) : (
            <p className="text-sm text-muted">
              No tiene contratos de membresía registrados.
            </p>
          )}
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={() => setAction("ficha")}>
            ← Volver a ficha
          </Button>
          {action === "incidencia" && can(user, "MESSAGES.USE") && (
            <IncidentForm memberId={m.memberId} />
          )}
          {action === "checkin" && can(user, "ACCESS.CHECKIN") && (
            <CheckIn memberId={m.memberId} />
          )}
          {(action === "deuda" || action === "cobrar") &&
            can(user, "PAYMENTS.VIEW") && (
              <Debts memberId={m.memberId} homeBranchId={m.homeBranchId} />
            )}
          {action === "reservar" && can(user, "CLASSES.RESERVE_FOR_OTHERS") && (
            <ReserveClass memberId={m.memberId} initialSession={sessionId} />
          )}
          {action === "historial" && (
            <>
              <MemberPayments memberId={m.memberId} />
              {can(user, "ACCESS.CHECKIN") && (
                <AccessHistory memberId={m.memberId} />
              )}
            </>
          )}
          {action === "renovar" &&
            can(user, "MEMBERSHIPS.MANAGE") &&
            (latest.isPending ? (
              <Loading />
            ) : latest.error ? (
              <ErrorState error={latest.error} retry={() => latest.refetch()} />
            ) : (
              <RenewMembership
                memberId={m.memberId}
                previousId={previous?.membershipId ?? null}
                homeBranchId={m.homeBranchId}
                suggestedDate={next}
              />
            ))}
          {action === "editar" && can(user, "MEMBERS.UPDATE") && (
            <EditContact member={m} onDone={() => setAction("ficha")} />
          )}
        </>
      )}
    </div>
  );
}
const contactSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(150),
  phone: z.string().trim().max(30),
  email: z.union([z.email(), z.literal("")]),
});
function EditContact({
  member,
  onDone,
}: {
  member: Awaited<ReturnType<typeof reception.member>>;
  onDone: () => void;
}) {
  const user = useSession();
  const cache = useQueryClient();
  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone ?? "",
      email: member.email ?? "",
    },
  });
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof contactSchema>) =>
      reception.updateMember(member.publicId, {
        ...data,
        phone: data.phone || null,
        email: data.email || null,
        rowVersion: member.rowVersion,
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: [user.organizationPublicId] });
      onDone();
    },
  });
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
    >
      <h3 className="font-semibold">Actualizar contacto</h3>
      {(
        [
          ["firstName", "Nombres"],
          ["lastName", "Apellidos"],
          ["phone", "Teléfono"],
          ["email", "Correo electrónico"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="label">
          {label}
          <input
            className="field mt-1"
            {...form.register(key)}
            disabled={mutation.isPending}
          />
          {form.formState.errors[key] && (
            <span className="mt-1 block text-xs text-rose-700">
              Revisa este campo.
            </span>
          )}
        </label>
      ))}
      {mutation.error && (
        <p role="alert" className="text-sm text-rose-700">
          {mutation.error.message} Vuelve a abrir la ficha si fue modificada por
          otra persona.
        </p>
      )}
      <Button disabled={mutation.isPending} type="submit">
        {mutation.isPending ? "Guardando…" : "Guardar contacto"}
      </Button>
    </form>
  );
}
