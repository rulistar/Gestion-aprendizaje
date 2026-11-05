import { healthResponseSchema } from '@aprendizaje/shared';
import { useEffect, useState } from 'react';

type ApiStatus = 'cargando' | 'conectada' | 'sin conexión';

/** Pantalla provisional: solo verifica que web → api → shared estén conectados. */
export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('cargando');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/v1/health', { signal: controller.signal })
      .then((response) => response.json())
      .then((data: unknown) => {
        healthResponseSchema.parse(data);
        setApiStatus('conectada');
      })
      .catch(() => {
        if (!controller.signal.aborted) setApiStatus('sin conexión');
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-4 text-slate-900">
      <h1 className="text-3xl font-bold">Gestor de Aprendizaje</h1>
      <p className="text-slate-600">
        Estado de la API:{' '}
        <span
          className={
            apiStatus === 'conectada'
              ? 'font-semibold text-green-700'
              : apiStatus === 'sin conexión'
                ? 'font-semibold text-red-700'
                : 'font-semibold text-slate-500'
          }
        >
          {apiStatus}
        </span>
      </p>
    </main>
  );
}
