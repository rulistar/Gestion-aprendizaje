# Gestor de Aprendizaje

Aplicación web para planear y dar seguimiento a cursos, lecturas y otros temas de aprendizaje. Se integra con Gestor de Proyectos y, más adelante, con Lexika.

## Requisitos

- Node 24 (`.nvmrc`) y pnpm 12
- Docker Desktop (para PostgreSQL)
- Git

## Primeros pasos

```bash
cp .env.example .env   # y cambia los valores de ejemplo
pnpm install
pnpm db:up             # enciende PostgreSQL
pnpm db:migrate        # aplica las migraciones
pnpm setup:admin       # crea el primer Admin (solo en una instalación vacía)
pnpm dev               # API en http://127.0.0.1:3001, web en http://localhost:5174
```

Abre http://localhost:5174 e inicia sesión con el Admin que creaste.

## Verificar antes de un commit

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e          # recorrido en el navegador (Edge) con Playwright
```

## Documentación

- [Acta del proyecto](docs/00-acta-proyecto.md)
- [Decisiones de arquitectura](docs/adr/)
- [Despliegue](docs/despliegue.md)
- [Backlog](docs/backlog.md) y [sprints](docs/sprints/)
- [CLAUDE.md](CLAUDE.md): contexto y reglas del repo
