# GymFlow · Integration Patch de Admin

Cierre: 2026-10-21, America/Lima. Continuación del estado aprobado, dentro de
`GymFlow_Final`. Se conserva el monolito modular, SQL Server Express, multi-tenant
y una sola aplicación Next.js. Sin rediseño, nuevas dependencias ni desarrollo
de Recepción, Entrenador o Socio. Sus accesos existentes solo se verificaron.

## Resultado final

| Control | Resultado |
|---|---|
| Backend Integration Patch | PASS |
| Demo Authentication 4 roles | PASS |
| Membership Contracts | PASS |
| CRM Contracts | PASS |
| Classes Contracts | PASS |
| Inventory Contracts | PASS |
| Plans Write Contracts | PASS |
| Multi-tenant Tests | PASS |
| Audit | PASS |
| Concurrency | PASS |
| Backend Build | PASS · Release, 0 warnings / 0 errores |
| Backend Tests | PASS · 25/25, sin omisiones |
| Integrity Tests | PASS |
| Admin API Integration | PASS · 52/52 checks HTTP y navegación real |
| Frontend Lint | PASS · 0 warnings |
| Frontend Typecheck | PASS |
| Frontend Tests | PASS · 37/37 |
| Frontend E2E | PASS · 39 aislados + 8 reales; 1 omisión exclusiva de desktop |
| Frontend Build | PASS · producción |
| Responsive 375/768/1440 | PASS · 3 recorridos, 42 capturas |

Total del cierre: **112 casos PASS** (25 backend + 37 unitarios frontend +
39 E2E aislados + 8 E2E reales + 3 responsive), **1 omisión intencional**
(prueba de menú móvil en desktop), más **52/52 checks HTTP** e IntegrityTests PASS.
No se suman las ejecuciones repetidas como pruebas adicionales.

Las pruebas E2E reales tienen traces, video y screenshots de fallo desactivados
para no capturar credenciales. Los E2E aislados prueban escrituras/formularios y
estados de UI; los tests SQL y smoke HTTP verifican la implementación real.
No se confunden resultados del doble de API con pruebas del backend.

Evidencia: `backend/artifacts/patch-{build,tests,integrity,api,smoke}.log`,
`patch-smoke.json`, `patch-source-comparison.json`; y
`frontend/artifacts/patch-{lint,typecheck,unit,build,e2e,live,review}.log`,
`patch-secrets.json`. Los artefactos están ignorados.

## Endpoints añadidos y permisos

Todos bajo `/api/v1`, con autenticación y filtro por OrganizationId.
**No se añadieron permisos ni se amplió la matriz de roles.**

| Método / ruta nueva | Contrato | Permisos existentes requeridos |
|---|---|---|
| GET `/memberships` | page/pageSize/search/status/expiresFrom/expiresTo/memberId/planId; socio, plan, fechas, precio contratado, estado | MEMBERSHIPS.VIEW **y** MEMBERS.VIEW |
| GET `/classes/sessions/{sessionId}/participants` | page/pageSize/status; reserva, socio, estado, espera y fecha | CLASSES.VIEW **y uno de** CLASSES.MANAGE, CLASSES.RESERVE_FOR_OTHERS, TRAINING.MEMBERS_VIEW |
| GET `/branches` | Catálogo paginado de sedes activas: id/código/nombre | STORE.VIEW |
| GET `/products/manage` | page/pageSize/search/status/branchId; SKU, precio, stock, mínimo, publicación, estado y rowversion | INVENTORY.MANAGE |
| POST `/products` | Alta de metadatos comerciales, sin stock mutable | INVENTORY.MANAGE |
| PUT `/products/{id}` | Edición/activación/desactivación; rowversion obligatorio | INVENTORY.MANAGE |
| GET `/plans` | page/pageSize/search/status; PlanId, PlanVersionId, versión vigente, términos y rowversion | MEMBERSHIPS.MANAGE |
| POST `/plans` | Plan y primera versión, atómicamente | SETTINGS.MANAGE |
| PUT `/plans/{id}` | Código/nombre/descripción/publicación/estado; rowversion obligatorio | SETTINGS.MANAGE |
| POST `/plans/{id}/versions` | Nueva versión de precio/duración/congelamiento/límite de reservas; rowversion obligatorio | SETTINGS.MANAGE |

Contratos existentes ampliados:

