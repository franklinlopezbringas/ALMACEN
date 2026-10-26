# Foundation + Administrador · entrega para revisión visual

> Registro histórico de la primera pasada. Estado vigente, validaciones y gaps en
> [Integration Patch · cierre 2026-10-21](../../docs/INTEGRATION_PATCH_REPORT.md).
> La autenticación real pendiente indicada abajo quedó resuelta para los cuatro roles.

Fecha: 2026-10-20. Entorno local Windows, Node 24.13.0, build Next.js de producción.
Se continuó la implementación existente. No se reconstruyó el frontend, no se
modificaron DB/backend, usuarios o contraseñas y no se inicializó ni publicó Git.

**Preparado para revisión visual comercial del alcance implementado. Frontend
no finalizado.** La integración autenticada real sigue pendiente de credenciales
verificables y existen operaciones administrativas que necesitan contratos de API.
No se avanzó con nuevas funcionalidades de Recepción, Entrenador o Socio.

## Resultados

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Lint | PASS, 0 warnings | `artifacts/lint.log` |
| TypeScript strict / typecheck | PASS | `artifacts/typecheck.log` |
| Unitarias / componentes | PASS, 32/32 | `artifacts/tests.log` |
| E2E funcionales desktop/móvil | PASS, 29; 1 omitido | `artifacts/e2e.log`, `playwright-report/index.html` |
| API real, lectura y protección anónima | PASS, 3; 4 logins omitidos | `artifacts/e2e-live.log` |
| Revisión responsive / consola | PASS, 3/3 anchos | `artifacts/review.log` |
| Production build | PASS | `artifacts/build.log` |
| Screenshots | 33 capturas, 11 pantallas por ancho | [Galería](../artifacts/review/index.html), [índice](SCREENSHOTS.md) |

Total del conjunto final: **67 pruebas ejecutadas y correctas, 0 fallidas,
5 omitidas de 72 casos**. No se suman las repeticiones de diagnóstico.
Una omisión corresponde al menú móvil en el proyecto desktop; las otras cuatro
son los logins reales por rol, sin credenciales locales. Las 33 capturas son
artefactos de las tres pruebas de revisión, no 33 pruebas adicionales.

La suite funcional utiliza un doble HTTP aislado en 5099 y Next.js en 3100,
sin SQL. La suite real utiliza la API existente en 5080 y Next.js en 3001.
La API real pasó `/health/ready`; el catálogo público atravesó el adaptador de
Next.js y se renderizó correctamente; `/admin` redirigió al login sin sesión.
Estos tres resultados **no prueban login/refresh real ni escrituras autenticadas**.

## Cobertura y correcciones

- GUID SQL Server: se conserva su formato válido sin exigir la versión UUID de
  RFC 9562. `z.guid()` se aplica al esquema compartido de login y a los claims de
  sesión. Regresión con el identificador real de organización y rechazo de texto
  malformado; E2E verifica la misma forma de identificador. API/BD intactas.
- Login, cookies HttpOnly/SameSite, ausencia de tokens en localStorage, logout
  local, rutas protegidas, redirecciones por rol y rechazo de CSRF.
- Refresh concurrente: la prueba unitaria exige una sola rotación para tres
  peticiones; E2E recupera un access token expirado y verifica retorno al login
  cuando la renovación falla. Las mutaciones 403 no se repiten.
- Permisos: administrador sin permiso de escritura no ve alta; una sección sin
  permiso devuelve acceso restringido. Otros roles no pueden abrir `/admin`.
  La autorización definitiva sigue en .NET.
- Loading, error 403, fallo 503, reintento con recuperación, vacío y búsqueda sin
  resultados. Filtro de socios vuelve a página 1; navegación a página 2 y alta.
- Ficha de socio, registro, CRM con creación y conversión, notificación marcada
  como leída e invalidación de consultas, usando exclusivamente fixtures.
- Desbordamiento móvil: el texto accesible `sr-only` del encabezado de acciones
  escapaba del contenedor de tabla y ensanchaba el documento a 594 px en un
  viewport de 390 px. Se estableció el contexto de posición de la tabla. La
  regresión compara ahora con el ancho configurado del dispositivo, no con un
  `innerWidth` que ya podía estar ensanchado. Paginación móvil pasa sin forzar clics.
