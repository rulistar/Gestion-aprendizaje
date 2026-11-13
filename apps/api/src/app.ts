import cookie from '@fastify/cookie';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Db } from './db/client.js';
import type { WorkspaceAccess } from './modules/workspaces/access.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { profileRoutes } from './modules/auth/profile.routes.js';
import { catalogsRoutes } from './modules/catalogs/catalogs.routes.js';
import { elementTypesRoutes } from './modules/element-types/element-types.routes.js';
import { elementsRoutes } from './modules/elements/elements.routes.js';
import { nodesRoutes } from './modules/elements/nodes.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { acceptInvitationRoutes } from './modules/invitations/accept.routes.js';
import { invitationsRoutes } from './modules/invitations/invitations.routes.js';
import { workspacesRoutes } from './modules/workspaces/workspaces.routes.js';
import { syncRoutes } from './modules/sync/sync.routes.js';
import { trashRoutes } from './modules/trash/trash.routes.js';
import { registerSecurity, type SecurityOptions } from './security.js';
import { registerWebApp } from './web/web-app.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Cliente de base de datos, disponible en rutas y plugins como `app.db` */
    db: Db;
    /** Minutos sin actividad tras los que expira una sesión */
    sessionIdleMinutes: number;
    /** Cookies solo por HTTPS (producción) */
    secureCookies: boolean;
    /** La conexión con Gestor de Proyectos está configurada (INT-02) */
    syncAvailable: boolean;
  }
  interface FastifyRequest {
    /** Sesión del usuario; la rellena `requireAuth` (null en rutas públicas) */
    auth: { userId: string; tokenHash: string } | null;
    /** Acceso en el workspace de la URL; lo rellenan `requireMembership`/`requirePermission` */
    membership: WorkspaceAccess | null;
  }
}

export interface BuildAppOptions extends FastifyServerOptions {
  db: Db;
  security?: SecurityOptions;
  sessionIdleMinutes?: number;
  /** Carpeta de la web compilada (apps/web/dist); si se da, la API también sirve la web (TEC-04) */
  webDist?: string;
  /** Hay conexión con Gestor de Proyectos: se ofrece "Enviar" (INT-02). El envío lo arranca server.ts */
  syncAvailable?: boolean;
}

/**
 * Construye la instancia de Fastify sin abrir un puerto.
 * Separarlo de server.ts permite probar la app con `app.inject()`.
 * La base de datos se recibe desde fuera: quien la crea (server.ts o las pruebas) la cierra.
 */
export function buildApp({
  db,
  security = {},
  sessionIdleMinutes = 60,
  webDist,
  syncAvailable = false,
  ...options
}: BuildAppOptions) {
  const app = Fastify(options);

  app.decorate('db', db);
  app.decorate('sessionIdleMinutes', sessionIdleMinutes);
  app.decorate('secureCookies', security.production ?? false);
  app.decorate('syncAvailable', syncAvailable);
  app.decorateRequest('auth', null);
  app.decorateRequest('membership', null);

  registerSecurity(app, security);
  void app.register(cookie);

  // Cada módulo registra sus rutas bajo el prefijo versionado de la API
  void app.register(healthRoutes, { prefix: '/api/v1' });
  void app.register(authRoutes, { prefix: '/api/v1' });
  void app.register(profileRoutes, { prefix: '/api/v1' });
  void app.register(workspacesRoutes, { prefix: '/api/v1' });
  void app.register(invitationsRoutes, { prefix: '/api/v1' });
  void app.register(acceptInvitationRoutes, { prefix: '/api/v1' });
  void app.register(catalogsRoutes, { prefix: '/api/v1' });
  void app.register(elementTypesRoutes, { prefix: '/api/v1' });
  void app.register(elementsRoutes, { prefix: '/api/v1' });
  void app.register(nodesRoutes, { prefix: '/api/v1' });
  void app.register(trashRoutes, { prefix: '/api/v1' });
  void app.register(syncRoutes, { prefix: '/api/v1' });

  if (webDist) registerWebApp(app, webDist);

  return app;
}
