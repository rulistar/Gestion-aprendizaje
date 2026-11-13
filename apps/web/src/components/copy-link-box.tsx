import { Check, Copy, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Enlace de un solo uso para copiarlo y enviarlo (invitaciones, HU-13; restablecer contraseña,
 * HU-15). En la BD solo queda su hash: si se cierra, no se puede volver a ver.
 */
export function CopyLinkBox({
  link,
  label,
  children,
  onClose,
}: {
  link: string;
  /** Nombre accesible del campo con el enlace */
  label: string;
  /** Explicación de para quién es y qué hace */
  children: ReactNode;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Sin permiso para el portapapeles: el enlace sigue a la vista para copiarlo a mano
      setCopied(false);
    }
  }

  return (
    <div role="status" className="grid gap-2 rounded-md border bg-muted/50 p-3">
      <p className="text-sm">{children}</p>
      <div className="flex gap-2">
        <Input
          aria-label={label}
          value={link}
          readOnly
          onFocus={(event) => event.target.select()}
          className="font-mono text-xs"
        />
        <Button type="button" variant="outline" onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button type="button" variant="ghost" aria-label="Cerrar el enlace" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}
