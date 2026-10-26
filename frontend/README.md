# GymFlow · Frontend

Una aplicación Next.js para web pública, autenticación, administrador, recepción,
entrenador y socio. Foundation y Administrador con Integration Patch validado.
UI en español; identidad aprobada conservada. No se inicializó Git ni se publicó
un repositorio. No se inició desarrollo adicional de los demás roles.

Estado, contratos, resultados y pendientes: [informe final del patch](../docs/INTEGRATION_PATCH_REPORT.md).
El frontend completo sigue en desarrollo; este cierre corresponde al alcance local de Admin.

## Ejecutar

Node.js 24 LTS compatible (ver `docs/VERSIONS.md`) y pnpm 12.14.0.
En esta máquina `run-pnpm.cmd` ejecuta la versión fijada de pnpm sin instalación
global. Si ya existe pnpm, se pueden usar directamente los comandos equivalentes.

```powershell
# Desde GymFlow_Final/frontend
.\run-pnpm.cmd install --frozen-lockfile
# Copiar .env.example a .env.local únicamente si aún no existe.
# Configurar API, APP_ORIGIN, SESSION_SECRET y la organización pública.
.\run-pnpm.cmd dev
```

La aplicación usa `http://127.0.0.1:3000`; debe coincidir con APP_ORIGIN.
La API existente se espera en `http://127.0.0.1:5080`. Para iniciarla sin cambiar
usuarios puede usarse `../backend/scripts/Start-Local.ps1` sin opciones de reset
y sin GYMFLOW_DEMO_PASSWORD. El frontend no necesita acceso directo a SQL.

`SESSION_SECRET` debe tener al menos 32 caracteres aleatorios y mantenerse solo
en entorno. La configuración local ya tiene una clave generada y el identificador
público del gimnasio demo. No se guardaron credenciales de usuarios. No sustituir
una `.env.local` existente. En HTTPS usar COOKIE_SECURE=true. Las variables
NEXT_PUBLIC se incorporan al build; recompilar si cambia el gimnasio público.

```powershell
.\run-pnpm.cmd lint
.\run-pnpm.cmd typecheck
.\run-pnpm.cmd test
.\run-pnpm.cmd build
.\run-pnpm.cmd start
```

## E2E

Los E2E de contrato usan un servidor aislado en 5099 y el build Next en 3100;
no tocan GymFlowDb. Sus datos ficticios solo existen dentro de `tests/fixtures`.
Las credenciales del doble son efímeras de cada ejecución y no autentican en .NET.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.tools\browsers"
.\run-pnpm.cmd exec playwright install chromium
.\run-pnpm.cmd test:e2e
```

Build antes de E2E. Las pruebas cubren desktop/móvil, roles, navegación, cookies,
permisos, CSRF, refresh, formulario de socios, búsqueda, paginación y errores.
La evidencia visual de estos E2E utiliza fixtures y no se presenta como datos reales.

```powershell
# Comprobaciones con API real; omite logins sin credenciales locales verificables.
.\run-pnpm.cmd exec playwright test --config playwright.live.config.ts
# Revisión visual aislada, 375/768/1440 px; ejecutar después de la suite funcional.
.\run-pnpm.cmd exec playwright test --config playwright.review.config.ts
node scripts/create-review-gallery.mjs
```

No ejecutar simultáneamente E2E funcional y revisión visual: ambos reservan
5099/3100. La suite real utiliza 3001 y guarda resultados separados; no captura
trazas, vídeos ni screenshots de credenciales reales.

## Documentación

- [Arquitectura, seguridad y design system](docs/ARCHITECTURE.md)
- [Inventario de la API real](docs/API_INVENTORY.md)
- [Gaps y credenciales pendientes](docs/INTEGRATION_GAPS.md)
- [Versiones verificadas y compatibilidad](docs/VERSIONS.md)
- [Resultados de validación](docs/VALIDATION.md)
- [Segunda pasada funcional/comercial del Administrador](docs/ADMIN_COMMERCIAL_PASS_2.md)
- [Capturas para revisión comercial](docs/SCREENSHOTS.md)

El punto de entrega actual es **Recepción + POS para revisión comercial**.
Admin permanece aprobado. El frontend completo no está finalizado y no se inició
la expansión de Entrenador ni Socio.

- [Informe de Recepción + POS](../docs/RECEPTION_PATCH_REPORT.md)
- [Gaps restantes](docs/RECEPTION_GAPS.md)
- [Galería de Recepción: 30 capturas](artifacts/reception-review/index.html)

Las pruebas reales de Recepción requieren preparar el fixture demo local descrito
en el informe. Dejan trazabilidad financiera y consumen stock ficticio; no deben
apuntarse a una base de producción. No crean ni resetean cuentas ni contraseñas.

No se añadieron Redux, otro gestor global, Bootstrap, Material UI ni gráficos
decorativos. Se usan componentes propios con patrones shadcn/ui y primitivas Radix
donde aportan accesibilidad; TanStack Query administra los datos de servidor.
