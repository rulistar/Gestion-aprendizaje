import { GraduationCap } from 'lucide-react';
import { useCurrentUser } from '@/lib/auth';

/** Inicio sin espacios de trabajo (quien sí tiene, va directo al primero: lo decide la ruta) */
export function HomePage() {
  const user = useCurrentUser();

  return (
    <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-4 text-center">
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground"
      >
        <GraduationCap className="size-7" />
      </span>
      <h1 className="text-2xl font-bold">Hola, {user.name}</h1>
      <p className="text-muted-foreground">
        Todavía no participas en ningún espacio de trabajo. Pide a un Admin que te invite al suyo.
      </p>
    </div>
  );
}
