# GymFlow DB + Backend v1 — validación local

Fecha: 16 de octubre de 2026. Raíz: `GymFlow_Final`.
Informe de continuación del trabajo existente; la base principal `GymFlowDb` se conserva.
No se implementó frontend ni se cambió SQL Server, el monolito modular o el modelo multi-tenant.

## Entorno y evidencia

- SQL Server 2025 Express 64-bit, instancia `DESKTOP-DT1LLGB\SQLEXPRESS`, alias `.\SQLEXPRESS`, autenticación Windows.
- SDK .NET 10.0.402, runtime .NET/ASP.NET Core 10.0.13, Windows x64. SDK local en `backend/.tools/dotnet`.
- k6 2.3.0, ejecutable local en `backend/.tools/k6/k6-v2.3.0-windows-amd64/k6.exe`.
- Conexión: `Server=.\SQLEXPRESS;Database=GymFlowDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;`.
- JWT y contraseñas de validación generados en memoria; no se guardaron secretos reales en archivos fuente.
- Artefactos reproducibles: `backend/artifacts/`, excluido del control de versiones. Los comandos y scripts están en el proyecto.
- La extracción no contiene un repositorio Git dentro de `GymFlow_Final`; el inventario de cambios recoge los archivos editados durante el trabajo, no un diff de Git.

## Resultado por área

| Área | Estado | Evidencia / alcance |
|---|---|---|
| SQL Schema | PASS | 99 tablas y 99 PK; 202 FK; 118 restricciones UNIQUE; 177 CHECK; 267 índices; 25 columnas rowversion. Sin FK/CHECK deshabilitados o no confiables; sin índices deshabilitados. |
| Clean Install | PASS | Instaladores oficiales expandidos en orden en `GymFlowValidation_87970f4b864c`: esquema/seeds, demo, integridad y repetición de demo sin duplicados. También 19/19 pruebas .NET contra esta base. |
| Demo Data | PASS | Datos ficticios y segunda instalación idempotente. |
| Integrity Tests | PASS | 14 aserciones SQL, incluidas conciliación financiera, efectivo, inventario, puntos, capacidad y lista de espera. |
| Restore | PASS | Restore de la solución con SDK fijado y dependencias corregidas. |
| Build Release | PASS | 0 warnings, 0 errores. |
| Tests | PASS | 19/19 .NET; 0 fallos, 0 omitidas; SQL Server real habilitado. |
| API Startup | PASS | HTTP, `/health/live`, `/health/ready` y OpenAPI; lecturas/escrituras verificadas en SQL. |
| Authentication | PASS | Login de cuatro roles, tenant incorrecto, JWT alterado, bloqueo de usuario, rate limit, refresh de un solo uso y replay rechazado. |
| Authorization | PASS | Matriz admin/recepción/entrenador/socio, 401/403; rol inactivo sin permisos tras rotación. |
| Multi-tenant isolation | PASS | Lectura/escritura A/B por HTTP; filtros EF por contexto; rechazos de FK cruzadas y cambios de propietario. |
| Membership | PASS | Precio contractual, deuda, consulta de vencimientos y plan gratuito sin deuda inválida. |
| Payments/Cash | PASS | Parcial 50/120 deja 70; mixto 40 efectivo + 80 Yape mueve solo 40 en caja; apertura única, cierre, rollback y sobrepago concurrente rechazado. |
| Access | PASS | Denegación sin membresía, entrada con membresía activa, socio bloqueado y excepción vigente. |
| Training/Classes | PASS | Entrenador asignado/progreso por API; cupos y espera concurrentes; re-reserva sin duplicado; rutina completa en SQL con rollback. |
| Commerce/Inventory | PASS | Catálogo/stock por API; entradas/salidas y conciliación de ledger en SQL con rollback. |
| Loyalty/GymPoints | PASS | Saldo/ledger, canje concurrente, stock y débito conciliados. |
| Notifications/Jobs | PASS | Notificaciones propias y marca de lectura; enqueue/estado/aislamiento por API; ejecución/log/estado del job por SQL con rollback. |
| Concurrency | PASS | Refresh, sobrepago, canje, cupos, turnos de caja y rowversion SQL/EF. |
| Load Test 50 | PASS | 50 VU alcanzados; 12.390 solicitudes; 0 fallos; p95 8,92 ms; p99 32,30 ms. |
| Load Test 100 | PASS | 100 VU alcanzados y sostenidos 60 s; 42.567 solicitudes; 0 fallos; p95 10,46 ms; p99 60,88 ms. |

