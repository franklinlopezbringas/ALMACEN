# Administrador · segunda pasada funcional/comercial

> Registro histórico de la segunda pasada visual. El estado vigente al 2026-10-21
> está en el [informe del Integration Patch](../../docs/INTEGRATION_PATCH_REPORT.md):
> autenticación real de cuatro roles y contratos de membresías, CRM, clases,
> inventario y planes verificados. Las limitaciones y resultados siguientes
> describen el estado anterior al patch, no su cierre actual.

2026-10-20. Identidad visual aprobada conservada: colores, Manrope, estructura,
cards, modal, navegación y una única aplicación Next.js. No se añadieron paquetes
ni se cambiaron arquitectura o reglas de negocio. No se inició desarrollo nuevo
de Recepción, Entrenador o Socio; se ejecutaron sus regresiones de acceso existentes.

## Resultado y evidencia

| Validación | Resultado |
|---|---|
| Lint | PASS, 0 warnings |
| Typecheck strict | PASS |
| Tests unitarios/componentes | 33 PASS |
| E2E desktop/móvil | 37 PASS, 1 omitido (menú móvil en desktop) |
| Responsive / consola | 3 PASS, a 375, 768 y 1440 px |
| Production build | PASS |
| API real: salud, catálogo, ruta protegida anónima | 3 PASS |
| Login real por rol | 4 pendientes: sin credenciales verificables |

**76 pruebas correctas, 0 fallidas, 5 omitidas de 81 casos**, sin sumar repeticiones.
Los escenarios E2E de escritura usan exclusivamente el servidor ficticio aislado.
No se presenta su resultado como validación de escrituras autenticadas en .NET.

[Galería final: 33 screenshots](../artifacts/review/index.html) ·
[Índice por pantalla y ancho](SCREENSHOTS.md).
Los screenshots son del build de producción con **datos ficticios E2E**, no
clientes reales ni datos extraídos de GymFlowDb.

Logs: `artifacts/admin-pass2-{lint,typecheck,tests,build,e2e,review,live}.log`.
La referencia OpenAPI real volvió a descargarse en
`artifacts/admin-pass2-openapi.json`, sin modificar el contrato oficial.

## Cambios por pantalla

| Pantalla | Resultado implementado |
|---|---|
| Dashboard | “Accesos de hoy”, hero más compacto, texto operativo. Los tres bloques promocionales se reemplazan por alertas de vencimientos, saldo agregado, alta ocupación y prospectos nuevos cuando hay datos. |
| Socios desktop | Tabla, búsqueda, paginación, ficha, estado y vencimiento de membresía cuando se exponen. El nombre del plan no se inventa. |
| Socios móvil/tablet | Filas enriquecidas a 375 px y cards en dos columnas a 768 px; nombre, código, teléfono, estado, membresía, vencimiento y acceso a ficha. Sin tabla ni scroll horizontal. |
| Registro | Tipo y número de documento opcionales, enviados a `CreateMemberRequest`; límites 20/40 de las columnas reales. Se conserva que registrar no activa membresía ni genera cobro. |
| CRM | Prospecto, contacto, origen, estado, próximo seguimiento en hora de Lima, búsqueda, filtro de estado, alta y conversión. Empty state aprobado conservado. |
| Membresías | Encabezado “Membresías”; vista disponible “Por vencer” con filtros reales 7/15/30/90 días. No simula vistas completas de estados que la API no permite recuperar. |
| Clases | Fecha, horario, capacidad, plazas reservadas/asistidas, libres derivadas, estado y “Ver sesión”. Sin coach o participantes ficticios. |
| Productos | Vista administrativa compacta, búsqueda real por nombre/SKU, precio, estado, stock desconocido explícito y ficha “Ver producto”. Sin alta/edición ficticia. |
| Planes | Cards conservadas, precio vigente, duración, congelamiento, “Ver condiciones” y distinción clara de planes publicados. Sin botones de creación/edición/activación que no existen en API. |
| Copy | Mensajes administrativos más directos; se conserva la personalidad de la web pública. |

