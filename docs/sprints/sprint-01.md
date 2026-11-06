# Sprint 1 — acceso y catálogos

- **Fechas:** 2026-11-05 →
- **Objetivo:** tener base de datos, inicio de sesión, invitaciones, espacios con roles y los catálogos que usarán las fichas.
- **Capacidad:** 21 puntos.

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| TEC-01 | Base de datos: Prisma + PostgreSQL, BD de pruebas, trazabilidad y borrado lógico | 5 | Terminado |
| TEC-02 | Acceso reutilizado de Gestor de Proyectos: primer Admin, sesión, invitaciones, espacios con roles | 8 | Terminado |
| TEC-03 | Web: enrutador, TanStack Query, componentes, menú y pantalla de inicio de sesión | 3 | En revisión |
| HU-01 | Catálogos: plataforma, patrocinador, categoría, nivel y tipo de actividad | 5 | Pendiente |

## Notas

- **TEC-01:** el modelo base (User, Session, Workspace, Membership) es el de Gestor de Proyectos, sin la matriz de permisos por persona (ADR-0001 de este repo). La migración inicial se generó con `prisma migrate diff` y se comprobó que no hay diferencias con el esquema.
- **TEC-02:** reutiliza el código de Gestor de Proyectos, con tres diferencias: el rol decide todos los permisos (sin matriz por persona), una invitación es a un solo espacio y el primer espacio se llama "Mi aprendizaje" (se puede renombrar). Es solo la API. El catálogo de permisos usa `element.*`; la regla de quién puede borrar se revisará en HU-03 y HU-04.
- **TEC-03:** usa el tema y los componentes de Gestor de Proyectos. "Elementos" y "Catálogos" aparecen en el menú como "Pronto" hasta HU-05 y HU-01. Se probó en el navegador: validación, contraseña incorrecta, entrar, salir, ruta protegida y páginas de "no encontrado". Las pruebas automáticas de la web llegan con TEC-05.