- Diálogos controlados: se conserva y restaura el foco del elemento que los abre.
  Escape, ficha del socio y menú móvil pasan sus verificaciones de foco.
- Sidebar con scroll propio; cabecera pública ajustada en móvil; campos de 16 px
  en móvil. La capa CSS de los campos respeta los paddings de Tailwind para que
  iconos y texto no se superpongan.
- Mensaje de credenciales inválidas separado del mensaje de sesión vencida.
  Plurales de duración y registros corregidos; badges no se estiran en tarjetas.
- Selectores E2E acotados al contenido principal para no confundir las alertas
  de la aplicación con el anunciador accesible de rutas de Next.js.
- Las 11 pantallas se comprueban a 375, 768 y 1440 px sin errores de consola,
  excepciones de página ni desbordamiento del documento en el recorrido normal.
  Se revisaron visualmente capturas de dashboard en los tres anchos, login,
  socios, formulario, CRM vacío, catálogo, clases, planes, notificaciones y web.

## Rutas entregadas en este punto

| Ruta | Alcance |
|---|---|
| `/` | Web pública responsive |
| `/planes` | Catálogo público consumido de la API |
| `/login`, `/sin-acceso` | Autenticación y acceso restringido |
| `/admin` | Resumen, KPIs, vencimientos y próximas clases |
| `/admin/socios` | Lista paginada, búsqueda, ficha, alta; `?nuevo=1` abre formulario |
| `/admin/crm` | Prospectos, búsqueda, alta y conversión con confirmación |
| `/admin/membresias` | Próximos vencimientos, 7 días y hasta 100 registros; no gestión completa |
| `/admin/clases` | Consulta de agenda y cupos, paginación |
| `/admin/catalogo` | Catálogo de productos y disponibilidad, paginación; no movimientos de inventario |
| `/admin/planes` | Consulta de oferta vigente; no edición/venta |
| `/admin/notificaciones` | Mensajes propios, paginación y marcar leído |

Las rutas base ya existentes de `/recepcion`, `/entrenador` y `/socio` se
preservan. Sus pruebas de acceso sirven a la foundation; no son aprobación
comercial ni cierre funcional de esas experiencias.

## Endpoints consumidos por Foundation + Admin

Prefijo backend `/api/v1` salvo salud. Transporte del navegador centralizado en
`src/lib/api/client.ts`, adaptadores en `gymflow.ts`; no hay fetch en componentes.

| Método | Endpoint | Uso |
|---|---|---|
| POST | `/auth/login` | Inicio de sesión |
| POST | `/auth/refresh` | Rotación de sesión |
| GET | `/dashboard/summary` | Indicadores |
| GET / POST | `/members` | Buscar/paginar y registrar socios |
| GET | `/members/{publicId}` | Ficha |
| GET / POST | `/prospects` | Buscar/paginar y registrar prospectos |
| POST | `/prospects/{prospectId}/convert` | Conversión |
| GET | `/memberships/expiring?days=7&take=100` | Vencimientos |
| GET | `/classes/sessions` | Agenda y plazas |
| GET | `/products` | Catálogo |
| GET | `/public/{organizationPublicId}/plans` | Planes públicos/administrativos |
| GET | `/notifications/me` | Mensajes propios |
| POST | `/notifications/{notificationId}/read` | Acuse de lectura |
| GET | `/health/ready` | Suite de integración real |

Los Route Handlers `/api/auth/{login,refresh,logout,session}` y
`/api/gymflow/[...path]` pertenecen a la misma aplicación Next.js. `logout` y
`session` son operaciones locales del adaptador, no endpoints nuevos de .NET.
El inventario completo existente de 32 operaciones está en [API_INVENTORY.md](API_INVENTORY.md).

## Archivos de esta continuación

Corrección y validación de identificadores:
`src/lib/auth/validation.ts`, `src/lib/auth/session.ts`,
`src/features/auth/login-form.tsx`, `src/app/api/auth/[action]/route.ts`,
`tests/unit/guid.test.ts`. La corrección compartida ya estaba iniciada al retomar.

