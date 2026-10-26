# GymFlow — Reception + POS Patch

Cierre: 2026-10-22. Alcance: Recepción y patch de integración autorizado, dentro de
`GymFlow_Final`. Admin se conserva aprobado. No se inició Entrenador ni Socio.
Monolito modular, SQL Server, multi-tenant e identidad visual conservados.

## Resultado

Recepción + POS están listos para **revisión comercial local** en los flujos
implementados. Los límites de API enumerados más abajo siguen explícitos;
no se declara finalizado todo el frontend ni una integración bancaria/fiscal.

| Validación | Resultado |
|---|---|
| Reception Patch | PASS |
| Member Context | PASS |
| Member Quick Actions | PASS |
| Payments | PASS |
| Partial Payments | PASS |
| Mixed Payments | PASS |
| Cash | PASS |
| Access History | PASS |
| Check-in | PASS |
| POS Transaction | PASS |
| Inventory Transaction | PASS |
| Idempotency | PASS |
| Concurrency | PASS |
| Rollback | PASS |
| Audit | PASS |
| Multi-tenant | PASS |
| Authorization | PASS |
| Backend Build | PASS |
| Backend Tests | PASS |
| Integrity Tests | PASS |
| Reception UI | PASS |
| Reception E2E | PASS |
| Frontend Build | PASS |
| Responsive 375/768/1440 | PASS |

Frontend lint y typecheck: PASS. Tests unitarios: 44/44 PASS.
Backend Release: **0 warnings / 0 errores**, 35/35 tests con SQL real y 0 omitidos.
Frontend production build: PASS. API `http://127.0.0.1:5080` conectada a
`GymFlowDb` en `.\SQLEXPRESS`, Windows Authentication.

## Pruebas y evidencia

**150 casos automatizados PASS** en la ejecución final: 35 backend + 44 unitarios
frontend + 59 E2E aislados + 9 E2E reales + 3 recorridos responsive.
Además: **54/54 comprobaciones HTTP reales** e IntegrityTests SQL PASS.
Un caso se omite intencionalmente: navegación exclusivamente móvil en el proyecto
desktop. No se cuentan como casos adicionales las repeticiones de diagnóstico.

- Backend: [build](../backend/artifacts/reception-build.log),
  [35 tests](../backend/artifacts/reception-tests.log),
  [IntegrityTests](../backend/artifacts/reception-integrity.log).
- HTTP: [54 comprobaciones](../backend/artifacts/reception-smoke.json).
- Frontend: [lint](../frontend/artifacts/reception-lint.log),
  [typecheck](../frontend/artifacts/reception-typecheck.log),
  [unitarios](../frontend/artifacts/reception-unit.log),
  [E2E aislados](../frontend/artifacts/reception-full-e2e.log),
  [9 E2E reales](../frontend/artifacts/reception-live.log),
  [build](../frontend/artifacts/reception-build.log),
  [responsive](../frontend/artifacts/reception-review.log),
  [aislamiento de secretos](../frontend/artifacts/reception-secrets.log).

La suite aislada contiene 20 casos de Recepción (10 recorridos por desktop/móvil):
búsqueda/ficha, ingreso manual y QR, bloqueo de ingreso, pago parcial y mixto,
caja física/cierre, POS Yape y efectivo+tarjeta, reserva, autorización,
empty/error/recovery, loading/403/paginación SQL, renovación y reenvío de POS
con respuesta incierta seguido de rechazo por stock insuficiente.

La suite real verifica login y refresh de cuatro roles, Admin sin regresiones y
un recorrido de Recepción sobre SQL: caja → check-in → renovación vinculada →
cobro parcial → cobro mixto → POS por Yape → movimientos → cierre conciliado.
Los tests de otros roles solo preservan la foundation existente; no son desarrollo
nuevo de esas experiencias.

