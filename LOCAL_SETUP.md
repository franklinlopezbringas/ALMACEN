# Ejecutar GymFlow en Windows

Configuracion local: SQL Server 2025 Express `.\SQLEXPRESS07`, base `GymFlowDb`,
backend .NET en http://127.0.0.1:5080 y frontend Next.js en http://127.0.0.1:3000.
La conexion a SQL usa autenticacion de Windows. Ejecuta los comandos con el usuario
de Windows que tiene acceso a esa instancia.

Desde `D:\Arlim\ALMACEN`:

```powershell
# Preparar herramientas, base de datos, configuracion y dependencias.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Setup-Local.ps1

# Iniciar ambos servicios en segundo plano.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Start-Local.ps1

# Detener solamente los procesos iniciados por este repositorio.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Stop-Local.ps1
```

Para otra instancia, pasa `-SqlServer '.\NOMBRE_INSTANCIA'` a Setup-Local.ps1
al configurar una copia nueva. Una configuracion existente se conserva: actualiza
`ConnectionStrings__GymFlow` en `backend/.env.local` si cambias de instancia.

Setup instala .NET SDK 10.0.402 y Node.js 24.22.1 dentro de carpetas `.tools`
ignoradas por Git. `frontend/run-pnpm.cmd` utiliza ese Node y pnpm 12.14.0.
No necesitas reemplazar las versiones globales de estas herramientas.

La inicializacion instala los scripts oficiales de `database/`, datos ficticios,
catalogos y los tres parches disponibles. Conserva una base existente con esquema
GymFlow y no vuelve a sembrar datos demo en ella. Los archivos `.env.local` tambien
se conservan. Las claves JWT, de sesion y de cuentas demo se generan localmente.
El backend solo asigna la clave demo a las cuentas ficticias que aun no tienen hash.

El frontend permite `http://127.0.0.1:3000` y `http://localhost:3000` para iniciar
sesion. `APP_ORIGIN` fija el origen principal y `APP_ADDITIONAL_ORIGINS` enumera
otros origenes de confianza separados por comas, con protocolo y puerto exactos.

Los correos y la clave generada estan en `artifacts/local/ACCESOS.md` (ignorado
por Git). Abre http://127.0.0.1:3000/login para ingresar.

Los logs y PID se guardan en `artifacts/local/`. Los servicios permanecen activos
al cerrar la terminal; vuelve a iniciarlos despues de reiniciar Windows.
Los scripts reservan los puertos 5080 y 3000 y no detienen procesos ajenos si
encuentran un puerto ocupado.

Comprobaciones:

```powershell
Invoke-RestMethod http://127.0.0.1:5080/health/ready
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5080/openapi/v1.json

# Backend, incluidas las pruebas existentes que usan SQL Server.
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. ./scripts/Local.Common.ps1
Import-LocalEnvironment "$PWD/backend/.env.local"
$env:GYMFLOW_TEST_CONNECTION = $env:ConnectionStrings__GymFlow
Push-Location backend
& ./.tools/dotnet/dotnet.exe test --solution GymFlow.sln -c Release --no-build --no-restore
Pop-Location

# Frontend.
Push-Location frontend
./run-pnpm.cmd typecheck
./run-pnpm.cmd test
Pop-Location
```

## Validacion local (25 de octubre de 2026)

- SQL Server `17.0.1000.7`: 100 tablas e integridad SQL aprobada.
- .NET SDK `10.0.402`: compilacion Release sin errores ni advertencias;
  53 pruebas aprobadas, incluidas integracion SQL y concurrencia, ninguna omitida.
- Node.js `24.22.1`, pnpm `12.14.0`: dependencias del lockfile instaladas,
  TypeScript y ESLint aprobados, y 55 pruebas de frontend aprobadas.
- Health live/ready y OpenAPI responden correctamente.
- Login real, cookies de sesion y pantalla de los cuatro roles demo verificados.
- Panel de administrador consultando la API real y SQL a traves del frontend.
- Ciclo detener/preparar/iniciar y arranque repetido comprobados.

Evidencia del smoke local: `artifacts/local/verification.json`.
El login se verifico tambien en Edge, completando el formulario, consultando el
panel y recargando la sesion por `localhost` y `127.0.0.1`. Resultado:
`artifacts/local/browser-login-results.json`.
