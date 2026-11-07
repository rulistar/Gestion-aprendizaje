import { Check, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Cambiar un nombre en su propio renglón: catálogos y tipos de elemento */
export function RenameForm({
  name,
  maxLength,
  onRename,
  onCancel,
}: {
  name: string;
  maxLength: number;
  onRename: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === name) {
      onCancel();
      return;
    }
    onRename(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <Input
        aria-label={`Nuevo nombre de ${name}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={maxLength}
        autoFocus
        className="h-8 w-52"
      />
      <Button type="submit" size="sm" variant="ghost" aria-label="Guardar nombre">
        <Check aria-hidden />
      </Button>
      <Button type="button" size="sm" variant="ghost" aria-label="Cancelar" onClick={onCancel}>
        <X aria-hidden />
      </Button>
    </form>
  );
}
