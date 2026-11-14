import {
  CATALOG_LABELS,
  readBackupText,
  roleHasPermission,
  type Backup,
  type ImportResult,
} from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Download, Upload } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { exportUrl, useApplyImport, usePreviewImport } from '@/lib/backup';
import { workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/respaldo');

/** Igual que el tope de la API: un archivo más grande se rechaza antes de leerlo */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Lo que se creará (o se creó) al importar, y lo que se omite */
function ImportSummary({ result }: { result: ImportResult }) {
  const done = result.applied;
  return (
    <div className="grid gap-3 text-sm">
      <p className="font-medium">
        {done ? 'Se importaron' : 'Se importarán'}{' '}
        {plural(result.elements, 'elemento', 'elementos')} con{' '}
        {plural(result.nodes, 'nodo', 'nodos')} de estructura.
      </p>
      {result.newTypes.length > 0 && (
        <p>
          {done ? 'Tipos de elemento nuevos' : 'Se crearán estos tipos de elemento'}:{' '}
          {result.newTypes.join(', ')}.
        </p>
      )}
      {result.newCatalogItems.length > 0 && (
        <div>
          <p>{done ? 'Valores de catálogo nuevos' : 'Se crearán estos valores de catálogo'}:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {result.newCatalogItems.map((item) => (
              <li key={`${item.kind}-${item.name}`}>
                {CATALOG_LABELS[item.kind]}: {item.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.skipped.length > 0 && (
        <div>
          <p>
            {plural(result.skipped.length, 'elemento se omite', 'elementos se omiten')} (no se
            duplica nada):
          </p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {result.skipped.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                {item.name} —{' '}
                {item.reason === 'EXISTS' ? 'ya existe uno igual' : 'se repite en el archivo'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Exportar e importar (HU-06). Exporta cualquier miembro; importa solo el Admin (lo verifica la
 * API). Importar primero muestra qué pasaría y solo escribe cuando se confirma; nunca borra.
 */
export function BackupPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  // Solo oculta botones: quien decide es la API
  const canExport = roleHasPermission(workspace.role, 'data.export');
  const canImport = roleHasPermission(workspace.role, 'data.import');

  const preview = usePreviewImport(workspaceId);
  const apply = useApplyImport(workspaceId);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [fileName, setFileName] = useState('');
  const [readErrors, setReadErrors] = useState<string[]>([]);

  function reset() {
    setBackup(null);
    setFileName('');
    setReadErrors([]);
    preview.reset();
    apply.reset();
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    reset();
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setReadErrors(['El archivo pesa más de 20 MB']);
    } else {
      // El archivo se lee y valida aquí, con las mismas reglas de la API: los errores llegan
      // con su fila antes de enviar nada
      const result = readBackupText(await file.text());
      if (result.ok) {
        setBackup(result.backup);
        preview.mutate(result.backup);
      } else {
        setReadErrors(result.errors);
      }
    }
    // Permite elegir el mismo archivo otra vez después de corregirlo
    input.value = '';
  }

  const applied = apply.data;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">Exportar e importar</h1>
        <p className="text-sm text-muted-foreground">
          Respalda tus elementos o cárgalos desde un archivo.
        </p>
      </div>

      {canExport && (
        <Card>
          <CardHeader>
            <CardTitle>Exportar</CardTitle>
            <CardDescription>
              Todos los elementos del espacio con su estructura. El JSON es el respaldo completo; el
              CSV se abre en Excel y también se puede volver a importar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={exportUrl(workspaceId, 'json')} download>
                <Download aria-hidden />
                Descargar JSON
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={exportUrl(workspaceId, 'csv')} download>
                <Download aria-hidden />
                Descargar CSV para Excel
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Importar</CardTitle>
          <CardDescription>
            {canImport
              ? 'Elige un archivo JSON o CSV de este formato. Primero verás qué pasaría; nada se guarda hasta que confirmes. Importar solo agrega: no borra ni cambia lo que ya tienes, y un elemento con el mismo nombre y tipo se omite.'
              : 'Solo el Admin del espacio puede importar.'}
          </CardDescription>
        </CardHeader>
        {canImport && (
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="backup-file">Archivo de respaldo (.json o .csv)</Label>
              <Input
                id="backup-file"
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={(event) => void handleFile(event)}
              />
            </div>

            {readErrors.length > 0 && (
              <div role="alert" className="grid gap-1 text-sm text-destructive">
                <p className="font-medium">No se pudo leer {fileName}:</p>
                <ul className="list-disc pl-5">
                  {readErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.isPending && <p className="text-sm text-muted-foreground">Revisando…</p>}
            {preview.isError && (
              <p role="alert" className="text-sm text-destructive">
                {preview.error.message}
              </p>
            )}

            {backup && preview.data && !applied && (
              <div className="grid gap-3 rounded-lg border bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Vista previa de {fileName}</p>
                <ImportSummary result={preview.data} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={apply.isPending || preview.data.elements === 0}
                    onClick={() => apply.mutate(backup)}
                  >
                    <Upload aria-hidden />
                    {apply.isPending ? 'Importando…' : 'Importar'}
                  </Button>
                  <Button variant="ghost" onClick={reset} disabled={apply.isPending}>
                    Cancelar
                  </Button>
                </div>
                {preview.data.elements === 0 && (
                  <p className="text-sm text-muted-foreground">No hay nada nuevo que importar.</p>
                )}
                {apply.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {apply.error.message}
                  </p>
                )}
              </div>
            )}

            {applied && (
              <div role="status" className="grid gap-3 rounded-lg border bg-muted/40 p-4">
                <ImportSummary result={applied} />
                <div>
                  <Button variant="outline" onClick={reset}>
                    Importar otro archivo
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
