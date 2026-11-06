import { useId, useState, type FormEvent } from 'react';

/** Lo que necesitamos de un esquema Zod (la web no depende de zod directamente) */
interface Schema<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

/**
 * Formulario validado con un esquema de `@aprendizaje/shared` (el mismo que usa la API).
 * Lee los campos con FormData, muestra el primer error de cada campo y llama a `onValid`
 * solo con datos válidos. Los id son únicos aunque haya varios formularios iguales en la página.
 */
export function useSchemaForm<F extends string, T>(
  schema: Schema<T>,
  fields: readonly F[],
  onValid: (data: T, form: HTMLFormElement) => void,
) {
  const prefix = useId();
  const [errors, setErrors] = useState<Partial<Record<F, string>>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const parsed = schema.safeParse(
      Object.fromEntries(fields.map((field) => [field, values.get(field)])),
    );
    if (!parsed.success) {
      const next: Partial<Record<F, string>> = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as F] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onValid(parsed.data, form);
  }

  const idOf = (name: F) => `${prefix}-${name}`;
  const errorIdOf = (name: F) => `${prefix}-${name}-error`;

  /** Props de cada campo: id, name y el enlace accesible con su mensaje de error */
  function field(name: F) {
    return {
      id: idOf(name),
      name,
      'aria-invalid': Boolean(errors[name]),
      'aria-describedby': errors[name] ? errorIdOf(name) : undefined,
    };
  }

  /** Props para <FieldError>: el id que enlaza el campo y su mensaje */
  function errorProps(name: F) {
    return { id: errorIdOf(name), message: errors[name] };
  }

  return { onSubmit, field, idOf, errorProps };
}