Las alertas no añaden métricas productivas inventadas:

- Vencimientos y saldo proceden de `/dashboard/summary`; el saldo no se convierte
  en cantidad de deudores. No hay enlace a un desglose financiero inexistente.
- Alta ocupación deriva de `reserved / capacity >= 0.8`, únicamente de las
  sesiones de la página consultada. La UI explicita “al menos 80 %” y el tamaño
  del conjunto; no lo presenta como total global. Es un criterio visual, no una
  modificación de la regla de cupos/reserva.
- “Prospectos nuevos” usa `GET /prospects?status=NEW` y su `total`, no el tamaño
  de una página. El enlace abre CRM con ese mismo filtro.
- No se calcula un total de seguimientos vencidos a partir de una lista parcial.

## Gaps reales comprobados

Se revisaron OpenAPI en ejecución, endpoints, contratos y servicios existentes.
No se modificó ninguno de esos archivos.

| Área | Evidencia | Límite / trabajo pendiente |
|---|---|---|
| Membresías | `MembershipEndpoints`: POST raíz y GET `/expiring`. `ExpiringAsync` devuelve solo ACTIVE, hasta 100 filas y ventana de 1–90 días. | No hay GET de todas/activas/congeladas/vencidas, detalle ni paginación completa. Las tabs Todas / Activas / Por vencer / Congeladas / Vencidas quedan planteadas para cuando exista esa consulta. No derivarlas del listado de socios ni de las próximas 100 expiraciones. **Esta parte del objetivo requiere ampliación de backend autorizada.** |
| Socios | `MemberListItem` expone MembershipStatus y MembershipEndDate, sin PlanName. `MemberService` busca membresías dentro de fecha. | Se muestra estado/vencimiento; no se reconstruye historial, plan o estado expirado a partir de null. |
| Documentos | OpenAPI real contiene documentType/documentNumber; `SqlColumnMappings`: varchar(20), nvarchar(40). | Implementado. No hay catálogo ni enum de tipos; se usa campo opcional de texto con ejemplo, sin imponer validaciones DNI/CE/pasaporte no aprobadas. |
| CRM | `ProspectListItem`: nombre, teléfono, correo, estado, LeadSource, NextFollowUpAtUtc. El GET acepta `status`. | No devuelve plan de interés ni último contacto; tampoco descripción de próxima acción, edición de seguimiento o catálogos de origen/planes con IDs internos. La UI muestra “Próximo seguimiento”, no inventa llamada/reunión. |
| Estados CRM | `CK_Prospects_Status`: NEW, CONTACTED, TRIAL_SCHEDULED, QUALIFIED, WON, LOST, ARCHIVED. | Filtro limitado exactamente a estos valores. INTERESTED no se añadió como filtro. |
| Clases | `ClassSessionListItem`: horario, capacidad, reserved y estado. `reserved` cuenta CONFIRMED/ATTENDED. | Sin coach, listado de reservas/participantes, cancelación o CRUD. Reserva por terceros existe, pero requiere MemberId numérico no expuesto en catálogo de socios; no se habilitó un flujo incompleto. |
| Productos/stock | `ProductService` filtra ACTIVE y devuelve `stock=null` si branchId no se proporciona. | Sin catálogo de sedes para selección fiable, ni ficha adicional, edición, movimientos o inactivos. No se interpreta null como cero ni como stock suficiente; ficha usa los campos recuperados. |
| Planes | Solo catálogo público vigente, sin CRUD administrativo ni activación/desactivación. | Consulta y condiciones habilitadas. Falta API administrativa antes de ofrecer gestión de escritura. El catálogo tampoco resuelve PlanVersionId para alta de membresía. |
| Cobros | Solo saldo agregado en dashboard y operaciones transaccionales existentes. | Falta consulta operativa de cuentas pendientes y catálogos necesarios; no se inventa una pantalla de cobro. |
| Auth real | No hay credenciales verificables recuperadas de documentación o entorno local. | Se preservan usuarios/passwords y las cuatro pruebas live quedan explícitamente pendientes. |

