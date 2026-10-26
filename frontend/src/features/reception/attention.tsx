"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui/states";
import { closure } from "@/lib/api/closure";
import { reception } from "@/lib/api/reception";
import { shortDate, timeOfDay } from "@/lib/utils";
import { useOperation, MemberLookup } from "./common";
import { OperationForm } from "./closure-common";
export function IncidentForm({
  memberId,
  onSuccess,
}: {
  memberId?: number;
  onSuccess?: () => void;
}) {
  const [member, setMember] = useState<{ id: number; name: string } | null>(
    null,
  );
  const [pick, setPick] = useState(false);
  const [lookupError, setLookupError] = useState<Error | null>(null);
  return (
    <div className="space-y-4">
      {!memberId && (
        <>
          <Button variant="secondary" onClick={() => setPick(!pick)}>
            {member ? member.name : "Vincular socio (opcional)"}
          </Button>
          {member && (
            <Button variant="ghost" onClick={() => setMember(null)}>
              Quitar vínculo
            </Button>
          )}
          {pick && (
            <MemberLookup
              label="Vincular"
              onSelect={async (m) => {
                try {
                  const d = await reception.member(m.publicId);
                  setMember({ id: d.memberId, name: m.fullName });
                  setPick(false);
                  setLookupError(null);
                } catch (e) {
                  setLookupError(e as Error);
                }
              }}
            />
          )}
        </>
      )}
      {lookupError && (
        <ErrorState error={lookupError} retry={() => setPick(true)} />
      )}
      <OperationForm
        key={memberId ?? member?.id ?? "none"}
        path="incidents"
        label="Registrar incidencia"
        onSuccess={onSuccess}
        fields={[
          {
            name: "category",
            label: "Categoría",
            type: "select",
            required: true,
            options: [
              ["ACCESS", "Acceso"],
              ["PAYMENT", "Pago"],
              ["MEMBERSHIP", "Membresía"],
              ["PRODUCT", "Producto"],
              ["CLASS", "Clase"],
              ["GENERAL", "Atención general"],
            ].map(([value, label]) => ({ value, label })),
          },
          {
            name: "priority",
            label: "Prioridad",
            type: "select",
            required: true,
            value: "NORMAL",
            options: [
              ["LOW", "Baja"],
              ["NORMAL", "Normal"],
              ["HIGH", "Alta"],
              ["URGENT", "Urgente"],
            ].map(([value, label]) => ({ value, label })),
          },
          { name: "subject", label: "Asunto", required: true, maxLength: 200 },
          {
            name: "description",
            label: "Descripción",
            type: "textarea",
            required: true,
            maxLength: 4000,
          },
        ]}
        body={(v, requestId) => ({
          requestId,
          memberId: memberId ?? member?.id ?? null,
          category: v.category,
          priority: v.priority,
          subject: v.subject,
          description: v.description,
        })}
      />
    </div>
  );
}
export function Incidents() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<number | null>(null);
  const q = useOperation(["incidents", page], (s) =>
    closure.incidents(page, s),
  );
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-lg font-semibold">Incidencias de atención</h2>
        <Button onClick={() => setOpen(true)}>Crear incidencia</Button>
      </div>
      <p className="mt-2 text-sm text-muted">
        Casos creados por ti, asignados a ti o en conversaciones de las que
        formas parte.
      </p>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <Empty title="Sin incidencias" />
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {q.data.items.map((t) => (
            <li className="space-y-2 py-4" key={t.supportTicketId}>
              <div className="flex flex-wrap justify-between gap-2">
                <strong className="break-words">{t.subject}</strong>
                <Badge status={t.status} />
              </div>
              <p className="text-sm text-muted">
                {t.memberName ?? "Atención general"} · {t.category} ·{" "}
                {t.priority}
              </p>
              {t.conversationId && (
                <Button
                  variant="secondary"
                  onClick={() => setConversation(t.conversationId)}
                >
                  Ver conversación
                </Button>
              )}
            </li>
          ))}
        </ul>
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
        open={open}
        onOpenChange={setOpen}
        title="Crear incidencia"
        description="Registra el contexto necesario para continuar la atención."
      >
        {open && <IncidentForm onSuccess={() => setOpen(false)} />}
      </Dialog>
      <Dialog
        open={!!conversation}
        onOpenChange={(v) => {
          if (!v) setConversation(null);
        }}
        title="Conversación de incidencia"
        description="Solo participantes autorizados pueden consultar y responder."
      >
        {conversation && <Conversation id={conversation} />}
      </Dialog>
    </section>
  );
}
export function Messages() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const q = useOperation(["conversations", page], (s) =>
    closure.conversations(page, s),
  );
  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">Mensajes internos</h2>
      <p className="mt-2 text-sm text-muted">
        Conversaciones en las que participas. Sin conexión a WhatsApp.
      </p>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <Empty title="No tienes conversaciones" />
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {q.data.items.map((c) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 py-4"
              key={c.conversationId}
            >
              <span className="break-words">
                {c.subject ?? "Conversación interna"}
              </span>
              <Button
                variant="secondary"
                onClick={() => setSelected(c.conversationId)}
              >
                Abrir conversación
              </Button>
            </li>
          ))}
        </ul>
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
        title="Mensajes"
        description="Respuestas visibles solo para los participantes."
      >
        {selected && <Conversation id={selected} />}
      </Dialog>
    </section>
  );
}
function Conversation({ id }: { id: number }) {
  const [page, setPage] = useState(1);
  const [sent, setSent] = useState(0);
  const q = useOperation(["messages", id, page], (s) =>
    closure.messages(id, page, s),
  );
  return (
    <div className="space-y-4">
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <Empty title="Sin mensajes" />
      ) : (
        <ul className="space-y-3">
          {q.data.items.map((m) => (
            <li className="rounded-xl bg-canvas p-4" key={m.messageId}>
              <p className="whitespace-pre-wrap break-words text-sm">
                {m.body}
              </p>
              <p className="mt-2 text-xs text-muted">
                {shortDate(m.sentAtUtc)} · {timeOfDay(m.sentAtUtc)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {q.data && (
        <Pagination
          page={page}
          total={q.data.total}
          totalPages={q.data.totalPages}
          onPage={setPage}
        />
      )}
      <OperationForm
        key={sent}
        path={`conversations/${id}/messages`}
        fields={[
          {
            name: "body",
            label: "Respuesta",
            type: "textarea",
            required: true,
            maxLength: 4000,
          },
        ]}
        body={(v, requestId) => ({ requestId, body: v.body })}
        label="Enviar respuesta"
        onSuccess={() => setSent((n) => n + 1)}
      />
    </div>
  );
}
