# ADR-0001: Stack tecnológico y arquitectura base

- **Estado:** Aceptado
- **Fecha:** 2026-11-05
- **Contexto:** Uso personal, web primero, hosting gratuito, crecimiento por módulos e integración con Gestor de Proyectos y Lexika.

> Un ADR (Architecture Decision Record) registra *qué* decidimos y *por qué*. Si en el futuro cambiamos algo, se crea un ADR nuevo que reemplaza a este; nunca se borra la historia.

## Decisión

**El mismo stack que Gestor de Proyectos** (su ADR-0001), con las mismas versiones y restricciones:

| Capa | Tecnología |
|---|---|
| Monorepo | pnpm workspaces (pnpm 12, Node 24) |
| Frontend | React 19 + Vite 7 + TypeScript + Tailwind CSS 4; después TanStack Router y Query, shadcn/ui |
| Backend | Fastify 5 + TypeScript, monolito modular |
| Validación | Zod 4 compartido en `packages/shared` |
| Base de datos | PostgreSQL 17 (Docker Compose en local) + Prisma 7 |
| Pruebas | Vitest (unitarias + integración contra PostgreSQL real) y Playwright; cobertura con `@vitest/coverage-v8` (TEC-06, aprobado por el PO el 2026-11-08) |
| Calidad | ESLint + typescript-eslint, Prettier, Husky + lint-staged |
| CI | GitHub Actions + gitleaks + pnpm audit + Dependabot |
| Seguridad | `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, Argon2id, sesiones en cookie HttpOnly |

**Por qué el mismo:**
- Lo que ya se aprendió y probó (incluido que funcione con Smart App Control) se reutiliza: sesiones, invitaciones, seguridad, papelera, pruebas.
- Las tres apps del ecosistema hablan el mismo idioma (Zod, OpenAPI, fechas `AAAA-MM-DD`, UUID v7), lo que simplifica la integración.
- Un solo conjunto de herramientas que mantener actualizado.

## Diferencias con Gestor de Proyectos

| Tema | Decisión | Por qué |
|---|---|---|
| Ámbito de los paquetes | `@aprendizaje/*` y condición de export `@aprendizaje/source` | Evita confundir los paquetes de las dos apps |
| Puertos locales | API **3001**, web **5174**, PostgreSQL **5433** | Las dos apps pueden correr al mismo tiempo en la PC para probar la integración |
| Base de datos | Propia (otro contenedor en local, otro proyecto en la nube) | Cada sistema es dueño de sus datos (ADR-0002 §7 de Gestor de Proyectos) |
| Permisos | Roles por espacio (Admin, Miembro, Lector), **sin** la matriz por persona (ADR-0006 de Gestor de Proyectos) | Es lo más complejo y en una app de uso personal aún no hace falta; se puede agregar después |

## Arquitectura

```
Gestion-Aprendizaje/
├── apps/
│   ├── web/        → React (lo que ve el usuario)
│   └── api/        → Fastify (reglas de negocio, seguridad, datos)
│       └── src/modules/   → un módulo por funcionalidad (health, auth, catalogs, items…)
├── packages/
│   └── shared/     → esquemas Zod y tipos usados por web y api
├── docs/           → acta, ADRs, backlog, sprints
└── docker-compose.yml → PostgreSQL local
```

**Integración:** API versionada `/api/v1/...` documentada con OpenAPI; tokens de API por aplicación externa; webhooks firmados con reintentos (patrón outbox). El diseño concreto con Gestor de Proyectos y Lexika va en un ADR propio.

## Restricciones de versión (heredadas)
- **Vite 7, no 8**: el binario de rolldown (Vite 8) lo bloquea Smart App Control.
- **TypeScript ~6.0**: typescript-eslint 8 exige `typescript <6.1`.
- **`@types/node` 24.x**, igual que Node (`.nvmrc`).
- pnpm bloquea los scripts de instalación; solo se autorizan los necesarios en `allowBuilds`.

## Consecuencias
- (+) Arranque rápido: se copia código ya probado en lugar de reescribirlo.
- (+) Integración más simple entre las tres apps.
- (−) El código común (sesiones, seguridad) queda duplicado en dos repos; si se corrige un fallo de seguridad en uno, hay que revisar el otro. Si la duplicación crece, se evaluará un paquete compartido.
