# CLAUDE.md — Gestor de Aprendizaje

Contexto para sesiones de Claude Code. Leer antes de trabajar en el repo.

## Proyecto

Aplicación web para planear y dar seguimiento a lo que se quiere aprender (cursos, lecturas u otros temas): elementos con una estructura de hasta 3 niveles (capítulos, cursos, actividades) y su avance. Generaliza el prototipo "Gestor de cursos". Crece por **módulos**.

- **Ecosistema de tres apps separadas e integradas** (cada una con su repo, BD y despliegue, dueña de sus datos):
  - **Gestor de Proyectos** (`D:\Pr-IA\Gestion-Proyectos`, en producción): recibe de esta app el avance, las fechas y el estado (sincronizados): solo en esa dirección, con la estructura completa y envío automático ([ADR-0004](docs/adr/ADR-0004-integracion-gestor-proyectos.md)).
  - **Gestor de Aprendizaje** (este repo).
  - **Lexika** (futuro): idiomas; se integra con esta app.
- **Mantener la compatibilidad con Gestor de Proyectos**: mismas convenciones (UUID v7, trazabilidad, borrado lógico, fechas `AAAA-MM-DD`, estados) y mismo stack. Ante la duda, revisar su `CLAUDE.md` y sus ADRs, y reutilizar su código probado (sesiones, invitaciones, seguridad).
- Documentos de gobierno: [docs/00-acta-proyecto.md](docs/00-acta-proyecto.md) y [docs/adr/](docs/adr/).
- Metodología: PMI + Scrum (sprints de 2 semanas). **Nada entra sin historia de usuario.**
- El usuario está aprendiendo el stack: explicar el porqué de cada cambio, de forma breve.
- Presupuesto de infraestructura: $0 (capas gratuitas; uso personal).
- Backlog priorizado: [docs/backlog.md](docs/backlog.md) · Sprint actual: [docs/sprints/](docs/sprints/).
- Flujo: el usuario es el Product Owner; una rama + un PR por elemento del backlog. Crea los PR a mano desde el enlace (sin `gh`).

## Decisiones de producto (PO, 2026-11-05)

Detalle en [docs/backlog.md](docs/backlog.md) y [ADR-0002](docs/adr/ADR-0002-elementos-de-aprendizaje.md).

- Acceso como en Gestor de Proyectos: **registro solo por invitación**, espacios y **roles** (Admin, Miembro, Lector), sin la matriz por persona.
- **Tipos de elemento** (Curso, Lectura, Otro…) con **etiquetas propias** por campo.
- Plataforma, patrocinador, categoría, nivel y tipo de actividad: **catálogos editables**.
- Horas totales = semanas × días por semana × horas por día, o capturadas a mano (manda lo capturado).
- Fechas reales automáticas al cambiar el estado, y editables.
- Árbol de hasta 3 niveles: Capítulo, Curso (misma ficha Zod que el elemento) o Actividad; en el nivel 3, solo actividades.

## Stack (ADR-0001)