- GET `/prospects`: `interestedPlan` y `lastContactAtUtc`. El último contacto
  deriva de MAX(OccurredAtUtc) de ProspectActivities o FirstContactAtUtc si no hay
  historial. Se conservan búsqueda/estado/paginación server-side.
- GET `/classes/sessions`: `coachName` y `availablePlaces`. No incorpora todos
  los participantes en cada fila. Reservas confirmadas/asistidas ocupan cupo;
  espera permanece separada.
- POST `/memberships`: rechaza contratar un plan padre inactivo. No altera
  membresías anteriores ni su precio/versionado.
- El middleware devuelve 404 para registros inexistentes o fuera del tenant.
  Los conflictos de rowversion conservan 409; no se filtra SQL al cliente.

OpenAPI real actualizado: **42 operaciones**, antes 32. Referencia en
`frontend/docs/openapi.json` y tipos regenerados en `src/lib/api/generated.ts`.

## Persistencia, seguridad y rendimiento

**Cero tablas, columnas, relaciones, índices, triggers o migraciones modificados.**
La comparación con 116 archivos fuente de la validación anterior confirma que
ningún SQL existente cambió. Solo se añadió el script opcional de datos demo
`database/demo/E2EAccounts.sql`; no se volvió a instalar ni se borró GymFlowDb.
Ninguna base ajena al proyecto fue modificada.

Las escrituras de productos y planes guardan auditoría en la misma transacción:
OrganizationId, actor, acción, entidad, PublicId y JSON anterior/posterior.
La publicación de versiones serializa por plan, comprueba rowversion, inserta
una versión nueva y copia los beneficios existentes. No sobrescribe precios,
duración ni condiciones de versiones previas; las membresías mantienen su
PlanVersionId y precio contratado. La versión vigente se elige por vigencia y
mayor VersionNumber, como en el catálogo público existente.

La consulta de membresías interpreta ACTIVE/PENDING según fechas UTC del reloj
existente y conserva `storedStatus` para trazabilidad. FROZEN, CANCELLED y EXPIRED
explícitos se conservan. No actualiza ni persiste estados derivados al consultar.
Por vencer es un filtro ACTIVE con rango de vencimiento, no un estado nuevo.

Inventario continúa leyendo InventoryBalances, conciliable con InventoryMovements.
Sin sede, stock es null; con sede válida y sin saldo inicial, es cero.
Las escrituras del catálogo no aceptan ni ajustan existencias. La regresión SQL
introduce un movimiento y su saldo dentro de una transacción reversible,
comprueba que la consulta devuelve 7 y que la edición conserva saldo y ledger.

Lecturas con AsNoTracking, proyecciones DTO, orden estable, COUNT y Skip/Take SQL;
pageSize limitado a 100. Coach, actividad reciente y stock usan subconsultas
correlacionadas, sin consultas por fila ni grafos completos. Las pruebas previas
de conteo de consultas/tracking siguen pasando. No se añadieron índices:
se reutilizan índices tenant/estado, historial de actividades, sesiones/reservas,
productos por nombre y claves de versiones/saldos existentes.

Los tests reales usan dos organizaciones y verifican lecturas vacías o 404 ante
identificadores ajenos en membresías, CRM, sesiones, planes, productos y sedes.
Un Socio no recibe la lista administrativa de membresías/participantes; Recepción
no puede escribir productos ni planes con sus permisos actuales.

## Demo local y protección de secretos

Las cuentas originales existen pero sus contraseñas aleatorias de validaciones
anteriores no se conservaron. No se cambiaron sus usuarios ni sus hashes.
Se añadieron estas identidades ficticias, solo en el tenant demo canónico:

| Rol | Cuenta E2E nueva |
|---|---|
| ADMIN | admin.e2e@example.test |
| RECEPTION | reception.e2e@example.test |
| TRAINER | trainer.e2e@example.test |
| MEMBER | member.e2e@example.test |

El helper `backend/scripts/provision_demo_e2e.py` genera claves aleatorias,
guarda únicamente sus hashes PBKDF2 en SQL y persiste los valores locales en
`frontend/.env.local`. La provisión es idempotente, no resetea usuarios existentes
y rehúsa continuar si encuentra una cuenta sin su credencial local.
No se incorporó esta provisión opcional al arranque productivo.

`.env.local` no está versionado: el proyecto sigue sin repositorio Git y la regla
`.env*` lo ignora. No se inicializó ni publicó Git. Contiene configuración local,
una clave local de sesión del adaptador Next y credenciales demo/E2E; no secretos
de producción. Solo nombre/PublicId de organización usan NEXT_PUBLIC.

