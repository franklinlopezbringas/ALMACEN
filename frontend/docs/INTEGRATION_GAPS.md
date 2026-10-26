# Integración Admin: estado vigente del patch

Actualizado: 2026-10-21. El [informe del Integration Patch](../../docs/INTEGRATION_PATCH_REPORT.md)
reemplaza el estado previo que se conserva más abajo como registro histórico.

| Gap autorizado | Estado actual |
|---|---|
| Login real de cuatro roles | Cerrado: cuentas ficticias adicionales, claves solo en `.env.local`; login y refresh reales verificados. Cuentas y hashes originales conservados. |
| Consulta general de membresías | Cerrado: GET paginado con búsqueda, estados, rango de vencimiento, MemberId y PlanId. |
| CRM: plan de interés y último contacto | Cerrado: plan y fecha máxima del historial, con primer contacto como fallback; paginación SQL. |
| Clases: coach y participantes | Cerrado: coach y cupos disponibles; consulta paginada de participantes restringida al personal autorizado. |
| Productos y sedes | Cerrado: catálogo administrativo, sedes, precio, stock mínimo, estado, alta/edición con rowversion. El formulario no cambia existencias. |
| Planes administrativos y PlanVersionId | Cerrado: consulta, alta, datos comerciales/estado y publicación de versiones. Contratos y beneficios históricos conservados. |

## Gaps fuera del alcance del patch

- El listado general de socios todavía no expone MemberId numérico; la consulta
  nueva de membresías sí devuelve identificadores de sus contratos y socios.
- Caja/cobros requieren consultas operativas y catálogos adicionales para una UI completa.
- CRM no añade edición de seguimientos, catálogo de orígenes ni próxima acción estructurada.
- Agenda no añade CRUD/cancelación de sesiones, asistencia o gestión de reservas propias.
- Inventario mantiene ledger y saldo conciliable; este patch incorpora metadatos
  del producto y consulta, no endpoints de movimientos, compras o transferencias.
- Planes no añaden editor de beneficios ni programación de versiones futuras;
  los beneficios existentes se copian al publicar y el historial se conserva.
- Auth conserva logout local; siguen pendientes revocación global y recuperación de contraseña.
- Persisten los límites v1 de rutinas completas, ejecución de workers/jobs,
  identificador de canje, series históricas y métricas multimoneda.
- Parte de las respuestas históricas `IResult` aún tiene documentación incompleta
  en OpenAPI. La referencia actual registra 42 operaciones.

Las cuentas `admin.e2e@example.test`, `reception.e2e@example.test`,
`trainer.e2e@example.test` y `member.e2e@example.test` son exclusivamente ficticias
y locales. Se aprovisionan con `backend/scripts/provision_demo_e2e.py` y
`database/demo/E2EAccounts.sql`, sin resetear usuarios existentes.
Las variables `GYMFLOW_E2E_{ADMIN,RECEPTION,TRAINER,MEMBER}_{EMAIL,PASSWORD}`
se guardan en `.env.local` ignorado. Ese archivo también contiene configuración
local y una clave local de sesión del adaptador Next; no credenciales productivas.

## Registro histórico anterior al patch (no es el estado actual)

La [segunda pasada del Administrador](ADMIN_COMMERCIAL_PASS_2.md) detalla la
verificación actual de documentos, estados CRM, ventanas de vencimiento,
stock por sede y límites de gestión de planes/clases. No se modificó backend.

No se modificaron DB ni backend. Estos gaps se explicaron durante la fase 0;
su resolución se propondrá antes de ampliar el backend. El inventario registra
32 operaciones, incluida salud. La UI solo presenta acciones respaldadas por API.

| Prioridad | Gap comprobado | Consecuencia / decisión actual |
|---|---|---|
| Alta | Las credenciales de la validación anterior se generaban con `secrets.token_urlsafe` y se pasaban por entorno. No se guardaban en los artefactos. No hay variables vigentes ni credenciales reutilizables verificables en README, informe, brief, seeds/demo o tests. | Login real pendiente. No se inventó una cuenta demo ni se cambiaron usuarios/passwords. E2E usa un doble de API aislado, claramente separado de la aplicación real. |
| Alta | Listado/detalle/alta de socios exponen PublicId, pero membresía, pago, acceso y reserva por terceros requieren MemberId numérico. | Los formularios de esas operaciones no pueden resolverse con el catálogo actual de socios sin un contrato adicional. |
| Alta | Catálogo público de planes devuelve PublicId, pero crear membresía requiere PlanVersionId. No hay catálogo administrativo de versiones. | Planes se consultan; no se simula alta/edición/venta de membresía. |
| Alta | No existen endpoints de sedes, empleados, cajas, medios de pago o cuentas por cobrar; tampoco consulta del turno abierto o historial de pagos. | Cobros/caja requieren estos catálogos y consultas antes de ofrecer una operación completa. No se introducen IDs internos manuales en una demo comercial. |
| Media | No hay logout/revocación de refresh, recuperación de password, selección pública de organizaciones o endpoint `/me`. | Logout local; recuperación mediante administración; gimnasio preconfigurado por entorno; perfil derivado del JWT emitido por la API. |
| Media | OpenAPI no especifica varios cuerpos devueltos como `IResult`, incluidos AuthResponse y MemberDetail. | Tipos complementarios y validación Zod verificados contra los records C#; proponer documentación tipada en backend como mejora futura. |
| Media | Catálogo de premios devuelve PublicId, pero canje requiere RewardId numérico. | Socio ve puntos y recompensas; canje se deriva a recepción. |
| Media | Clases permite reserva propia, pero no consulta de mis reservas, cancelación o administración de agenda. | Consulta y solicitud de reserva; confirmación describe posible espera. Sin botones de cancelación/edición inexistentes. |
| Media | No hay series históricas de métricas. Saldo agregado del dashboard no incluye CurrencyCode. | No se inventan tendencias. La demo documenta PEN (configuración validada); si se admiten organizaciones multimoneda se requiere un resumen por moneda. |
| Media | Productos solo catálogo/stock; rutinas completas no tienen API; jobs solo enqueue/estado, sin listado ni worker. | Se conservan los límites v1 aprobados. No se simulan inventario operativo, ejecución de jobs o CRUD de rutinas. |
| Baja | El rate limit de login se basa en IP; el backend verá la IP de Next.js cuando actúe como adaptador. | Suficiente para demo local; antes de despliegue revisar forwarded headers confiables/proxies permitidos en backend. No falsificar X-Forwarded-For desde el frontend. |

## Credenciales locales

Se revisaron `README.md`, `CODEX_EXECUTION.md`,
`docs/CODEX_VALIDATION_REPORT.md`, `database/demo/`, `database/seeds/`,
`backend/tests/`, `backend/scripts/`, archivos `.env*` y nombres de variables
GYMFLOW de la sesión. Los hashes existentes no permiten recuperar una contraseña.
No se hicieron intentos de adivinarla ni cambios de cuentas.

Cuando se disponga de credenciales verificables, configurarlas únicamente en
`frontend/.env.local` (ignorado): `GYMFLOW_E2E_EMAIL`, `GYMFLOW_E2E_PASSWORD` o
`GYMFLOW_E2E_ADMIN_EMAIL`, `GYMFLOW_E2E_ADMIN_PASSWORD` y equivalentes RECEPTION,
TRAINER, MEMBER. No imprimirlas en logs, componentes, screenshots o informes.