`PASS` corresponde a la superficie v1 existente en `backend/API_SURFACE.md`.
No hay API de escritura de inventario ni CRUD de rutinas en esa superficie: sus ciclos se validaron directamente en SQL.
Los jobs se encolan y consultan por API; no existe un worker real de RPA/notificación en este alcance. El test SQL de ejecución no equivale a ejecutar un worker.

## EF Core, consultas e índices

- Lecturas de entidades con `AsNoTracking`; las proyecciones escalares/DTO no cargan entidades en el tracker. Se añadieron lecturas sin tracking en autenticación donde no se modifica la entidad.
- Seis pruebas con SQL real comparan páginas de tamaño 1 y 100 sobre fixtures de tres registros en socios, clases, productos, prospectos, notificaciones y premios. El número de consultas permanece constante (máximo 3) y el tracker queda vacío: no se observó N+1 en estos listados.
- Los listados paginados limitan el tamaño a 100. Se añadieron desempates por ID para mantener orden determinista; vencimientos y catálogo público también tienen límite de 100.
- Los saldos de asignaciones de pagos se recuperan agrupados en una consulta; se eliminó la lectura repetida por deuda. Los bloqueos por recurso de las escrituras financieras son intencionales para serializar conflictos.
- El cierre de caja calcula el total con `SUM` en SQL, sin materializar todo el historial en memoria. El dashboard usa agregados SQL; sus consultas tienen número fijo.
- Prueba adicional en la base temporal: 10.000 socios, membresías, cuentas por cobrar y movimientos de caja. Conteo: 2 ms; página `OFFSET 9900/FETCH 25`: 50 ms; saldo agregado: 12 ms; caja agregada: 5 ms. Son tiempos de ejecución SQL, sin incluir compilación ni red. Se hizo rollback de toda la fixture.
- La página profunda generó 40.229 lecturas lógicas de worktable; las lecturas físicas fueron 0. OFFSET y búsqueda por subcadena pueden encarecerse con volúmenes mayores. No se cambió el contrato de paginación ni se añadieron índices especulativos.
- Query Store confirmó uso de índices de organización/estado de socios, fechas de membresías y reservas por sesión/estado. Se revisaron planes compilados almacenados y estadísticas de ejecución; no son capturas de planes de ejecución reales con contadores por operador. Los planes examinados no sugirieron índices faltantes ni conversiones que afectaran al plan.
- Índices relacionados revisados: `IX_People_Org_Name`, `IX_Members_Org_Status`, `IX_Memberships_Org_Member_Dates`, `IX_Memberships_Org_Status_EndDate`, `IX_PaymentAllocations_Receivable`, `IX_CashMovements_Shift_Date`, `IX_ClassSessions_Branch_Start`, `IX_ClassReservations_Session_Status`, `IX_Products_Org_Status_Name` y UNIQUE de inventario por organización/sede/producto.
- Se preservan DbContext por solicitud, SQL connection pooling, filtros tenant y transacciones explícitas. `sp_getapplock` serializa únicamente recursos de la misma organización.
- Con MARS habilitado, EF no dispone de savepoints. Los servicios abortan la transacción completa ante error; el rollback se probó. Se suprime solamente ese warning conocido. No se reintentan automáticamente escrituras financieras con resultado de commit incierto.

Evidencia: `scale-diagnostics.txt`, `query-plan-diagnostics.txt`, `performance-diagnostics.txt` y `QueryEfficiencyTests.cs`.

## Carga y número de pruebas

La batería final registra **168 ejecuciones de pruebas/comprobaciones principales**:
19 pruebas .NET en la principal + las mismas 19 en la instalación temporal + 65
comprobaciones del runner HTTP/SQL/carga por cada uno de los dos perfiles (130).
Las 19 pruebas .NET son casos distintos; su segunda ejecución no aumenta la
cobertura única. Las comprobaciones del runner incluyen suites SQL y operaciones
HTTP múltiples, por lo que no se presentan como 130 casos unitarios distintos.