`ReceptionIntegrationTests` añade nueve casos SQL: parcial/mixto, efectivo, Yape,
tarjeta, POS, acceso/excepción/QR, tenant, paginación y contacto/renovación.
`PosConcurrencyTests` añade un caso compuesto con conexiones SQL independientes:
última unidad concurrente, reenvío simultáneo, doble pago, sobrepago, cierre
simultáneo y rollback inducido después de escribir pago/caja. Se comprueban
órdenes, pagos, caja, movimientos de inventario y auditoría, no solo HTTP 200.

## Garantías del flujo financiero

Una transacción SQL única engloba orden, detalle, descuento de stock con movimiento,
pago/splits, caja de efectivo y auditoría. PaymentService participa en la
transacción del POS. No se confirma ninguna parte por separado.

Los bloqueos de aplicación se delimitan por organización, request, caja, deuda y
producto/sede; el stock se bloquea en orden estable y se actualiza con condición
`QuantityOnHand >= cantidad`. No se permite stock negativo.

RequestId se vincula a actor, tenant y hash del payload. Un reenvío idéntico devuelve
la misma operación; reutilizar la clave con otro contenido se rechaza. El frontend
conserva el intento mientras el resultado es incierto y reenvía el mismo payload.
No hay reintento automático de mutaciones financieras con una clave nueva.

**Una venta fallida no deja una orden, pago, movimiento de caja ni inventario
inconsistentes**: se verificó rollback total por error de pago, falta de stock en
un segundo artículo y fallo inducido después de pago/caja. El comprobante interno
solo se muestra después de confirmar la transacción.

Pago != Caja. Solo splits cuyo método tiene IsCash producen movimiento físico.
Yape/tarjeta se registran como medios declarados por el operador; no equivalen a
una confirmación de un proveedor externo. El POS exige pago completo, único o
mixto. Los pagos parciales corresponden a cuentas por cobrar de membresías.
No se añadió borrado financiero ni devolución implícita.

## Endpoints añadidos

Todos bajo `/api/v1`, autenticados y tenant-scoped. OpenAPI pasa de 42 a **54 operaciones**.

| Método y ruta | Permiso existente |
|---|---|
| GET reception/context | CASH.VIEW |
| GET cash-registers | CASH.VIEW |
| GET payment-methods | PAYMENTS.CREATE |
| GET receivables?memberId=… | PAYMENTS.VIEW |
| GET payments?memberId=… | PAYMENTS.VIEW |
| GET payments/{id} | PAYMENTS.VIEW |
| GET cash-shifts/me?status=OPEN | CASH.VIEW; solo operador actual |
| GET cash-shifts/{id}/movements | CASH.VIEW; solo operador actual |
| GET access/events | ACCESS.CHECKIN |
| POST access/check-in/qr | ACCESS.CHECKIN |
| PUT members/{id} | MEMBERS.UPDATE; rowversion |
| POST store/sales | STORE.SELL y PAYMENTS.CREATE |

## Contratos/operaciones modificados

- GET/POST members y GET members/{publicId}: MemberId real; ficha con rowversion.
- POST memberships: PreviousMembershipId existente y RequestId idempotente;
  contrato nuevo/deuda propia, precio e historial anteriores preservados.
- POST payments: RequestId/replay, saldo de orden, auditoría y transacción componible.
- POST cash-shifts/open y {id}/close: contexto y propiedad del operador verificadas;
  auditoría dentro de la misma transacción.
- POST access/check-in: evento y auditoría atómicos. Resolver QR o aprobar una
  excepción no produce asistencia; solo el ingreso real genera el evento permitido.
- GET products?branchId: sede validada dentro del tenant y stock cero si no hay saldo;
  sin sede el stock sigue desconocido, no se inventa.
- GET dashboard/summary: requiere también REPORTS.VIEW para proteger finanzas globales.
  Recepción usa resumen operativo propio, no ese endpoint global.

**No se añadieron permisos ni se ampliaron asignaciones del rol.** El límite se
verifica en backend además de UI/BFF. No se muestran usuarios/roles, configuración,
finanzas globales, progreso privado ni auditoría global en Recepción.

