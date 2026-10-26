# GymFlow frontend — fases 0 y 1

Una aplicación Next.js App Router, React y TypeScript strict. Sin Git inicializado,
Redux, aplicaciones separadas, templates administrativos o cambios de DB/backend.
La autorización explícita del usuario para frontend sustituye la restricción
histórica de `../CODEX_EXECUTION.md` que correspondía a la fase DB/backend.

## Rutas y responsabilidades

| Experiencia | Rutas | Estado |
|---|---|---|
| Web pública | `/`, `/planes` | Landing propia, catálogo público real |
| Auth | `/login`, `/sin-acceso` | Formulario validado, errores, redirección por rol |
| Administrador | `/admin`, `/admin/{sección}` | Resumen, socios, CRM, vencimientos, clases, catálogo, planes, notificaciones |
| Recepción | `/recepcion`, `/recepcion/{sección}` | Layout diferenciado; reutiliza vistas habilitadas por permisos; caja/cobros pendientes de contratos |
| Entrenador | `/entrenador`, `/entrenador/clases`, `/entrenador/notificaciones` | Socios asignados y agenda; fundación para seguimiento |
| Socio | `/socio`, `/socio/{clases,catalogo,premios,notificaciones}` | Agenda, reserva propia, catálogo, saldo/premios y mensajes propios |

`src/app` contiene rutas, layouts, límites de error y Route Handlers.
`src/features` contiene los casos de uso y sus vistas; `src/components/ui` los
componentes propios siguiendo la composición de shadcn/ui (Button con CVA/Slot,
Dialog con Radix), sin instalar un template. `src/lib/api` contiene contratos,
adaptadores y transporte; `src/lib/auth` sesiones y reglas de navegación.

## Datos

Todos los fetch están centralizados en `src/lib/api/client.ts` (navegador) o
`src/lib/api/server.ts` (servidor). Los componentes consumen `gymflow` y TanStack
Query. Las claves incluyen organización y, cuando corresponde, usuario y página.
Las mutaciones invalidan los datos relacionados y no se reintentan automáticamente.
Cerrar sesión limpia QueryClient. No se persisten datos privados en localStorage.

OpenAPI real se guarda en `docs/openapi.json`; `api:generate` genera
`src/lib/api/generated.ts`. Los contratos de entrada usan los tipos generados.
Zod valida los contratos de lectura y normaliza números que OpenAPI admite como
`number|string`. Las respuestas que OpenAPI omite se verificaron contra los
records C# existentes, sin modificarlos.

## Autenticación y autorización

El navegador usa exclusivamente el origen Next.js. Sus Route Handlers son la
capa de adaptación de esta misma aplicación; la API .NET sigue siendo la fuente
de autorización y reglas de negocio. No se creó otro servicio ni se habilitó CORS.

Los tokens emitidos por .NET se cifran con AES-256-GCM y una clave de entorno del
frontend; se guardan en cookies HttpOnly, SameSite=Lax y Secure por defecto. En
HTTP local se configura explícitamente COOKIE_SECURE=false. El access token se
divide en dos cookies si es necesario para respetar el límite por cookie; el
tag autentica el contenido completo y el propósito de cada cookie. Los tokens
nunca se devuelven en el JSON al navegador. Las credenciales solo viajan al login.

El frontend interpreta los claims únicamente después de descifrar una cookie
autenticada creada a partir de una respuesta de la API. .NET verifica la firma
JWT y los permisos en cada operación; el frontend no recibe la clave JWT del backend.
Los layouts y páginas exigen su rol en el servidor, y cada sección exige su permiso.
Los menús son una ayuda de navegación, no el control de seguridad único.

Un 401 inicia refresh de un solo uso, compartido entre las peticiones concurrentes
de una pestaña. Web Locks coordina pestañas y vuelve a comprobar la caducidad
antes de rotar. Solo se repite la petición una vez y solo después de un 401; no se
repite un pago o una mutación tras fallos ambiguos. Sin Web Locks queda la
coordinación por pestaña; se documenta la limitación de múltiples pestañas en esos
navegadores. Una sesión irrecuperable redirige al login y vacía la caché.

Las operaciones POST exigen un Origin idéntico a APP_ORIGIN. El proxy permite
solo rutas/métodos declarados, limita cuerpos, usa un host fijo de entorno, un
timeout y `no-store`. No admite un destino arbitrario. No se registran passwords
ni tokens. El cierre de sesión borra las cookies locales; la revocación del
refresh en servidor necesita un endpoint de backend que hoy no existe.

## Diseño y accesibilidad

Identidad original: fondo cálido claro, verde profundo #172e24, primario #28624b,
lima #d4f588 y Manrope variable hospedada localmente. No se descargan fuentes al
compilar ni al navegar. Tokens compartidos en `globals.css`, tarjetas con bordes
suaves y jerarquía tipográfica; Lucide aporta iconografía consistente.

Sidebar persistente en escritorio; menú modal accesible en móvil. Radix gestiona
foco, Escape y cierre de diálogos. Etiquetas, errores asociados a campos, mensajes
de estado, skip link, foco visible y reduced-motion forman parte de la base.
Las tablas se desplazan dentro de su contenedor, sin desbordar la página.

No hay gráficos decorativos ni indicadores de crecimiento inventados. Recharts
se difiere hasta disponer de un endpoint histórico que permita un gráfico útil.
Los estados vacíos, errores y acciones sin permiso son explícitos. No se muestran
botones que simulen editar planes, realizar pagos o modificar inventario.