Además se ejecutaron la instalación limpia, demo repetida, diagnóstico de 10.000
registros y validación estática (99 tablas, 106 archivos C#, 21 códigos de permisos,
0 errores). Las 14 aserciones de integridad y los tres ciclos SQL operativos ya
están incluidos en las comprobaciones del runner; no se suman otra vez al total.
IntegrityTests volvió a ejecutarse y pasar al finalizar ambas cargas.

| Perfil final | VU máximo | Duración aprox. | Solicitudes | HTTP fallidos | Checks | Media | p95 | p99 | Máximo | Solicitudes/s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Load Test 50 | 50 | 180,7 s | 12.390 | 0 (0%) | 100% | 3,49 ms | 8,92 ms | 32,30 ms | 174,83 ms | 68,58 |
| Load Test 100 | 100 | 240,9 s | 42.567 | 0 (0%) | 100% | 4,69 ms | 10,46 ms | 60,88 ms | 262,88 ms | 176,68 |

Total final: **54.957 solicitudes**, **0 fallos HTTP**, **0 iteraciones interrumpidas**.
No se suman aquí las cargas previas (incluida la primera de 11.280 solicitudes)
ni la primera ejecución de 100, para que las cifras correspondan a la compilación final.
Archivos: `load-summary-50.json`, `load-summary-100.json`, `load-50.log`,
`load-100.log`, `integration-results-50.json`, `integration-results-100.json`.

Los perfiles k6 consultan socios, dashboard y clases con una identidad diferente por VU, respetando el rate limit por usuario. El login se valida funcionalmente antes de la carga; no se mide capacidad de login. Cada iteración realiza tres GET y pausa un segundo.

- Perfil 50: 30 s hasta 10; 60 s hasta 25; 60 s hasta 50; 30 s hasta 0. Alcanza 50; no es una meseta de 50 durante todo el ensayo.
- Perfil 100: 30 s hasta 20; 60 s hasta 50; 60 s hasta 100; 60 s sostenidos en 100; 30 s hasta 0.
- Umbrales: checks 100%; fallos HTTP <1%; p95 <750 ms; p99 <1.500 ms.
- Alcance: localhost, datos ficticios pequeños por tenant y carga de lectura. La prueba SQL de 10.000 registros es independiente. No se extrapola a tráfico de producción, red externa o 100 escrituras financieras simultáneas.

## Errores encontrados y correcciones

El trabajo previo se preservó y se completó con estos ajustes:

1. Instalación SQL: opciones SET incompatibles con índices filtrados/XML; se fijó `QUOTED_IDENTIFIER` y demás opciones necesarias en los scripts fuente. SQLCMD ahora falla al primer error.
2. Demo: un `GO` separaba la salida anticipada del resto del script; se mantuvo el control de flujo en el mismo batch y se añadió transacción para impedir una carga parcial.
3. Integridad SQL: se añadieron FK de organización en tablas con relaciones opcionales, unicidad de movimiento por split y validación de efectivo/importe/turno abierto en trigger. El instalador y el patch aditivo contienen la misma corrección.
4. Entorno y restore: SDK preview del sistema frente al SDK estable requerido; se instaló 10.0.402 dentro del proyecto. La dependencia transitiva vulnerable `System.Security.Cryptography.Pkcs` 9.0.11 bloqueaba restore con warnings como errores; se fijó 10.0.13.
5. Compilación/análisis: nombres, mensajes de argumentos, logging y formato cultural de claims corregidos. Las excepciones de nombres de dominio tienen supresiones locales justificadas; no se desactivaron los analizadores globalmente.
6. Persistencia: EF usaba OUTPUT incompatible con tablas que tienen triggers; se configuró `UseSqlOutputClause(false)`. Se alinearon 148 mappings de tipos/longitudes SQL y se validan las longitudes y el tenant antes de guardar.
7. Transacciones: la estrategia automática de reintentos chocaba con las transacciones explícitas; se retiró para no repetir pagos de resultado incierto. Se añadieron bloqueos transaccionales de recursos en operaciones sensibles.
8. Seguridad: consumo atómico del refresh; filtro de roles activos; validación segura de hashes malformados; rate limiter colocado después de autenticación; escrituras tenant inválidas rechazadas.
9. Pagos/caja: validación de totales, asignaciones duplicadas, moneda, pertenencia de recursos y saldo pendiente; sobrepago concurrente rechazado; solo efectivo afecta caja; agregación SQL al cerrar.
10. Clases: reservas concurrentes serializadas, posiciones de espera distintas y reactivación de reserva cancelada sin violar UNIQUE.
11. Membresías: el plan de precio cero ya no intenta crear una cuenta por cobrar de importe cero prohibida por CHECK; el identificador de deuda puede ser nulo.
12. Consultas: límites y parámetros opcionales de paginación, orden estable por ID, agrupación de saldos y tracking innecesario corregidos. Se agregaron pruebas de regresión con SQL real.