Lecturas AsNoTracking, DTOs mínimos, filtros/orden/paginación server-side y queries
agrupadas por operación. La lectura de productos para una venta se hace en bloque;
las escrituras por línea son parte de la transacción, no N+1 de consultas de pantalla.
Se reutilizan índices existentes de organización, caja, producto/sede y fechas.
No se añadieron índices sin una consulta que los justificara.

## UI, rutas y capturas

Ocho rutas: `/recepcion`, `/recepcion/socios`, `/recepcion/accesos`,
`/recepcion/pagos-caja`, `/recepcion/tienda`, `/recepcion/clases`,
`/recepcion/atencion`, `/recepcion/mi-turno`.

Ficha con check-in, cobro, renovación, reserva, deuda e historial; contacto editable
con concurrencia. Caja propia, pagos y tienda se conectan al cliente HTTP tipado
centralizado/TanStack Query. Formularios RHF/Zod. Sin estado financiero local simulado.

[Galería de 30 capturas finales](../frontend/artifacts/reception-review/index.html).
Las capturas usan **fixtures aislados ficticios**, no métricas ni personas reales;
la integración real se verifica por separado. No se capturan contraseñas reales.
Se revisaron ausencia de desbordamiento horizontal, diálogos desplazables, teclado,
estados, console/page errors y navegación en 375, 768 y 1440 px.

| Pantalla | 375 | 768 | 1440 |
|---|---|---|---|
| Inicio | [Ver](../frontend/artifacts/reception-review/375/inicio.png) | [Ver](../frontend/artifacts/reception-review/768/inicio.png) | [Ver](../frontend/artifacts/reception-review/1440/inicio.png) |
| Ficha de socio | [Ver](../frontend/artifacts/reception-review/375/ficha-socio.png) | [Ver](../frontend/artifacts/reception-review/768/ficha-socio.png) | [Ver](../frontend/artifacts/reception-review/1440/ficha-socio.png) |
| Accesos | [Ver](../frontend/artifacts/reception-review/375/accesos.png) | [Ver](../frontend/artifacts/reception-review/768/accesos.png) | [Ver](../frontend/artifacts/reception-review/1440/accesos.png) |
| Pagos y Caja | [Ver](../frontend/artifacts/reception-review/375/pagos-caja.png) | [Ver](../frontend/artifacts/reception-review/768/pagos-caja.png) | [Ver](../frontend/artifacts/reception-review/1440/pagos-caja.png) |
| Tienda/POS | [Ver](../frontend/artifacts/reception-review/375/tienda.png) | [Ver](../frontend/artifacts/reception-review/768/tienda.png) | [Ver](../frontend/artifacts/reception-review/1440/tienda.png) |
| Clases | [Ver](../frontend/artifacts/reception-review/375/clases.png) | [Ver](../frontend/artifacts/reception-review/768/clases.png) | [Ver](../frontend/artifacts/reception-review/1440/clases.png) |

## SQL, datos de prueba y secretos

**Cero tablas nuevas. Cero cambios de esquema, relaciones, seeds, índices o reglas
SQL existentes.** La comparación SHA256 contra el baseline conservado no detecta
cambios en ningún SQL anterior. Solo se añadió `database/tests/ReceptionApiFixtures.sql`,
un fixture opcional de datos del tenant ficticio canónico, ejecutado con UTF-8.
Crea producto interno, stock con movimiento de entrada, caja de práctica y sesión
de clase. No se eliminan datos ni se toca otra base. Los tests de concurrencia
conservan su historial en organizaciones inactivas de prueba.

El smoke y E2E reales dejan pagos/contratos/stock/recibos de demo con trazabilidad.
La preparación de fixtures permite repetir pruebas con un producto nuevo y tres
unidades ficticias; no restaura stock por UPDATE ni borra ventas anteriores.

No se crearon ni cambiaron cuentas autenticables E2E ni contraseñas: se reutilizan
las cuatro cuentas locales verificadas del patch anterior. Los tests SQL crean
actores técnicos deshabilitados/sin contraseña dentro de fixtures aislados.
`.env.local` no fue alterado; no hay repositorio Git inicializado y `.env*` está
ignorado. Guarda configuración, clave de sesión local y credenciales demo/E2E.
La verificación de secretos escanea código público/build/tests y no imprime valores.

