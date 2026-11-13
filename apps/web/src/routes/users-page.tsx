import {
  changeUserEmailSchema,
  PASSWORD_RESET_TTL_HOURS,
  type SystemUser,
} from '@aprendizaje/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { KeyRound, Mail, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { CopyLinkBox } from '@/components/copy-link-box';
import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/lib/auth';
import { useSchemaForm } from '@/lib/use-schema-form';
import {
  passwordResetLink,
  useChangeUserEmail,
  useCreatePasswordReset,
  usersQueryOptions,
  useSetUserStatus,
} from '@/lib/users';
import { ROLE_LABELS } from '@/lib/workspaces';

const dateTimeFormat = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * Usuarios del sistema (HU-15, como HU-30 y HU-54 de Gestor de Proyectos): solo el Admin del
 * sistema. Corrige correos, desactiva o reactiva cuentas y genera enlaces para restablecer
 * contraseñas. El Admin de un espacio no cambia correos: quita al miembro e invita el correcto.
 */
export function UsersPage() {
  const me = useCurrentUser();
  // Solo se pide si es el Admin del sistema (la API también lo exige)
  const { data: users, error } = useQuery({ ...usersQueryOptions, enabled: me.isSystemAdmin });

  if (!me.isSystemAdmin) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Solo para el Admin del sistema</CardTitle>
          <CardDescription>
            Si un correo está mal, el Admin de tu espacio puede quitar al miembro e invitar el
            correo correcto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/" className="text-sm font-medium">
            Volver al inicio
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">Usuarios del sistema</h1>
        <p className="text-sm text-muted-foreground">
          Todas las cuentas. Cambiar el correo o desactivar una cuenta cierra sus sesiones; una
          cuenta desactivada no puede entrar, pero lo que capturó se conserva. Si alguien olvida su
          contraseña, genera un enlace para que cree una nueva.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          ) : !users ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {users.map((user) => (
                <UserRow key={user.id} user={user} isMe={user.id === me.id} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ user, isMe }: { user: SystemUser; isMe: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const setStatus = useSetUserStatus();
  const createReset = useCreatePasswordReset();
  const disabled = user.status === 'DISABLED';
  const error = setStatus.error ?? createReset.error;

  function changeStatus(status: SystemUser['status']) {
    setStatus.mutate({ userId: user.id, status }, { onSuccess: () => setConfirmingDisable(false) });
  }

  function resetPassword() {
    createReset.mutate(user.id, {
      onSuccess: ({ token }) => setResetUrl(passwordResetLink(token)),
    });
  }

  return (
    <li className="grid gap-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={disabled ? 'font-medium text-muted-foreground' : 'font-medium'}>
            {user.name}
            {isMe && <span className="text-muted-foreground"> (tú)</span>}
            {user.isSystemAdmin && (
              <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">
                Admin del sistema
              </span>
            )}
            {disabled && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                Desactivada
              </span>
            )}
          </p>
          <p className="text-sm break-all text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            {user.workspaces.length === 0
              ? 'Sin espacios'
              : user.workspaces.map((w) => `${w.name} (${ROLE_LABELS[w.role]})`).join(' · ')}
            {' · '}
            {user.lastLoginAt
              ? `Último acceso: ${dateTimeFormat.format(new Date(user.lastLoginAt))}`
              : 'Nunca ha entrado'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Mail aria-hidden />
              Cambiar correo
            </Button>
          )}
          {/* Para mí mismo está Mi perfil; una cuenta desactivada primero se reactiva */}
          {!isMe && !disabled && (
            <Button
              size="sm"
              variant="ghost"
              disabled={createReset.isPending}
              onClick={resetPassword}
            >
              <KeyRound aria-hidden />
              Restablecer contraseña
            </Button>
          )}
          {disabled ? (
            <Button
              size="sm"
              variant="outline"
              disabled={setStatus.isPending}
              onClick={() => changeStatus('ACTIVE')}
            >
              <UserCheck aria-hidden />
              Reactivar
            </Button>
          ) : (
            !isMe && (
              <Button
                size="sm"
                variant="outline"
                aria-expanded={confirmingDisable}
                disabled={setStatus.isPending}
                onClick={() => setConfirmingDisable(!confirmingDisable)}
              >
                <UserX aria-hidden />
                Desactivar
              </Button>
            )
          )}
        </div>
      </div>
      {confirmingDisable && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <p className="text-sm">
            ¿Desactivar la cuenta de {user.name}? Se cierran sus sesiones y ya no podrá entrar. Lo
            que capturó se conserva; puedes reactivarla cuando quieras.
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={setStatus.isPending}
            onClick={() => changeStatus('DISABLED')}
          >
            Desactivar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmingDisable(false)}>
            Cancelar
          </Button>
        </div>
      )}
      {editing && <EmailForm user={user} onDone={() => setEditing(false)} />}
      {resetUrl && (
        <CopyLinkBox
          link={resetUrl}
          label={`Enlace para restablecer la contraseña de ${user.name}`}
          onClose={() => setResetUrl(null)}
        >
          Envía este enlace a <strong>{user.name}</strong> para que cree una contraseña nueva.
          Cópialo ahora: no se vuelve a mostrar. Sirve una vez, durante {PASSWORD_RESET_TTL_HOURS}{' '}
          horas; al usarlo se cierran sus sesiones.
        </CopyLinkBox>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </li>
  );
}

function EmailForm({ user, onDone }: { user: SystemUser; onDone: () => void }) {
  const change = useChangeUserEmail();
  const form = useSchemaForm(changeUserEmailSchema, ['email'], (data) =>
    change.mutate({ userId: user.id, ...data }, { onSuccess: onDone }),
  );

  return (
    <form onSubmit={form.onSubmit} noValidate className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          {...form.field('email')}
          aria-label={`Correo nuevo de ${user.name}`}
          type="email"
          defaultValue={user.email}
          autoFocus
          className="h-9 w-72 max-w-full"
        />
        <Button type="submit" size="sm" disabled={change.isPending}>
          {change.isPending ? 'Guardando…' : 'Guardar correo'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Se cierran sus sesiones abiertas.</p>
      <FieldError {...form.errorProps('email')} />
      {change.error && (
        <p role="alert" className="text-sm text-destructive">
          {change.error.message}
        </p>
      )}
    </form>
  );
}