Una solicitud anterior de borrar una base poblada fue rechazada por la revisión automática. Se resolvió mediante patch aditivo y bases nuevas `GymFlowValidation_*`; la validación final no necesita ni solicita borrar `GymFlowDb`.

## Archivos editados o añadidos

Rutas relativas a `GymFlow_Final`; se incluyen las correcciones de la sesión previa conservadas.

| Grupo | Archivos |
|---|---|
| Instalación/esquema | `database/README.md`, `98_InstallSchema.sql`, `99_InstallDemo.sql`, `04_Finance_Cash.sql`, `05_Access_Training.sql`, `06_Commerce.sql`, `07_Loyalty_Communication.sql`, `08_Automation_AI.sql`, `demo/DemoData.sql`, `patches/20261015_ValidationHardening.sql` |
| Validación SQL | `database/tests/IntegrityTests.sql`, `ApiFixtures.sql`, `OperationalTests.sql`, `PerformanceDiagnostics.sql`, `ScaleDiagnostics.sql`, `QueryPlanDiagnostics.sql` |
| Configuración | `backend/.gitignore`, `global.json`, `Directory.Packages.props`, `README.md`, `src/GymFlow.Infrastructure/GymFlow.Infrastructure.csproj`, `src/GymFlow.Api/appsettings.Development.json` |
| API | `backend/src/GymFlow.Api/Program.cs`, `Auth/JwtTokenService.cs`, `Middleware/ApiExceptionMiddleware.cs` y los archivos `Endpoints/*Endpoints.cs` (parámetros opcionales y correcciones de compilación) |
| Contratos/dominio | `backend/src/GymFlow.Application/Contracts/MembershipContracts.cs`; `backend/src/GymFlow.Domain/Entities/AccessTrainingCommerceEntities.cs`, `SecurityEntities.cs` |
| Persistencia | `backend/src/GymFlow.Infrastructure/Persistence/GymFlowDbContext.cs`, `SqlColumnMappings.cs`, `TransactionLocks.cs`; `Security/PasswordService.cs` |
| Servicios | `backend/src/GymFlow.Infrastructure/Services/AccessService.cs`, `AuthService.cs`, `AutomationService.cs`, `CashService.cs`, `ClassService.cs`, `CrmService.cs`, `DashboardService.cs`, `DependencyInjection.cs`, `LoyaltyService.cs`, `MemberService.cs`, `MembershipService.cs`, `NotificationService.cs`, `PaymentService.cs`, `ProductService.cs`, `PublicCatalogService.cs`, `SystemClock.cs`, `TrainerService.cs` |
| Pruebas/operación | `backend/tests/GymFlow.Tests/ArchitectureSmokeTests.cs`, `PasswordServiceTests.cs`, `PersistenceRegressionTests.cs`, `SqlServerIntegrationTests.cs`, `QueryEfficiencyTests.cs`; `backend/tests/integration_api.py`; `backend/scripts/generate_sql_mappings.py`, `validate_schema.py`, `Start-Local.ps1`, `Stop-ValidationApi.ps1`; `backend/load-tests/gymflow-smoke.js` |
| Evidencia documental | `docs/STATIC_VALIDATION.json`, `VALIDATION_STATUS.md`, `CODEX_VALIDATION_REPORT.md` |

