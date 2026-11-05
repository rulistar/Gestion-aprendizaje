# Sprint 0 — cimientos

- **Fechas:** 2026-11-05 →
- **Objetivo:** dejar el "edificio vacío" listo: monorepo, herramientas de calidad, seguridad HTTP, CI y documentos de gobierno, igual que en Gestor de Proyectos.

## Hecho

- Monorepo con `apps/web`, `apps/api` y `packages/shared`, copiado de Gestor de Proyectos con el ámbito `@aprendizaje/*`.
- `GET /api/v1/health` con su prueba; la web muestra "Estado de la API: conectada".
- Seguridad HTTP desde el día 1: helmet, CORS restringido, límite de peticiones y HTTPS/HSTS en producción, con sus pruebas.
- Variables de entorno validadas con Zod (`config/env.ts`).
- Puertos propios (API 3001, web 5174, PostgreSQL 5433) para correr junto a Gestor de Proyectos.
- Calidad: TypeScript estricto, ESLint, Prettier, Husky + lint-staged.
- CI: formato, lint, tipos, pruebas y build; `pnpm audit` (altas/críticas); gitleaks. Dependabot.
- Documentos: acta, ADR-0001 (stack), ADR-0002 (elementos, propuesto), backlog y `CLAUDE.md`.

## Pendiente del PO

1. Crear el repositorio en GitHub y subir `main`.
2. Proteger `main` con un ruleset: Pull Request + checks del CI en verde.
3. Revisar el acta y el backlog; resolver los "pendientes de definir".

## Notas

- `pnpm audit` reporta 1 vulnerabilidad **moderada** (no bloquea: el CI falla solo con altas o críticas). Se revisará cuando Dependabot proponga la actualización.
