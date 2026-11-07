import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { ApiError } from '@/lib/api';
import { meQueryKey, meQueryOptions } from '@/lib/auth';
import { catalogsQueryOptions } from '@/lib/catalogs';
import { workspaceQueryOptions } from '@/lib/workspaces';
import { AppLayout } from '@/routes/app-layout';
import { CatalogsPage } from '@/routes/catalogs-page';
import { ErrorPage, NotFoundPage } from '@/routes/error-page';
import { HomePage } from '@/routes/home-page';
import { LoginPage } from '@/routes/login-page';
import { WorkspacePage } from '@/routes/workspace-page';

/*
 * Rutas definidas en código:
 *
 *   /                 protegida: lleva al primer espacio; si no hay ninguno, muestra un aviso
 *   /w/$workspaceId   protegida: un espacio de trabajo
 *   /w/$workspaceId/catalogos  protegida: los catálogos del espacio (HU-01)
 *   /login            pública; si ya hay sesión, redirige a /
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

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([homeRoute, workspaceRoute, catalogsRoute]),
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
