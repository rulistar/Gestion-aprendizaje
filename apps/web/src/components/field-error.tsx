/** Mensaje de error bajo un campo; el campo lo enlaza con aria-describedby */
export function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  return (
    message && (
      <p id={id} className="text-sm text-destructive">
        {message}
      </p>
    )
  );
}