El mismo de Gestor de Proyectos. Hoy instalado: pnpm 12 + Node 24, React 19 + Vite 7 + Tailwind 4, Fastify 5, Zod 4, Vitest, ESLint/Prettier/Husky, `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, Prisma 7.10 (`@prisma/adapter-pg` + `pg`) + PostgreSQL 17, `argon2` 0.45 (Argon2id, binario nativo), `@fastify/cookie`, TanStack Router y Query, shadcn/ui (copiado a mano, con Radix), `lucide-react`, `@fastify/static` (la API sirve la web en producción; ADR-0003), `@playwright/test` 1.64 (TEC-05: Edge instalado en local, Chromium en el CI), `@vitest/coverage-v8` (cobertura, TEC-06; misma versión que `vitest`: subirlos juntos).

**No agregar dependencias fuera del ADR sin preguntar al usuario.**

### Restricciones de versión (no cambiar sin revisar)

- **Vite 7, no 8**: el binario nativo de rolldown (Vite 8) lo bloquea _Smart App Control_ en la PC del usuario. `@vitejs/plugin-react` en v5. Dependabot ignora esos majors.
- **TypeScript ~6.0**: typescript-eslint 8 exige `typescript <6.1`.
- **`@types/node` en 24.x**, igual que `.nvmrc`. Subirlos juntos.
- **pnpm bloquea scripts de instalación**; los permitidos están en `allowBuilds` de `pnpm-workspace.yaml` (`esbuild`, `prisma`, `@prisma/engines`, `argon2`).

## Puertos locales (distintos a los de Gestor de Proyectos)

API **3001** · web **5174** (proxy de `/api` → 3001) · PostgreSQL **5433** (contenedor `aprendizaje-postgres`).

## Estructura

```
apps/
  web/                React + Vite. Proxy de /api → http://127.0.0.1:3001 en desarrollo
    src/router.tsx      rutas en código (TanStack Router): /login, /invitacion y /restablecer públicas; la ruta "app" protege a sus hijas (/, /perfil, /usuarios, /w/$workspaceId, /w/$workspaceId/catalogos, /w/$workspaceId/tipos, /w/$workspaceId/elementos[/nuevo|/$elementId], /w/$workspaceId/papelera, /w/$workspaceId/miembros).
                        getRouteApi usa el id: "/app/w/..."
    src/lib/api.ts      apiFetch(): llamadas a /api/v1 validadas con esquemas de shared; errores → ApiError
    src/lib/auth.ts     meQueryOptions (GET /auth/me), useCurrentUser, useLogin, useLogout; mi perfil (HU-14)
    src/lib/<mod>.ts    queryOptions + mutaciones de cada módulo; la ruta precarga con loader
    src/lib/use-schema-form.ts  formularios validados con el esquema de shared (FormData + errores por campo)
    src/lib/brand.ts    APP_NAME e initials() para avatares
    src/components/ui/  componentes de shadcn/ui (copiados, sin el CLI; se pueden modificar)
    src/components/app-sidebar.tsx  menú lateral con el combo "Espacio de trabajo"; routes/app-layout.tsx = menú + barra superior
    src/index.css       tema: las mismas variables de color de Gestor de Proyectos y Plus Jakarta Sans
    src/routes/         una página por archivo; leen la ruta con getRouteApi() para no importar router.tsx
                        members-page.tsx: miembros e invitaciones (HU-13); el enlace se muestra una sola vez
                        invitation-page.tsx: /invitacion#<token> (el token va tras "#": no llega al servidor)
                        users-page.tsx: usuarios del sistema (HU-15); password-reset-page.tsx: /restablecer#<token>
                        backup-page.tsx: exportar e importar (HU-06) en /w/$workspaceId/respaldo; lee y valida el archivo aquí (readBackupText), pide la vista previa y solo escribe al confirmar
    src/components/copy-link-box.tsx  enlace de un solo uso para copiar (invitaciones y restablecer contraseña)
  api/                Fastify — monolito modular
    src/app.ts          buildApp(): crea la instancia sin abrir puerto (testeable con app.inject)
    src/server.ts       arranque + cierre ordenado
    src/web/web-app.ts  en producción la API también sirve la web compilada (TEC-04, ADR-0003): misma URL;
                        las rutas de la web devuelven index.html y /api inexistente sigue en 404 JSON
    src/config/env.ts   variables de entorno validadas con Zod
    src/security.ts     helmet, CORS (CORS_ORIGINS), rate limit y HTTPS/HSTS en producción.
                        Rutas sensibles: `config: { rateLimit: authRateLimit }`
    src/modules/<mod>/  un módulo por funcionalidad: <mod>.routes.ts, <mod>.test.ts
      auth/               POST /auth/login, POST /auth/logout, GET /auth/me; password.ts (Argon2id), tokens.ts (token + hash
                          SHA-256), session.ts (sesión en BD, cookie "sid", requireAuth, startSession)
                          profile.*: mi perfil (HU-14): PATCH /auth/me/name, PUT /auth/me/email y /auth/me/password
                          (piden la contraseña actual, límite de intentos, cierran mis demás sesiones)
      users/              usuarios del sistema (HU-15), solo el Admin del sistema: GET /users, PUT /users/:id/email
                          (cierra sus sesiones), PATCH /users/:id/status (desactivar/reactivar; no a sí mismo),
                          POST /users/:id/password-reset = enlace para restablecer la contraseña.
                          password-reset.*: públicas POST /password-resets/preview|complete (un solo uso, 48 h,
                          cierra sus sesiones e inicia sesión)
      workspaces/         GET/POST/PATCH /workspaces[/:id], /:id/members (PATCH rol, DELETE quitar).
                          access.ts: requireMembership / requirePermission (rol); request.membership = mi acceso
      invitations/        GET/POST/DELETE /workspaces/:id/invitations, solo Admin; el token se devuelve una vez.
                          accept.*: públicas, POST /invitations/preview|register|accept
      elements/           fichas (HU-03): GET lista y /:elementId (element.read), POST (element.create), PUT (element.update),
                          DELETE = a la papelera (element.delete, HU-07),
                          con ?today= (día del usuario) para las fechas reales; valida que el tipo y los catálogos sean del espacio
                          nodes.*: estructura (HU-04) bajo /elements/:elementId/nodes: GET (element.read); POST, PUT, POST /:nodeId/move
                          y DELETE con todo lo que contiene (element.update); reglas del árbol en shared
      element-types/      GET /workspaces/:id/element-types (miembros), POST y PATCH /:typeId (catalog.manage): nombre, etiquetas
                          y archivar (queda al menos uno activo); seedElementTypes carga Curso, Lectura y Otro
      catalogs/           GET /workspaces/:id/catalogs (miembros), POST y PATCH /:itemId (catalog.manage): renombrar y
                          archivar, nunca borrar; seedCatalogs carga los valores iniciales al crear un espacio
      trash/              papelera (HU-07): GET /workspaces/:id/trash, POST /trash/:kind/:id/restore (cada quien lo que pudo
                          quitar: trashPermission en shared) y DELETE /trash/:kind/:id = borrar para siempre (trash.manage).
                          Un nodo vuelve con lo que se fue con él (misma fecha de baja); lo quitado antes se queda
      sync/               envío a Gestor de Proyectos (INT-02, ADR-0004). outbox.ts: markChanged(tx, elementId) va en la
                          transacción de TODO cambio de un elemento o sus nodos (incluidos papelera y borrado definitivo).
                          sync.service.ts: syncElement deja Proyectos igual que el estado actual (vínculos en sync_links,
                          huella para no reenviar), processDue (espera 30 s, reintentos 1/5/15 min y cada hora, fallido a
                          las 24 h) y startSyncWorker (lo arranca server.ts solo si están las PROYECTOS_*).
                          proyectos-client.ts: llamadas a su /api/v1 con Bearer, 90 s de espera, 1 llamada cada 2 s.
                          Rutas: GET/POST/DELETE /elements/:id/sync y POST /elements/:id/sync/retry
      backup/             exportar e importar (HU-06): GET /workspaces/:id/export?format=json|csv (data.export: Admin y Miembro) y
                          POST /workspaces/:id/import/preview | /import (data.import: solo Admin). Importar solo agrega y omite lo que ya
                          existe (mismo tipo y nombre); crea los tipos y catálogos que falten; todo en una transacción, con IDs UUID v7
                          generados aquí para insertar con createMany
      setup/              createFirstAdmin: primer Admin + su workspace
    src/cli/            setup-admin.ts → pnpm setup:admin; reset-password.ts → pnpm reset:password (HU-09); prompt.ts = pedir una contraseña sin mostrarla
    src/db/client.ts    createDb(): PrismaClient con el adaptador pg; se inyecta en buildApp({ db }) → app.db
    src/db/audit.ts     auditCreate/auditUpdate/auditSoftDelete/auditRestore + filtro notDeleted
    src/generated/      cliente de Prisma generado (ignorado por Git; se regenera en pnpm install)
    src/test/           BD de pruebas: global-setup (crea + migra), test-db (createTestDb, resetDb).
                        fake-proyectos.ts = receptor de prueba: imita en memoria las rutas de Proyectos (como un fetch).
                        e2e-server.ts = servidor de Playwright (pnpm e2e:serve): BD <DATABASE_URL>_e2e vacía en cada
                        corrida, primer Admin con contraseña de un solo uso, sirve la web compilada en :3101
    prisma/             schema.prisma + migrations/ (versionadas en Git)
    prisma.config.ts    configuración de Prisma 7 (carga el .env de la raíz)
  e2e/                Playwright (TEC-05): playwright.config.ts (arranca e2e-server; en local channel msedge
                        porque Smart App Control bloquea navegadores descargados) y tests/*.spec.ts
packages/
  shared/             esquemas Zod + tipos (z.infer) usados por web y api
    src/schemas/permissions.ts  catálogo de permisos por rol (roleHasPermission)
    src/schemas/catalogs.ts     los cinco catálogos: tipos, etiquetas y valores iniciales
    src/schemas/elements.ts     la ficha (una sola, también para los nodos Curso de HU-04), horas totales y fechas reales automáticas, con pruebas
    src/schemas/progress.ts     avance (ADR-0002 §4): summarizeActivities, elementProgress, nodeProgress, con pruebas
    src/schemas/element-filters.ts  filtros de la lista de elementos (HU-05), en la URL, con pruebas
    src/schemas/trash.ts        papelera (HU-07): trashItemSchema, trashPermission, visibleTrashKinds, con pruebas
    src/schemas/backup.ts       respaldo (HU-06): esquema por nombres, estructura plana con profundidad, CSV para Excel (backupToCsv, csvToBackup,
                                parseCsv) y readBackupText; las reglas del árbol se reutilizan con structureIssues; con pruebas
    src/schemas/sync.ts         integración con Proyectos (INT-02): copia de lo que se usa de su contrato, projectBody/taskBody
                                (qué se envía), phaseMoves (orden de fases) y syncStatusSchema, con pruebas
    src/schemas/element-nodes.ts  árbol de un elemento: clases, reglas de 3 niveles (allowedChildKinds), actividad y buildNodeTree, con pruebas
    src/schemas/element-types.ts  tipos de elemento: campos de la ficha, nombres por omisión y etiquetas propias (HU-02), con pruebas
docs/                 acta, ADRs, backlog, sprints, despliegue.md (Prettier no los reformatea)
render.yaml           Blueprint de Render (TEC-04); primer despliegue, registros, límites y respaldos: docs/despliegue.md
.github/              CI (ci.yml) y Dependabot
docker-compose.yml    PostgreSQL local
```

### Convenciones

- Rutas de la API siempre bajo `/api/v1/...`. Cada módulo se registra en `app.ts` con `prefix: '/api/v1'`.
- Un esquema Zod en `packages/shared` es la fuente de verdad del contrato; el tipo TS se deriva con `z.infer`.
- `@aprendizaje/shared` se resuelve al **código fuente** en desarrollo, tests, typecheck y build de la web mediante la condición de export `@aprendizaje/source`. Solo `node dist/server.js` usa el `dist` compilado.
- Imports relativos en api y shared con extensión `.js` (ESM `NodeNext`). En web no hace falta (`Bundler`).
- Imports de solo tipos: `import type`.
- En la web, los permisos de shared (`roleHasPermission`) solo ocultan botones; quien decide es la API.
- Pruebas junto al código: `*.test.ts`. Probar endpoints con `buildApp({ db }).inject()`, sin red. Las reglas de negocio puras van en `packages/shared` con sus pruebas.
- **Rutas que exigen sesión**: `{ preHandler: requireAuth }` (de `modules/auth/session.ts`); el usuario queda en `request.auth.userId`. Sin sesión válida → 401.
- **Rutas de un workspace** (`/workspaces/:workspaceId/...`): después de `requireAuth`, `{ preHandler: requirePermission('element.create') }` (de `modules/workspaces/access.ts`). No miembro o ID inválido → 404 (no revela que existe); rol sin permiso → 403. Toda consulta filtra también por `workspaceId`.
- **Las pruebas de la API necesitan PostgreSQL** (`pnpm db:up`). Usan una BD aparte, `<DATABASE_URL>_test` (o `TEST_DATABASE_URL`), que `global-setup.ts` crea y migra sola; se niegan a correr contra una BD que no termine en `_test`. Se ejecutan en serie y cada archivo limpia con `resetDb()`. Toda tabla nueva se agrega al TRUNCATE de `test-db.ts`.
- **Cobertura (TEC-06)**: el CI corre `pnpm test:coverage` y falla si `packages/shared` o la API bajan del 70 % en líneas, sentencias, funciones o ramas (objetivo 3 del acta). La tabla queda en el resumen del job (`scripts/coverage-summary.js`). Lo nuevo llega con sus pruebas; no se baja el umbral para hacer pasar algo.
- **Prisma**: toda tabla nueva lleva UUID v7 (`@default(uuid(7)) @db.Uuid`), `@@map`/`@map` en snake_case, `@db.Timestamptz(3)` y campos de trazabilidad con relaciones a `User`. Toda consulta normal incluye `notDeleted`. Índices únicos que deben ignorar la papelera: `@@unique([...], where: { deletedAt: null })`.
- Cambiar el esquema → `pnpm db:migrate` (crea la migración con un nombre descriptivo) → incluir la carpeta de la migración en el commit. Nunca editar una migración ya fusionada en `main`.

## Comandos (desde la raíz)

```bash
pnpm install           # instala todo (también activa los hooks de Husky)
pnpm db:up             # levanta PostgreSQL (requiere .env)
pnpm db:down           # detiene PostgreSQL (los datos persisten en el volumen)
pnpm db:migrate        # crea/aplica migraciones y regenera el cliente de Prisma
pnpm db:studio         # explorador visual de la BD (Prisma Studio)
pnpm db:reset          # ⚠️ borra y recrea la BD de desarrollo aplicando todas las migraciones
pnpm setup:admin       # crea el primer Admin (interactivo; solo si no hay usuarios)
pnpm reset:password    # restablece la contraseña de una cuenta por su correo (interactivo; HU-09)
pnpm dev               # api (:3001) + web (:5174) en paralelo
pnpm test              # Vitest en todos los paquetes (requiere pnpm db:up)
pnpm test:coverage     # lo mismo, con cobertura; falla si shared o la API bajan del 70 % (TEC-06)
pnpm test:e2e          # compila la web y recorre la app en Edge con Playwright (requiere pnpm db:up)
pnpm lint              # ESLint   | pnpm lint:fix
pnpm format            # Prettier | pnpm format:check
pnpm typecheck         # tsc --noEmit en todos los paquetes
pnpm build             # compila shared → api → web
```

Antes de dar una tarea por terminada: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.

## Reglas de seguridad (obligatorias)

1. **Secretos solo en `.env`** (ignorado por Git). Nunca en código, tests, docs ni commits. Toda variable nueva va a `.env.example` con un valor ficticio y a `apps/api/src/config/env.ts` validada con Zod.
2. **Validar toda entrada externa con Zod** (body, query, params, headers, archivos importados, webhooks).
3. **Acceso a datos solo con Prisma** (consultas parametrizadas). Nada de SQL concatenado.
4. **Autorización por rol en el backend, en cada endpoint.** Ocultar botones en la web no es seguridad.
5. **Autenticación**: sesiones en cookie `HttpOnly` + `Secure` + `SameSite`; contraseñas con Argon2. Nunca tokens en `localStorage`.
6. Al exponer la API: helmet, CORS restringido, rate limiting.
7. No registrar en logs contraseñas, tokens, cookies ni datos personales.
8. `main` protegida: todo cambio entra por Pull Request con CI en verde (lint, tipos, pruebas, `pnpm audit` sin altas/críticas, gitleaks sin hallazgos y el recorrido de Playwright).
9. No desactivar hooks (`--no-verify`) ni reglas de lint/TS para "hacer pasar" algo; corregir la causa.
10. Revisar qué hace una dependencia nueva antes de proponerla.

## Definición de Terminado (del acta)

En `main` vía PR · pruebas y linter en verde · escaneo de seguridad sin problemas altos · documentado · funciona en el entorno desplegado.