No se pusieron tabs o botones deshabilitados que aparenten funcionalidad terminada.
La segunda pasada mejora lo que permite la API; **no equivale a cerrar el módulo
administrativo completo de membresías/inventario/planes**.

## Datos demo y preparación de presentación

Los nombres con sufijos numéricos y el teléfono `900000000` provenían de
`frontend/tests/fixtures/api-server.mjs`. Se reemplazaron por 21 nombres
ficticios distintos sin numeración, contactos enmascarados no marcables y correos
`example.test`. No provienen de personas reales. CRM muestra tres ejemplos con
origen, estados soportados y seguimiento; solo utiliza campos del contrato real.

`database/demo/DemoData.sql` ya declara datos ficticios, usa nombres naturales,
teléfonos distintos y un prospecto CONTACTED con próximo seguimiento. No es el
origen de los nombres defectuosos de los screenshots anteriores. **No se alteró
el script ni se resembró GymFlowDb.**

Antes de la demo autenticada final, con autorización para modificar datos demo:

1. Revisar que el tenant de presentación no incluya registros residuales de
   validaciones anteriores; no borrar registros indiscriminadamente.
2. Acordar el conjunto de contactos ficticios y comprobar que no sean datos
   personales reales; mantener contactos no operativos y dominios reservados.
3. Preparar fechas relativas vigentes de membresías, clases y seguimientos;
   mantener consistencia de planes, cupos y estados. Los fixtures visuales usan
   fechas fijas para reproducibilidad, no son un seed productivo.
4. Ampliar la variedad CRM con estados y seguimientos soportados; exponer plan de
   interés/último contacto por API antes de prometer esas columnas.
5. No reejecutar DemoData esperando reemplazo: su guardia omite instalación si la
   organización ya existe. Cualquier actualización necesita un script de fuente
   revisado, autorización y protección de registros ajenos a la demo.

## Archivos frontend cambiados

- `src/features/dashboard/{dashboard,operational-alerts}.tsx`
- `src/features/people/{people-page,person-form}.tsx`, `prospect-statuses.ts`
- `src/features/operations/pages.tsx`, `admin-products.tsx`
- `src/features/plans/plan-catalog.tsx`, `src/features/module-page.tsx`
- `src/components/workspace-shell.tsx`, `src/components/ui/badge.tsx`
- `src/lib/api/{contracts,gymflow}.ts`
- `tests/fixtures/api-server.mjs`
- `tests/e2e/{admin-commercial,admin-states,foundation}.spec.ts`
- `tests/unit/forms-and-contracts.test.ts`, `tests/review/screenshots.spec.ts`
- `scripts/create-review-gallery.mjs`
- `README.md`, `docs/{ADMIN_COMMERCIAL_PASS_2,INTEGRATION_GAPS,SCREENSHOTS,VALIDATION}.md`

Se comprobaron hashes SHA-256 de **116 archivos fuente de DB/backend** antes y
después; sin diferencias. No se ejecutaron escrituras contra la API real o SQL.
Los archivos de configuración/secrets existentes se conservaron.

## Comandos

Desde `GymFlow_Final/frontend`, binarios locales instalados con pnpm:

```powershell
node node_modules/prettier/bin/prettier.cjs --write <archivos modificados>
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node node_modules/next/dist/bin/next build
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.tools\browsers"
node node_modules/@playwright/test/cli.js test
node node_modules/@playwright/test/cli.js test --config playwright.live.config.ts
node node_modules/@playwright/test/cli.js test --config playwright.review.config.ts
node scripts/create-review-gallery.mjs
```

Sin warnings en lint/build. Se conserva la advertencia de instalación de ESLint 9
ya documentada por compatibilidad; no hubo nuevas instalaciones.
Chromium emulado, no certificación todavía en Safari/Firefox/dispositivos físicos.
Sigue pendiente la validación autenticada real. No se marca frontend terminado.