## Comandos ejecutados y reproducción

Desde `GymFlow_Final/database`, la instalación oficial inicial se ejecutó con:

```powershell
sqlcmd -S '.\SQLEXPRESS' -E -C -b -i 98_InstallSchema.sql
sqlcmd -S '.\SQLEXPRESS' -E -C -b -i 99_InstallDemo.sql
sqlcmd -S '.\SQLEXPRESS' -E -C -b -i tests/IntegrityTests.sql
```

El primer comando está destinado exclusivamente a una base vacía; no se debe repetir sobre la principal poblada. En la continuación se usó la alternativa segura:

```powershell
# Desde GymFlow_Final/backend
py scripts/validate_schema.py
$validationDb = (Get-Content artifacts/clean-install-database.txt -Raw).Trim()
sqlcmd -S '.\SQLEXPRESS' -E -C -b -v "DatabaseName=$validationDb" -i ../database/tests/ScaleDiagnostics.sql -o artifacts/scale-diagnostics.txt
$env:PATH = "$PWD\.tools\dotnet;$env:PATH"
$env:GYMFLOW_TEST_CONNECTION = 'Server=.\SQLEXPRESS;Database=GymFlowDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;'
dotnet --info
dotnet restore GymFlow.sln
dotnet build GymFlow.sln -c Release
dotnet test GymFlow.sln -c Release
# También se ejecutó contra la instalación limpia:
$env:GYMFLOW_TEST_CONNECTION = "Server=.\SQLEXPRESS;Database=$validationDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;"
dotnet test GymFlow.sln -c Release --no-build
# El runner HTTP configura explícitamente GymFlowDb en su propio proceso:
py tests/integration_api.py --load --vus 50
py tests/integration_api.py --load --vus 100 --keep-api
sqlcmd -S '.\SQLEXPRESS' -E -C -b -i ../database/tests/IntegrityTests.sql -o artifacts/integrity-final.log
sqlcmd -S '.\SQLEXPRESS' -E -C -b -i ../database/tests/PerformanceDiagnostics.sql -o artifacts/performance-diagnostics.txt
sqlcmd -S '.\SQLEXPRESS' -E -C -b -i ../database/tests/QueryPlanDiagnostics.sql -o artifacts/query-plan-diagnostics.txt
# Desde GymFlow_Final
py scripts_static_validate.py
```

El helper de instalación expande `:r` respetando el orden oficial y sustituye únicamente el nombre de base por el temporal. Ejecuta esquema, demo y demo de nuevo. No es un esquema alternativo.
El runner HTTP ejecuta también `OperationalTests.sql`, `IntegrityTests.sql`, fixtures y controles SQL negativos. Inicia el DLL Release con secretos efímeros en variables de entorno.

## Warnings, riesgos y recomendación

- Build/restore final: 0 warnings pendientes; tests: 0 omitidos. Las advertencias esperadas de MARS y el rollback completo están documentados arriba.
- Se conservaron bases temporales de validación y tenants/usuarios ficticios de las pruebas en la principal. No se hizo limpieza destructiva. No son datos de producción.
- El alcance v1 conserva sus límites aprobados: workers/proveedores externos y nuevas APIs de inventario/rutinas requieren trabajo posterior si se desean. No son funcionalidades eliminadas para compilar.
- Falta una validación en infraestructura de despliegue, con volumen representativo y carga prolongada/escrituras mixtas. Estas pruebas locales no certifican disponibilidad, backup/restore operativo ni capacidad de producción.
- **Recomendación: GymFlow DB + Backend v1 puede considerarse terminado y validado en el alcance local documentado del paquete.** No quedan fallos técnicos bloqueantes en las pruebas ejecutadas. La ampliación de la superficie funcional y la preparación de producción son fases posteriores.
- API de validación dejada iniciada en `http://127.0.0.1:5080`; comprobación final `/health/ready`: `{"status":"ready"}`. El PID está en `backend/artifacts/api.pid`. La sesión usa credenciales efímeras; para credenciales demo controladas por el usuario, usar el procedimiento de `backend/README.md`.