`frontend/scripts/verify-local-secrets.mjs` comprueba estas condiciones y escanea
fuentes/tests/docs y `.next/static` sin imprimir valores. No encontró contraseñas
ni clave de sesión en archivos públicos compilados. No se hardcodearon claves en
componentes. Las contraseñas no se incluyen en este informe.

El smoke HTTP conserva un producto y un plan **internos e inactivos**, código
`DEMO-PATCH-20261020`, exclusivamente para validar escrituras reales. Se reutilizan
en ejecuciones posteriores, conservando auditoría/versiones. No aparecen en el
catálogo público. Las pruebas .NET revierten sus datos mediante rollback.

## Admin y revisión responsive

Membresías consume el GET nuevo y ofrece Todas/Activas/Por vencer/Congeladas/
Vencidas/Canceladas/Pendientes con búsqueda y paginación. En móvil usa filas
enriquecidas. CRM muestra el plan y último contacto reales. Clases muestra coach,
cupos y participantes paginados en su ficha. Productos incorpora sede, stock
mínimo, estado, alta/edición. Planes mantiene cards y distingue metadatos de
publicación de condiciones nuevas. Permisos visuales acompañan los controles API.

Se conservan colores, tipografía, layouts, modales y navegación aprobados.
Los estados de reservas se presentan en español. El formulario largo de plan
usa scroll vertical dentro del modal en móvil; el guardado se probó también allí.

[Galería de 42 capturas](../frontend/artifacts/review/index.html) ·
[Índice por pantalla/ancho](../frontend/docs/SCREENSHOTS.md).
Capturas reproducibles con datos ficticios del servidor E2E aislado, a 375/768/1440;
el login real y contratos reales se verifican en la suite live, por separado.

## Pruebas nuevas y errores corregidos

- `AdminIntegrationTests`: seis casos SQL reales para membresías, CRM, clases,
  inventario, planes y aislamiento. Cubren filtros/páginas, lecturas sin tracking,
  estados derivados, rowversion, auditoría, saldo/ledger, copia de beneficios,
  conservación de precios/contratos y rechazo de planes inactivos.
- `integration_patch_smoke.mjs`: 52 checks HTTP finales, cuatro roles, permisos,
  paginación, contratos, escrituras, stale rowversion, refresh/replay y carreras
  simultáneas de producto/versión. Cada carrera acepta una escritura y devuelve
  409 a la otra; la del plan crea exactamente una versión.
- `admin-contracts.test.ts`: cuatro regresiones de contratos, límites, separación
  de stock/metadata y allowlist explícita del adaptador Next.
- `admin-patch.spec.ts`: alta/edición de producto y publicación de plan en desktop
  y móvil. `admin-commercial.spec.ts` adaptado al GET paginado real de membresías.
- Suite live: los cuatro casos antes omitidos ahora ejecutan login y refresh;
  se añadió navegación Admin por los cinco contratos corregidos.
- Review: incluye los nuevos formularios y participantes; controla ancho,
  errores de consola y excepciones. Sin nuevos errores visuales funcionales pendientes.

Durante el desarrollo se corrigieron dos consultas EF que ordenaban después de
construir records no traducibles: ahora ordenan/paginan antes de proyectar DTO.
También se corrigieron una sección switch de test que requería llaves, el JobTitle
obligatorio del fixture SQL, un selector E2E ambiguo de select y la lectura del
rol desde AuthResponse/JWT en el smoke. Se ajustó el verificador de secretos para
un proyecto sin carpeta public. La advertencia de build por salida única de
solución desapareció al usar el build normal por proyecto. Ninguna corrección
eliminó funcionalidad. El build y lint finales no tienen warnings.

## Archivos añadidos/modificados

Backend y SQL:

- `database/demo/E2EAccounts.sql` (nuevo, solo datos opcionales locales).
- `backend/scripts/{provision_demo_e2e.py,integration_patch_smoke.mjs}` (nuevos).
- `backend/src/GymFlow.Application/Contracts/{AdminContracts,MemberContracts,ClassProductContracts}.cs`.
- `backend/src/GymFlow.Application/Services/ServiceInterfaces.cs`.
- `backend/src/GymFlow.Domain/Entities/{MembershipEntities,CrmTrainingLoyaltyEntities}.cs`.
- `backend/src/GymFlow.Infrastructure/Persistence/GymFlowDbContext.cs`.
- `backend/src/GymFlow.Infrastructure/Services/{AdminCatalogService,MembershipService,CrmService,ClassService,DependencyInjection}.cs`.
- `backend/src/GymFlow.Api/Endpoints/{AdminCatalogEndpoints,MembershipEndpoints,ClassEndpoints}.cs`.
- `backend/src/GymFlow.Api/{Program.cs,Middleware/ApiExceptionMiddleware.cs}`.
- `backend/tests/GymFlow.Tests/AdminIntegrationTests.cs` (nuevo).
- `backend/API_SURFACE.md` (contratos de administración documentados).

