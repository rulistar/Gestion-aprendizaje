import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { elementFiltersSchema } from '@aprendizaje/shared';
import { ApiError } from '@/lib/api';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import { catalogsQueryOptions } from '@/lib/catalogs';
import { nodesQueryOptions } from '@/lib/element-nodes';
import { elementTypesQueryOptions } from '@/lib/element-types';
import { elementQueryOptions, elementsQueryOptions } from '@/lib/elements';
import { membersQueryOptions } from '@/lib/members';
import { trashQueryOptions } from '@/lib/trash';
import { workspaceQueryOptions } from '@/lib/workspaces';
import { AppLayout } from '@/routes/app-layout';
import { CatalogsPage } from '@/routes/catalogs-page';
import { ElementDetailPage } from '@/routes/element-detail-page';
import { ElementNewPage } from '@/routes/element-new-page';
import { ElementTypesPage } from '@/routes/element-types-page';
import { ElementsPage } from '@/routes/elements-page';
import { ErrorPage, NotFoundPage } from '@/routes/error-page';
import { HomePage } from '@/routes/home-page';
import { InvitationPage } from '@/routes/invitation-page';
import { LoginPage } from '@/routes/login-page';
import { MembersPage } from '@/routes/members-page';
import { ProfilePage } from '@/routes/profile-page';
import { TrashPage } from '@/routes/trash-page';
import { WorkspacePage } from '@/routes/workspace-page';

/*
 * Rutas definidas en código:
 *
 *   /                 protegida: lleva al primer espacio; si no hay ninguno, muestra un aviso
 *   /perfil           protegida: mi nombre, correo y contraseña (HU-14)
 *   /w/$workspaceId   protegida: un espacio de trabajo
 *   /w/$workspaceId/catalogos  protegida: los catálogos del espacio (HU-01)
 *   /w/$workspaceId/tipos      protegida: los tipos de elemento del espacio (HU-02)
 *   /w/$workspaceId/elementos[/nuevo|/$elementId]  protegidas: lista con filtros en la URL (HU-05) y ficha (HU-03)
 *   /w/$workspaceId/miembros   protegida: miembros e invitaciones (HU-13)
 *   /login            pública; si ya hay sesión, redirige a /
 *   /invitacion#token pública: aceptar una invitación (HU-13); el token no llega al servidor
 */

/**
 * Si la API responde 401 con una sesión que creíamos activa (expiró por inactividad o se cerró
 * en otro lugar), se olvida al usuario y el router reevalúa la ruta: las protegidas llevan al login.
 */
function handleUnauthorized(error: Error) {
  if (error instanceof ApiError && error.status === 401 && queryClient.getQueryData(meQueryKey)) {
    queryClient.setQueryData(meQueryKey, null);
    void router.invalidate();
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: {
    queries: {
      // Un 4xx no se arregla reintentando (401, 403, 404...); un fallo de red o un 5xx, quizá sí
      retry: (failureCount, error) =>
        failureCount < 2 && !('status' in error && Number(error.status) < 500),
    },
  },
});

/** Solo rutas internas ("/algo"): un enlace "/login?redirect=https://otro-sitio" no saca al usuario */
function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : undefined;
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const target = safeRedirect(search.redirect);
    return target ? { redirect: target } : {};
  },
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.ensureQueryData(meQueryOptions)) {
      redirect({ to: '/', throw: true });
    }
  },
  component: LoginPage,
});

/** Pública con o sin sesión: la página decide (crear cuenta, iniciar sesión o aceptar) */
const invitationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invitacion',
  component: InvitationPage,
});

/** Ruta sin URL propia: protege a sus hijas y les da el marco (menú + barra superior) */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      redirect({ to: '/login', search: { redirect: location.href }, throw: true });
    }
  },
  component: AppLayout,
  errorComponent: ErrorPage,
});

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    const first = user?.workspaces[0];
    if (first) {
      redirect({ to: '/w/$workspaceId', params: { workspaceId: first.id }, throw: true });
    }
  },
  component: HomePage,
});

/** Mi perfil (HU-14): fuera de los espacios; el usuario ya está en caché por la ruta "app" */
const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/perfil',
  component: ProfilePage,
  errorComponent: ErrorPage,
});

const workspaceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId',
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
  component: WorkspacePage,
  errorComponent: ErrorPage,
});

const catalogsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/catalogos',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(catalogsQueryOptions(params.workspaceId)),
    ]),
  component: CatalogsPage,
  errorComponent: ErrorPage,
});

const elementTypesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/tipos',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(elementTypesQueryOptions(params.workspaceId)),
    ]),
  component: ElementTypesPage,
  errorComponent: ErrorPage,
});

const elementsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/elementos',
  validateSearch: elementFiltersSchema,
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(elementsQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(elementTypesQueryOptions(params.workspaceId)),
    ]),
  component: ElementsPage,
  errorComponent: ErrorPage,
});

const elementNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/elementos/nuevo',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(elementTypesQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(catalogsQueryOptions(params.workspaceId)),
    ]),
  component: ElementNewPage,
  errorComponent: ErrorPage,
});

const elementDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/elementos/$elementId',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(
        elementQueryOptions(params.workspaceId, params.elementId),
      ),
      context.queryClient.ensureQueryData(nodesQueryOptions(params.workspaceId, params.elementId)),
      context.queryClient.ensureQueryData(elementTypesQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(catalogsQueryOptions(params.workspaceId)),
    ]),
  component: ElementDetailPage,
  errorComponent: ErrorPage,
});

const trashRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/papelera',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(trashQueryOptions(params.workspaceId)),
    ]),
  component: TrashPage,
  errorComponent: ErrorPage,
});

const membersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/w/$workspaceId/miembros',
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceId)),
      context.queryClient.ensureQueryData(membersQueryOptions(params.workspaceId)),
    ]),
  component: MembersPage,
  errorComponent: ErrorPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  invitationRoute,
  appRoute.addChildren([
    homeRoute,
    profileRoute,
    workspaceRoute,
    catalogsRoute,
    elementTypesRoute,
    elementsRoute,
    elementNewRoute,
    elementDetailRoute,
    trashRoute,
    membersRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Los datos los guarda TanStack Query: el router siempre le pregunta a él
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
