# Cierre de gaps de Recepción: revisión y decisión pendiente

> Registro histórico, sustituido el 2026-10-25 por el [informe de cierre](RECEPTION_CLOSURE_REPORT.md). El usuario autorizó posteriormente ShiftHandoffs, SupportTickets.MemberId, las referencias financieras y las reglas de clases. El texto siguiente conserva la propuesta original; no representa el estado actual implementado.

2026-10-22. Estado: propuesta, **no implementada**.
Se conserva íntegro el patch de Recepción + POS aprobado.

## Motivo de la pausa

El usuario indicó: «Si el esquema actual no puede soportarlo sin una nueva entidad,
detente y explícame por qué; alternativas; qué tabla mínima recomiendas; antes de
cambiar SQL».

Se contrastaron los scripts canónicos, los servicios/contratos y los metadatos de
`GymFlowDb` mediante consultas de solo lectura a `.\SQLEXPRESS`.
Existe `finance.CashShifts`; no existe una entidad de turno operativo/traspaso.
Sus notas y estados OPEN/CLOSED/REVIEW_REQUIRED pertenecen al ciclo de caja.
No permite guardar entrega, destinatario y recepción independientes del cierre,
ni representar una entrega de turno de alguien que no abrió caja.

No se modificaron SQL, datos, backend ni frontend en esta revisión. El único archivo
añadido es este documento. No se ejecutó de nuevo la suite de validación porque no
se implementó el cierre de gaps; los PASS del informe anterior siguen siendo
evidencia del alcance anterior, no de estas funciones nuevas.

## Alternativas de traspaso

| Alternativa | Evaluación |
|---|---|
| Notas en CashShifts | No recomendada: acopla dos ciclos que el usuario exige separar; requiere caja y no tiene destinatario/acuse propios. |
| Mensaje INTERNAL o SupportTicket | Puede servir como nota informal, pero no representa un traspaso estructurado con receptor, estado propio y aceptación. Codificar ese ciclo en texto/JSON sería introducir otro modelo implícito. |
| Nueva tabla core.ShiftHandovers | Recomendada: una sola entidad operativa independiente de caja, con integridad multi-tenant y control de concurrencia. |

## Propuesta mínima para aprobar: core.ShiftHandovers

No añade una aplicación, servicio externo, módulo de RR. HH. ni una tabla de tareas.
Representa la entrega de una jornada operativa; no pretende implementar un calendario
de turnos ni fichaje laboral.

| Campo | Tipo propuesto / finalidad |
|---|---|
| ShiftHandoverId | bigint identity, PK |
| OrganizationId | bigint, obligatorio |
| PublicId | uniqueidentifier, identificador público y clave del intento idempotente |
| BranchId | bigint, sede del traspaso |
| SenderUserOrganizationId | bigint, usuario de la organización que entrega |
| SenderEmployeeId | bigint, empleado que entrega |
| RecipientUserOrganizationId | bigint nullable, destinatario cuando se conoce |
| RecipientEmployeeId | bigint nullable, empleado receptor |
| DeliveredAtUtc | datetime2(3), generado por servidor |
| AcknowledgedAtUtc | datetime2(3) nullable, recepción confirmada |
| Notes | nvarchar(2000), notas de entrega |
| PendingNotes | nvarchar(4000), pendientes como texto; no un gestor de tareas |
| Status | varchar(20): SENT / ACKNOWLEDGED, propuesta a aprobar |
| RowVersion | rowversion |

FK compuestas por OrganizationId hacia Branches, Employees y UserOrganizations;
las tres entidades ya exponen claves únicas compuestas aptas. Validar además en el
servicio que empleado y usuario corresponden a la misma persona activa del tenant.
Unique de PublicId, CHECK de coherencia de receptor/fecha/estado e índices de
bandeja por organización, receptor, estado y fecha. No FK obligatoria a CashShifts.

Entrega inmutable; una aceptación registra al receptor, requiere ser el destinatario
o, si estaba sin asignar, un recepcionista autorizado de la organización. Dos
aceptaciones concurrentes no pueden tomar el mismo traspaso. Reenvío idéntico devuelve
la misma entrega; otro payload con igual PublicId se rechaza. Auditoría en la misma
transacción. Sin movimientos financieros ni inventario.

Contratos propuestos, no añadidos aún:

