import {
  proyectosPhaseListSchema,
  proyectosRecordSchema,
  type ProyectosPhase,
  type ProyectosProjectBody,
  type ProyectosTaskBody,
} from '@aprendizaje/shared';
import type { z } from 'zod';
import type { ProyectosConfig } from '../../config/env.js';

/** Proyectos dormida tarda ~1 min en despertar: se espera hasta 90 s (ADR-0004 §2) */
export const TIMEOUT_MS = 90_000;
/** 30 llamadas por minuto como máximo, debajo de las 100 de la API de Proyectos */
export const MIN_INTERVAL_MS = 2_000;

/**
 * Proyectos no respondió o respondió con error. El mensaje se guarda en la bandeja de salida y se
 * muestra en la ficha: nunca lleva el token ni datos de la petición.
 */
export class ProyectosError extends Error {
  constructor(
    message: string,
    /** Código HTTP; null si no hubo respuesta */
    readonly status: number | null,
  ) {
    super(message);
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ProyectosError && error.status === 404;
}

export interface ProyectosClientOptions {
  config: ProyectosConfig;
  /** Para las pruebas: el receptor de prueba en lugar de la red */
  fetch?: typeof fetch;
  minIntervalMs?: number;
  timeoutMs?: number;
}

/**
 * Llamadas a la API /api/v1 de Gestor de Proyectos, en el espacio configurado, como su usuario de
 * servicio (token Bearer; ADR-0004 §4). Cada respuesta se valida con Zod antes de usarla.
 */
export function createProyectosClient({
  config,
  fetch: fetchFn = fetch,
  minIntervalMs = MIN_INTERVAL_MS,
  timeoutMs = TIMEOUT_MS,
}: ProyectosClientOptions) {
  const base = `${config.url}/api/v1/workspaces/${config.workspaceId}`;
  let lastCall = 0;

  async function call(method: string, path: string, body?: unknown): Promise<unknown> {
    // Ritmo: una llamada cada 2 s como máximo; el proceso de envío llama de una en una
    const wait = lastCall + minIntervalMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCall = Date.now();

    let response: Response;
    try {
      response = await fetchFn(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${config.token}`,
          accept: 'application/json',
          ...(body !== undefined && { 'content-type': 'application/json' }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
        // Una redirección podría llevar el token a otro sitio: mejor fallar
        redirect: 'error',
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new ProyectosError(
        timedOut
          ? `Gestor de Proyectos no respondió en ${timeoutMs / 1000} s`
          : 'No se pudo conectar con Gestor de Proyectos',
        null,
      );
    }
    if (!response.ok) {
      throw new ProyectosError(`Gestor de Proyectos respondió ${response.status}`, response.status);
    }
    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch {
      throw new ProyectosError('Gestor de Proyectos respondió algo que no es JSON', null);
    }
  }

  async function parsed<T extends z.ZodType>(schema: T, result: Promise<unknown>) {
    const check = schema.safeParse(await result);
    if (!check.success) {
      throw new ProyectosError('La respuesta de Gestor de Proyectos no es la esperada', null);
    }
    return check.data;
  }

  const id = (value: string) => encodeURIComponent(value);
  const project = (projectId: string) => `/projects/${id(projectId)}`;

  return {
    createProject: (body: ProyectosProjectBody) =>
      parsed(proyectosRecordSchema, call('POST', '/projects', body)),
    updateProject: (projectId: string, body: ProyectosProjectBody) =>
      call('PUT', project(projectId), body),
    deleteProject: (projectId: string) => call('DELETE', project(projectId)),

    listPhases: (projectId: string): Promise<ProyectosPhase[]> =>
      parsed(proyectosPhaseListSchema, call('GET', `${project(projectId)}/phases`)),
    createPhase: (projectId: string, body: { name: string; parentId: string | null }) =>
      parsed(proyectosRecordSchema, call('POST', `${project(projectId)}/phases`, body)),
    renamePhase: (projectId: string, phaseId: string, name: string) =>
      call('PATCH', `${project(projectId)}/phases/${id(phaseId)}`, { name }),
    movePhaseUp: (projectId: string, phaseId: string) =>
      call('POST', `${project(projectId)}/phases/${id(phaseId)}/move`, { direction: 'up' }),
    deletePhase: (projectId: string, phaseId: string) =>
      call('DELETE', `${project(projectId)}/phases/${id(phaseId)}`),

    createTask: (projectId: string, body: ProyectosTaskBody) =>
      parsed(proyectosRecordSchema, call('POST', `${project(projectId)}/tasks`, body)),
    updateTask: (projectId: string, taskId: string, body: ProyectosTaskBody) =>
      call('PUT', `${project(projectId)}/tasks/${id(taskId)}`, body),
    deleteTask: (projectId: string, taskId: string) =>
      call('DELETE', `${project(projectId)}/tasks/${id(taskId)}`),
  };
}

export type ProyectosClient = ReturnType<typeof createProyectosClient>;
