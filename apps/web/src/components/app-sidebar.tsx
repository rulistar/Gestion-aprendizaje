import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { BookOpen, Library, Shapes, type LucideIcon } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { AppLogo } from '@/components/app-logo';
import { useCurrentUser } from '@/lib/auth';

/** Opción que llega en una historia posterior: se ve, pero aún no se puede usar */
function SoonItem({
  icon: Icon,
  label,
  story,
}: {
  icon: LucideIcon;
  label: string;
  story: string;
}) {
  return (
    <span
      aria-disabled="true"
      title={`Llega con ${story}`}
      className="flex min-h-8 cursor-default items-center gap-2.5 rounded-lg px-3 text-sm font-medium opacity-60 [&_svg]:size-[18px] [&_svg]:shrink-0"
    >
      <Icon aria-hidden />
      {label}
      <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        Pronto
      </span>
    </span>
  );
}

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
          <SoonItem icon={BookOpen} label="Elementos" story="HU-05" />
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
        </div>
      )}
    </nav>
  );
}
