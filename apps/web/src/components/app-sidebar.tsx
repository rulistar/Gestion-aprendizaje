import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { roleHasPermission, visibleTrashKinds } from '@aprendizaje/shared';
import {
  BookOpen,
  DatabaseBackup,
  LayoutDashboard,
  Library,
  Shapes,
  Trash2,
  Users,
} from 'lucide-react';
import type { ChangeEvent } from 'react';
import { AppLogo } from '@/components/app-logo';
import { useCurrentUser } from '@/lib/auth';

/** Menú lateral: combo del espacio de trabajo y secciones del espacio elegido */
export function AppSidebar() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  // Las rutas /w/$workspaceId traen el espacio actual; en las demás no hay uno elegido
  const { workspaceId } = useParams({ strict: false });
  const current = user.workspaces.find((workspace) => workspace.id === workspaceId);

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    void navigate({ to: '/w/$workspaceId', params: { workspaceId: event.target.value } });
  }

  return (
    <nav
      aria-label="Menú principal"
      className="flex w-full flex-col gap-5 border-b bg-card px-3.5 py-5 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0"
    >
      <Link to="/" className="px-1.5">
        <AppLogo />
      </Link>

      {user.workspaces.length > 0 && (
        <div className="grid gap-1.5 px-0.5">
          <label
            htmlFor="workspace-switcher"
            className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Espacio de trabajo
          </label>
          <select
            id="workspace-switcher"
            value={current?.id ?? ''}
            onChange={handleChange}
            className="h-11 w-full rounded-md border border-input bg-muted/60 px-3 text-sm font-semibold outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {!current && (
              <option value="" disabled>
                Elige un espacio…
              </option>
            )}
            {user.workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {current && (
        <div className="grid gap-0.5">
          <Link
            to="/w/$workspaceId/elementos"
            params={{ workspaceId: current.id }}
            className="flex min-h-8 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted [&_svg]:size-[18px] [&_svg]:shrink-0"
            activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' }}
          >
            <BookOpen aria-hidden />
            Elementos
          </Link>
          <Link
            to="/w/$workspaceId/tablero"
            params={{ workspaceId: current.id }}
            className="flex min-h-8 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted [&_svg]:size-[18px] [&_svg]:shrink-0"
            activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' }}
          >
            <LayoutDashboard aria-hidden />
            Tablero
          </Link>
          {/* Catálogos y tipos: los ve todo miembro; solo el Admin los cambia (lo verifica la API) */}
          <Link
            to="/w/$workspaceId/catalogos"
            params={{ workspaceId: current.id }}
            className="flex min-h-8 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted [&_svg]:size-[18px] [&_svg]:shrink-0"
            activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' }}
          >
            <Library aria-hidden />
            Catálogos
          </Link>
          <Link
            to="/w/$workspaceId/tipos"
            params={{ workspaceId: current.id }}
            className="flex min-h-8 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted [&_svg]:size-[18px] [&_svg]:shrink-0"
            activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' }}
          >
            <Shapes aria-hidden />
            Tipos de elemento
          </Link>
          {/* Todo miembro ve quién está; solo el Admin cambia roles e invita (HU-13) */}
          <Link
            to="/w/$workspaceId/miembros"
            params={{ workspaceId: current.id }}
            className="flex min-h-8 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted [&_svg]:size-[18px] [&_svg]:shrink-0"
            activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' }}
          >
            <Users aria-hidden />
            Miembros
          </Link>
          {/* Exportar e importar (HU-06): exporta todo miembro con ese permiso; importa solo el Admin */}
          {roleHasPermission(current.role, 'data.export') && (
            <Link
              to="/w/$workspaceId/respaldo"
              params={{ workspaceId: current.id }}
              className="flex min-h-8 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted [&_svg]:size-[18px] [&_svg]:shrink-0"
              activeProps={{
                className: 'bg-accent text-accent-foreground',
                'aria-current': 'page',
              }}
            >
              <DatabaseBackup aria-hidden />
              Exportar e importar
            </Link>
          )}
          {/* La papelera, para quien puede quitar algo (lo verifica la API) */}
          {visibleTrashKinds(current.role).length > 0 && (
            <Link
              to="/w/$workspaceId/papelera"
              params={{ workspaceId: current.id }}
              className="flex min-h-8 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted [&_svg]:size-[18px] [&_svg]:shrink-0"
              activeProps={{
                className: 'bg-accent text-accent-foreground',
                'aria-current': 'page',
              }}
            >
              <Trash2 aria-hidden />
              Papelera
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
