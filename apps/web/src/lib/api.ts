/** Error de la API con su código HTTP (401 sin sesión, 429 demasiados intentos...) */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ApiOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Esquema de `@aprendizaje/shared` que valida la respuesta: no se confía a ciegas en lo que llega */
  schema?: { parse(data: unknown): T };
}

/**
 * Llamada a la API (`/api/v1/...`). La cookie de sesión viaja sola: es del mismo origen
 * (en desarrollo, gracias al proxy de Vite) y JavaScript nunca la toca.
 */
export async function apiFetch<T = void>(path: string, options: ApiOptions<T> = {}): Promise<T> {
  const { method = 'GET', body, schema } = options;
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
    const message = typeof data?.message === 'string' ? data.message : 'Error inesperado';
    throw new ApiError(response.status, message);
  }

  if (!schema || response.status === 204) return undefined as T;
  return schema.parse(await response.json());
}