- GET /api/v1/shift-handovers: enviados/recibidos relevantes y paginados.
- POST /api/v1/shift-handovers: entrega con notas, pendientes y receptor opcional.
- POST /api/v1/shift-handovers/{id}/acknowledge: recepción con rowversion.

Permisos específicos propuestos: SHIFT_HANDOFF.VIEW, SHIFT_HANDOFF.CREATE y
SHIFT_HANDOFF.ACKNOWLEDGE, para ADMIN/RECEPTION; no conceder gestión financiera ni
administración de usuarios. El estado de caja no determina ni altera estos permisos.

Si se autoriza, el cambio deberá quedar en el script canónico y en un patch aditivo
para GymFlowDb, con tests de instalación/integridad. No recrear ni borrar la base.

## Contraste de los otros gaps

| Gap | Soporte encontrado / límites comprobados |
|---|---|
| Devolución total/parcial | ProductReturns admite Quantity y referencia a Order/OrderItem/Product; Refunds conserva pago, importe, solicitante, aprobador y estados. InventoryMovements admite RETURN_IN; CashMovements admite REFUND y RefundId. No exige una tabla de devolución nueva. |
| Trazabilidad de reembolso | No hay enlace directo ProductReturn–Refund ni detalle del método de desembolso en Refunds. Antes de implementar debe decidirse cómo persistir esa relación y distribución; no inferir efectivo de una venta mixta ni usar Reason como almacenamiento oculto. |
| Cancelación/asistencia | ClassReservations ya admite CANCELLED, ATTENDED, NO_SHOW, CancelledAtUtc y AttendedAtUtc; lista de espera tiene posición. No necesita una tabla nueva. |
| Promoción de espera | El servicio actual asigna posiciones, pero no implementa cancelación/promoción. No se encontró una regla documentada de promoción automática, plazo de cancelación o momento para no-show. Las reglas de negocio ausentes requieren confirmación, no deducción de los nombres de estados. |
| Excepciones | AccessExceptions ya tiene motivo, solicitante, revisor, vigencia y estados. EXCEPTION_REQUEST pertenece a RECEPTION; EXCEPTION_APPROVE no. Puede ampliarse sin tabla nueva y sin crear asistencia al aprobar. |
| Incidencias | SupportTickets tiene Category, Priority, Status, Subject, autor/asignado y ConversationId. La descripción puede ser el primer Messages.Body de su conversación. No tiene MemberId: relacionar cualquier socio, incluso sin usuario, necesita una relación explícita nullable; no basta ConversationParticipants.UserId. |
| Mensajería | Conversations, ConversationParticipants y Messages existen; MESSAGES.USE ya pertenece a RECEPTION. Los endpoints actuales solo cubren notificaciones propias/lectura. Nuevos contratos internos pueden respetar pertenencia activa a la conversación y tenant; sin WhatsApp ni IA. |

## Reglas de negocio que no deben inventarse

1. Reembolso mixto/parcial: proponer devolución por los medios originales, con importes
   explícitos por medio y límite acumulado por split; efectivo solo si hay desembolso
   efectivo. Requiere confirmar esta política frente a devolución proporcional o
   elección libre del medio. REFUNDS.APPROVE queda restringido al autorizado;
   Recepción no obtiene autoaprobación por poder vender.
2. Clases: propuesta a confirmar — cancelación antes del inicio, promoción FIFO por
   WaitlistPosition del siguiente socio elegible antes del inicio, asistencia desde
   el inicio y no-show al finalizar la sesión. El código actual no define estas
   transiciones ni sus ventanas; no se presentan como reglas ya aprobadas.

## Validación que seguirá tras la decisión

Devolución total/parcial y efectivo/no efectivo, recuperación de stock, reenvíos y
concurrencia; cancelación/cupo/espera/asistencia/no-show; solicitud/aprobación de
excepción sin asistencia implícita; incidencia vinculada a socio; conversación
autorizada; entrega/acuse independientes de caja; auditoría y aislamiento tenant.
Después: IntegrityTests, Release build/tests, HTTP smoke, frontend lint/typecheck/
unit/E2E/build y responsive. No declarar Recepción v1 cerrada antes de esos resultados.

La pausa responde a la instrucción expresa del usuario sobre una entidad nueva,
no a una restricción de herramientas ni a un rechazo de aprobación automática.