## Errores corregidos

- La terminal resolvía un SDK global distinto del fijado: se usa el SDK local
  `.tools/dotnet/dotnet.exe`, sin cambiar global.json ni instalar otro SDK.
- Precisión de timestamps de pagos/replays alineada con datetime2(3).
- Validaciones de payload nulo, precisión financiera y estado/sede/stock del POS.
- Ordenamiento/bloqueos de concurrencia y transacción exterior compartida;
  lectura de caja propia abierta separada de historial paginado.
- Renovación vinculada al contrato anterior, sin añadir esquema ni sobrescribirlo.
- Lecturas financieras globales restringidas también en backend.
- Correos largos de la ficha móvil ocupan la fila completa.
- Fechas UTC sin sufijo de SQL normalizadas al consumir clases, CRM, notificaciones,
  reservas, accesos, caja y recibos, conservando offsets explícitos; regresión unitaria.
- Fixture SQL ejecutado como UTF-8, con reparación acotada de sus textos de prueba.
- Tests previos actualizados a la nueva landing de Recepción y allowlist autorizada;
  selectores distinguen alertas de UI del anunciador accesible de Next.js.

Warnings restantes: ninguno en Release/frontend lint/build. IntegrityTests muestra
el aviso informativo existente de SQL de eliminación de NULL por agregación y termina
PASS. No se desactivaron ANSI_WARNINGS ni restricciones para ocultarlo.

## Pendientes y límites

No hay bloqueo en los flujos centrales de Recepción/POS validados. Siguen fuera del
patch: devolución/anulación y promociones, POS a crédito, cancelación/asistencia de
clase, aprobación de excepciones, incidencias/mensajería, traspaso de turno y factura
fiscal/integración bancaria. La UI explica la indisponibilidad, sin datos productivos
inventados. [Detalle de gaps](../frontend/docs/RECEPTION_GAPS.md).

La demo SQL histórica requiere curaduría autorizada de algunos nombres numerados y
teléfonos repetidos antes de una presentación de su dataset completo. Las capturas
no encubren ese pendiente: se identifican como fixtures de presentación.

Estas pruebas locales no establecen capacidad de producción. El test de concurrencia
usa SQL real, no es una prueba de carga sostenida nueva. No se implementó RPA, IA,
Document AI, workers externos ni WhatsApp.

## Archivos modificados/añadidos

Comparación backend contra `frontend/artifacts/reception-backend-baseline.json`:
14 archivos C# existentes modificados y 7 C# añadidos (**21**), preservando el trabajo
recibido. Inventario exacto: [JSON](../backend/artifacts/reception-files.json).

Backend modificados:

- `backend/src/GymFlow.Api/Program.cs`
- `backend/src/GymFlow.Infrastructure/Services/AccessService.cs`
- `backend/src/GymFlow.Infrastructure/Services/CashService.cs`
- `backend/src/GymFlow.Infrastructure/Services/DependencyInjection.cs`
- `backend/src/GymFlow.Infrastructure/Services/MemberService.cs`
- `backend/src/GymFlow.Infrastructure/Services/MembershipService.cs`
- `backend/src/GymFlow.Infrastructure/Services/PaymentService.cs`
- `backend/src/GymFlow.Infrastructure/Services/ProductService.cs`
- `backend/src/GymFlow.Application/Contracts/MemberContracts.cs`
- `backend/src/GymFlow.Application/Contracts/MembershipContracts.cs`
- `backend/src/GymFlow.Application/Contracts/PaymentContracts.cs`
- `backend/src/GymFlow.Api/Endpoints/CashEndpoints.cs`
- `backend/src/GymFlow.Api/Endpoints/DashboardEndpoints.cs`
- `backend/src/GymFlow.Api/Endpoints/PaymentEndpoints.cs`

Backend/tests añadidos:

- `backend/src/GymFlow.Infrastructure/Services/PosService.cs`
- `backend/src/GymFlow.Infrastructure/Services/ReceptionAudit.cs`
- `backend/src/GymFlow.Infrastructure/Services/ReceptionService.cs`
- `backend/src/GymFlow.Application/Contracts/ReceptionContracts.cs`
- `backend/src/GymFlow.Api/Endpoints/ReceptionEndpoints.cs`
- `backend/tests/GymFlow.Tests/PosConcurrencyTests.cs`
- `backend/tests/GymFlow.Tests/ReceptionIntegrationTests.cs`

Scripts/SQL añadidos:

- `backend/scripts/reception_smoke.mjs`
- `backend/scripts/prepare_reception_fixture.mjs`
- `database/tests/ReceptionApiFixtures.sql` (solo datos opcionales)

Frontend añadido:

- `src/features/reception/common.tsx`, `cash.tsx`, `member-actions.tsx`, `members.tsx`, `pages.tsx`, `store.tsx`, `tender.tsx`.
- `src/lib/api/reception.ts`, `reception-contracts.ts`.
- `tests/fixtures/reception-api.mjs`.
- `tests/e2e/reception.spec.ts`, `tests/live/reception.spec.ts`, `tests/review/reception.spec.ts`, `tests/unit/reception-contracts.test.ts`.
- `scripts/create-reception-gallery.mjs`, `docs/RECEPTION_GAPS.md`.

Frontend existente modificado:

- `src/app/recepcion/page.tsx`, `src/app/recepcion/[section]/page.tsx`, `src/app/globals.css`.
- `src/components/workspace-shell.tsx`, `src/components/ui/badge.tsx`.
- `src/lib/api/contracts.ts`, `admin-contracts.ts`, `gymflow.ts`, `policy.ts`, `generated.ts`; `src/lib/utils.ts`.
- `tests/fixtures/api-server.mjs`, `admin-api.mjs`.
- `tests/e2e/foundation.spec.ts`, `admin-states.spec.ts`; `tests/unit/security.test.ts`, `admin-contracts.test.ts`.
- `docs/openapi.json`, `docs/API_INVENTORY.md`, `README.md`.

Documentación: este informe, `docs/VALIDATION_STATUS.md` y `backend/API_SURFACE.md`.
Logs y capturas permanecen bajo artifacts ignorado. Sin cambios de dependencias,
package manager, lockfile ni identidad visual. No se inicializó/publicó Git.

## Comandos reproducibles

Desde `GymFlow_Final/backend` (PowerShell):

```powershell
$env:GYMFLOW_TEST_CONNECTION='Server=.\SQLEXPRESS;Database=GymFlowDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;'
.\.tools\dotnet\dotnet.exe build -c Release
.\.tools\dotnet\dotnet.exe test -c Release
sqlcmd -S '.\SQLEXPRESS' -E -C -b -i ../database/tests/IntegrityTests.sql
# API local: scripts/Start-Local.ps1, sin ResetDemoPasswords.
# Solo datos ficticios de GymFlowDb; conserva todo el historial:
node scripts/prepare_reception_fixture.mjs
node scripts/reception_smoke.mjs
```

Desde `GymFlow_Final/frontend`, con dependencias pnpm ya instaladas:

```powershell
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node node_modules/next/dist/bin/next build
$env:PLAYWRIGHT_BROWSERS_PATH="$PWD\.tools\browsers"
Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue
node node_modules/@playwright/test/cli.js test
node node_modules/@playwright/test/cli.js test -c playwright.live.config.ts
node node_modules/@playwright/test/cli.js test -c playwright.review.config.ts reception.spec.ts
node scripts/create-reception-gallery.mjs
node scripts/verify-local-secrets.mjs
```

Se invocan los binarios del proyecto porque pnpm no está en PATH global; el proyecto
mantiene pnpm y su lockfile. No ejecutar suites aislada/review simultáneamente:
comparten 5099/3100. La suite real usa 3001 y API 5080. Preparar el fixture antes de
repetir ventas: el stock se consume realmente. Las cuentas permanecen intactas.

**Recomendación:** presentar Recepción + POS para revisión comercial de los flujos
centrales, con los gaps informados. Esta fase se detiene aquí; no iniciar Entrenador.
