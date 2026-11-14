import { importResultSchema, type Backup } from '@aprendizaje/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

const workspacePath = (workspaceId: string) => `/workspaces/${workspaceId}`;

/** La descarga la pide el navegador con la cookie de sesión y guarda el archivo (HU-06) */
export const exportUrl = (workspaceId: string, format: 'json' | 'csv') =>
  `/api/v1${workspacePath(workspaceId)}/export?format=${format}`;

/** Qué pasaría al importar, sin escribir nada */
export function usePreviewImport(workspaceId: string) {
  return useMutation({
    mutationFn: (backup: Backup) =>
      apiFetch(`${workspacePath(workspaceId)}/import/preview`, {
        method: 'POST',
        body: backup,
        schema: importResultSchema,
      }),
  });
}

/** Importar de verdad: agrega elementos, tipos y valores de catálogo (nunca borra) */
export function useApplyImport(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (backup: Backup) =>
      apiFetch(`${workspacePath(workspaceId)}/import`, {
        method: 'POST',
        body: backup,
        schema: importResultSchema,
      }),
    // Cambian los elementos, los catálogos y los tipos del espacio
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}
