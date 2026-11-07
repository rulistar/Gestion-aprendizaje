import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLE_LABELS, workspaceQueryOptions } from '@/lib/workspaces';

// getRouteApi evita importar router.tsx aquí (que a su vez importa esta página)
const route = getRouteApi('/app/w/$workspaceId');

/** Portada del espacio */
export function WorkspacePage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">{workspace.name}</h1>
        <p className="text-sm text-muted-foreground">Tu rol: {ROLE_LABELS[workspace.role]}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <Link
              to="/w/$workspaceId/elementos"
              params={{ workspaceId }}
              className="hover:underline"
            >
              Elementos
            </Link>
          </CardTitle>
          <CardDescription>Tus cursos, lecturas y otros temas.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