Cambios de presentación/accesibilidad:
`src/app/globals.css`, `src/app/(public)/layout.tsx`,
`src/components/workspace-shell.tsx`, `src/components/ui/dialog.tsx`,
`src/components/ui/states.tsx`, `src/components/ui/badge.tsx`,
`src/features/plans/plan-catalog.tsx`.

Pruebas/evidencia:
`tests/e2e/foundation.spec.ts`, `tests/e2e/admin-states.spec.ts`,
`tests/fixtures/api-server.mjs`, `tests/review/screenshots.spec.ts`,
`tests/live/integration.spec.ts`, `playwright.review.config.ts`,
`playwright.live.config.ts`, `scripts/create-review-gallery.mjs`.
La suite `tests/unit/api-client.test.ts` existente también se ejecutó.

Documentación: `README.md`, `docs/VALIDATION.md`, `docs/SCREENSHOTS.md`.
Logs, informes HTML y capturas quedan en directorios ignorados. No se guardaron
contraseñas en archivos versionables. `.env.local` sigue ignorado y sin
credenciales E2E; no fue necesario cambiar su contenido.

## Comandos de la validación

Ejecutados desde `GymFlow_Final/frontend`. Se invocaron los binarios locales
instalados con pnpm; no se instalaron paquetes ni se cambiaron versiones.

```powershell
node node_modules/prettier/bin/prettier.cjs --write <archivos modificados>
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node node_modules/next/dist/bin/next build
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.tools\browsers"
Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue
node node_modules/@playwright/test/cli.js test
node node_modules/@playwright/test/cli.js test --config playwright.live.config.ts
node node_modules/@playwright/test/cli.js test --config playwright.review.config.ts
node scripts/create-review-gallery.mjs
Invoke-RestMethod http://127.0.0.1:5080/health/ready
```

Además: lecturas con `rg`/PowerShell, inspección de trazas Playwright y screenshots.
El wrapper pnpm se interrumpió cuando su comprobación npm no produjo salida; se
utilizaron los mismos ejecutables locales. Una llamada a Prettier mediante `.cmd`
falló por paréntesis en la ruta; la invocación directa con Node funcionó.
Los primeros E2E fallidos se usaron para diagnosticar y corregir los problemas
descritos; los resultados de la tabla corresponden al conjunto final.

## Pendientes y criterio comercial

1. **Login y refresh contra la API real:** no hay credenciales demo recuperables
   en las fuentes revisadas ni variables locales de prueba. No se adivinaron
   claves ni se modificaron cuentas. Configurar solo credenciales verificadas en
   `.env.local` y ejecutar la suite live antes de una demostración autenticada real.
2. **Operación administrativa completa:** membresías/finanzas/accesos necesitan
   resolver MemberId, PlanVersionId y catálogos/consultas de sedes, cajas, medios
   de pago y saldos. No se añadieron acciones incompletas ni IDs manuales.
   [Gaps detallados](INTEGRATION_GAPS.md); cualquier ampliación requiere consulta.
3. **Límites del alcance:** catálogo/inventario solo consulta, agenda sin CRUD,
   membresías solo vencimientos. Sin RPA, Document AI, chatbot, workers Python
   ni integración WhatsApp real.
4. **Sesiones/despliegue:** logout revoca cookies locales; falta endpoint backend
   de revocación. Coordinación entre pestañas depende de Web Locks. HTTPS,
   gestión de claves y rate limit tras proxy se revisarán antes del despliegue.
5. **Cobertura de navegador:** Chromium desktop/móvil emulado; no certificación
   todavía sobre Safari/Firefox o dispositivos físicos. Console errors = 0 en
   el recorrido normal de captura; los errores HTTP provocados forman parte de
   los escenarios negativos.
6. **Warnings:** lint y build sin warnings. Se mantiene la advertencia de
   deprecación npm de ESLint 9 por compatibilidad de los peers documentada en
   [VERSIONS.md](VERSIONS.md); no se forzaron dependencias incompatibles.

Recomendación: revisar comercialmente el Admin ahora con las capturas identificadas
como fixtures, acordar el lenguaje visual y después planificar los contratos que
faltan. **No presentar aún todo el frontend como terminado ni la demo autenticada
real como validada.** Se detiene aquí la expansión a otros roles, según instrucción.
