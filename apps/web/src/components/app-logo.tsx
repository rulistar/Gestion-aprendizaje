import { Check } from 'lucide-react';
import { APP_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

/** Logotipo provisional: marca turquesa + nombre del producto */
export function AppLogo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
      >
        <Check className="size-[18px]" strokeWidth={2.6} />
      </span>
      <span className="text-base font-bold">{APP_NAME}</span>
    </span>
  );
}
