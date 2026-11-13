import {
  changeMyEmailSchema,
  changeMyPasswordSchema,
  PASSWORD_MIN_LENGTH,
  updateMyNameSchema,
} from '@aprendizaje/shared';
import { useState } from 'react';
import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangeMyEmail, useChangeMyPassword, useCurrentUser, useUpdateMyName } from '@/lib/auth';
import { useSchemaForm } from '@/lib/use-schema-form';

/** Mi perfil (HU-14, como HU-29 de Gestor de Proyectos): nombre, correo y contraseña */
export function ProfilePage() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">
          Tus datos de acceso. Cambiar el correo o la contraseña cierra tu sesión en los demás
          dispositivos.
        </p>
      </div>
      <NameCard />
      <EmailCard />
      <PasswordCard />
    </div>
  );
}

/** Botón de guardar con el error o el aviso de lo que se guardó */
function SubmitRow({
  label,
  pending,
  error,
  notice,
}: {
  label: string;
  pending: boolean;
  error: string | undefined;
  notice: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
      <Button type="submit" disabled={pending}>
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )
      )}
    </div>
  );
}

function NameCard() {
  const user = useCurrentUser();
  const update = useUpdateMyName();
  const [notice, setNotice] = useState<string | null>(null);
  const form = useSchemaForm(updateMyNameSchema, ['name'], (data) =>
    update.mutate(data, { onSuccess: () => setNotice('Nombre guardado') }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nombre</CardTitle>
        <CardDescription>Es como te ven los demás miembros de tus espacios.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.onSubmit} onChange={() => setNotice(null)} noValidate>
          <fieldset disabled={update.isPending} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={form.idOf('name')}>Nombre</Label>
              <Input
                {...form.field('name')}
                defaultValue={user.name}
                maxLength={100}
                autoComplete="name"
              />
              <FieldError {...form.errorProps('name')} />
            </div>
            <SubmitRow
              label="Guardar nombre"
              pending={update.isPending}
              error={update.error?.message}
              notice={notice}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function EmailCard() {
  const user = useCurrentUser();
  const change = useChangeMyEmail();
  const [notice, setNotice] = useState<string | null>(null);
  const form = useSchemaForm(changeMyEmailSchema, ['email', 'currentPassword'], (data, formEl) =>
    change.mutate(data, {
      onSuccess: (updated) => {
        setNotice(`Ahora entras con ${updated.email}`);
        // Solo se limpia la contraseña; el correo nuevo queda escrito
        const password = formEl.elements.namedItem('currentPassword');
        if (password instanceof HTMLInputElement) password.value = '';
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Correo</CardTitle>
        <CardDescription>
          Con él inicias sesión. Se guarda en minúsculas y no puede usarlo otra cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.onSubmit} onChange={() => setNotice(null)} noValidate>
          <fieldset disabled={change.isPending} className="grid gap-4 sm:grid-cols-2">
            <div className="grid content-start gap-2">
              <Label htmlFor={form.idOf('email')}>Correo nuevo</Label>
              <Input
                {...form.field('email')}
                type="email"
                defaultValue={user.email}
                autoComplete="email"
              />
              <FieldError {...form.errorProps('email')} />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={form.idOf('currentPassword')}>Contraseña actual</Label>
              <Input
                {...form.field('currentPassword')}
                type="password"
                autoComplete="current-password"
              />
              <FieldError {...form.errorProps('currentPassword')} />
            </div>
            <SubmitRow
              label="Cambiar correo"
              pending={change.isPending}
              error={change.error?.message}
              notice={notice}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const change = useChangeMyPassword();
  const [notice, setNotice] = useState<string | null>(null);
  const form = useSchemaForm(
    changeMyPasswordSchema,
    ['currentPassword', 'newPassword', 'confirmPassword'],
    (data, formEl) =>
      change.mutate(data, {
        onSuccess: () => {
          setNotice('Contraseña cambiada');
          formEl.reset();
        },
      }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contraseña</CardTitle>
        <CardDescription>
          Mínimo {PASSWORD_MIN_LENGTH} caracteres. Una frase fácil de recordar funciona bien.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.onSubmit} onChange={() => setNotice(null)} noValidate>
          <fieldset disabled={change.isPending} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={form.idOf('currentPassword')}>Contraseña actual</Label>
              <Input
                {...form.field('currentPassword')}
                type="password"
                autoComplete="current-password"
              />
              <FieldError {...form.errorProps('currentPassword')} />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={form.idOf('newPassword')}>Contraseña nueva</Label>
              <Input {...form.field('newPassword')} type="password" autoComplete="new-password" />
              <FieldError {...form.errorProps('newPassword')} />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={form.idOf('confirmPassword')}>Repite la contraseña nueva</Label>
              <Input
                {...form.field('confirmPassword')}
                type="password"
                autoComplete="new-password"
              />
              <FieldError {...form.errorProps('confirmPassword')} />
            </div>
            <SubmitRow
              label="Cambiar contraseña"
              pending={change.isPending}
              error={change.error?.message}
              notice={notice}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