Frontend:

- `src/lib/api/{admin-contracts,contracts,gymflow,policy,generated}.ts`.
- `src/app/api/gymflow/[...path]/route.ts` (PUT explícito, origen validado).
- `src/features/operations/{admin-memberships,admin-products,product-form,class-participants,pages}.tsx`.
- `src/features/plans/admin-plans.tsx`, `src/features/people/people-page.tsx`, `src/features/module-page.tsx`.
- `src/components/ui/badge.tsx`.
- `tests/fixtures/{admin-api,api-server}.mjs`.
- `tests/e2e/{admin-commercial,admin-patch}.spec.ts`, `tests/unit/admin-contracts.test.ts`.
- `tests/live/integration.spec.ts`, `tests/review/screenshots.spec.ts`.
- `scripts/{verify-local-secrets,create-review-gallery}.mjs`.
- `docs/{openapi.json,API_INVENTORY.md,INTEGRATION_GAPS.md,SCREENSHOTS.md,ADMIN_COMMERCIAL_PASS_2.md,VALIDATION.md}` y `README.md`.
- `.env.local`: únicamente configuración y credenciales locales; ignorado, no entregado como fuente pública.

Documentación raíz: este informe y `docs/VALIDATION_STATUS.md`.
No se alteraron paquetes, lockfile, scripts de esquema/seeds existentes ni frontend de otros roles.

## Comandos de cierre

Desde `GymFlow_Final/backend`, SDK local existente:

```powershell
$env:GYMFLOW_TEST_CONNECTION='Server=.\SQLEXPRESS;Database=GymFlowDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;'
./.tools/dotnet/dotnet.exe build -c Release
./.tools/dotnet/dotnet.exe test -c Release
```

Desde `GymFlow_Final`:

```powershell
sqlcmd -S '.\SQLEXPRESS' -E -C -b -i database/tests/IntegrityTests.sql
node backend/scripts/integration_patch_smoke.mjs
```

Desde `GymFlow_Final/frontend`, binarios locales instalados con pnpm:

```powershell
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node node_modules/next/dist/bin/next build
$env:PLAYWRIGHT_BROWSERS_PATH="$PWD\.tools\browsers"
node node_modules/@playwright/test/cli.js test
node node_modules/@playwright/test/cli.js test --config playwright.live.config.ts
node node_modules/@playwright/test/cli.js test --config playwright.review.config.ts
node scripts/create-review-gallery.mjs
node scripts/verify-local-secrets.mjs
```

Se descargó OpenAPI de la API local y se regeneró con
`node node_modules/openapi-typescript/bin/cli.js docs/openapi.json -o src/lib/api/generated.ts`.
La API usa `backend/scripts/Start-Local.ps1` sin reset de contraseñas y conexión a
GymFlowDb. Los procesos de prueba se levantan ocultos; solo se reinició la API
de este proyecto tras comprobar su ruta.

## Pendientes y recomendación

Ver [gaps vigentes](../frontend/docs/INTEGRATION_GAPS.md): flujo completo de caja/
cobros y catálogos asociados; selector general de MemberId; edición de seguimientos
CRM; agenda/reservas propias; movimientos de inventario por API; editor de
beneficios/versiones futuras; revocación/logout global y recuperación de contraseña.
Estos puntos no se simulan ni se consideran implementados por este patch.

No se repitió carga: este cierre solicitó smoke y regresiones; los resultados
k6 anteriores no se atribuyen a estos contratos nuevos. La revisión de navegador
es Chromium emulado; Safari/Firefox/dispositivos físicos y despliegue productivo
continúan fuera de esta validación local.

Con los controles finales en PASS, **Admin + Integration Patch se consideran
cerrados para el alcance autorizado de demo local**. No significa finalizar todo
el frontend ni certificar producción. Se detiene el trabajo antes de Recepción,
Entrenador y Socio; sin RPA, IA, Document AI ni nuevos workers.
