# Revisión visual · Administrador + Integration Patch

Fecha: 2026-10-21. **Datos simulados de pruebas** en las capturas.
La revisión visual usa el servidor aislado; la integración real se verifica por separado.
Las capturas muestran el build de producción conectado al doble de API aislado.
No constituyen evidencia de autenticación real ni cifras comerciales del gimnasio.

[Abrir galería de las 42 capturas](../artifacts/review/index.html).
Las páginas son capturas completas; el diálogo muestra el viewport para representar
correctamente su overlay fijo. Los archivos permanecen bajo `artifacts/`, ignorado.

| Pantalla | 375 px | 768 px | 1440 px |
|---|---|---|---|
| Resumen Admin | [Ver](../artifacts/review/375/admin.png) | [Ver](../artifacts/review/768/admin.png) | [Ver](../artifacts/review/1440/admin.png) |
| Socios | [Ver](../artifacts/review/375/socios.png) | [Ver](../artifacts/review/768/socios.png) | [Ver](../artifacts/review/1440/socios.png) |
| Registrar socio | [Ver](../artifacts/review/375/registro-socio.png) | [Ver](../artifacts/review/768/registro-socio.png) | [Ver](../artifacts/review/1440/registro-socio.png) |
| CRM y seguimientos | [Ver](../artifacts/review/375/crm.png) | [Ver](../artifacts/review/768/crm.png) | [Ver](../artifacts/review/1440/crm.png) |
| Membresías | [Ver](../artifacts/review/375/membresias.png) | [Ver](../artifacts/review/768/membresias.png) | [Ver](../artifacts/review/1440/membresias.png) |
| Clases | [Ver](../artifacts/review/375/clases.png) | [Ver](../artifacts/review/768/clases.png) | [Ver](../artifacts/review/1440/clases.png) |
| Catálogo | [Ver](../artifacts/review/375/catalogo.png) | [Ver](../artifacts/review/768/catalogo.png) | [Ver](../artifacts/review/1440/catalogo.png) |
| Planes | [Ver](../artifacts/review/375/planes.png) | [Ver](../artifacts/review/768/planes.png) | [Ver](../artifacts/review/1440/planes.png) |
| Crear producto | [Ver](../artifacts/review/375/crear-producto.png) | [Ver](../artifacts/review/768/crear-producto.png) | [Ver](../artifacts/review/1440/crear-producto.png) |
| Crear plan | [Ver](../artifacts/review/375/crear-plan.png) | [Ver](../artifacts/review/768/crear-plan.png) | [Ver](../artifacts/review/1440/crear-plan.png) |
| Participantes | [Ver](../artifacts/review/375/participantes.png) | [Ver](../artifacts/review/768/participantes.png) | [Ver](../artifacts/review/1440/participantes.png) |
| Notificaciones | [Ver](../artifacts/review/375/notificaciones.png) | [Ver](../artifacts/review/768/notificaciones.png) | [Ver](../artifacts/review/1440/notificaciones.png) |
| Login | [Ver](../artifacts/review/375/login.png) | [Ver](../artifacts/review/768/login.png) | [Ver](../artifacts/review/1440/login.png) |
| Web pública | [Ver](../artifacts/review/375/publica.png) | [Ver](../artifacts/review/768/publica.png) | [Ver](../artifacts/review/1440/publica.png) |

Socios y CRM usan filas enriquecidas en móvil y cards en tablet, sin scroll
horizontal; en escritorio conservan la tabla. Las otras tablas mantienen
desplazamiento interno cuando lo necesitan. El menú lateral
se convierte en diálogo accesible en móvil/tablet. La revisión automatizada exige
que ninguna página ensanche el viewport y que no existan errores de consola o
excepciones de navegador en los recorridos capturados.

El Administrador está preparado para revisar identidad, jerarquía, navegación,
tablas, formularios y estados. Ver [informe final del Integration Patch](../../docs/INTEGRATION_PATCH_REPORT.md).
No se ha extendido esta revisión a los otros roles.
