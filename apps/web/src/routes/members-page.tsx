import {
  createInvitationRequestSchema,
  INVITATION_TTL_HOURS,
  membershipRoleSchema,
  roleHasPermission,
  type Invitation,
  type Member,
  type MembershipRole,
} from '@aprendizaje/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Check, Copy, MailPlus, UserMinus, X } from 'lucide-react';
import { useState } from 'react';
import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useCurrentUser } from '@/lib/auth';
import {
  invitationLink,
  invitationsQueryOptions,
  useCreateInvitation,
  useRevokeInvitation,
} from '@/lib/invitations';
import { membersQueryOptions, useChangeMemberRole, useRemoveMember } from '@/lib/members';
import { useSchemaForm } from '@/lib/use-schema-form';
import { ROLE_LABELS, workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/miembros');

const ROLES = membershipRoleSchema.options;
const ROLE_HELP: Record<MembershipRole, string> = {
  ADMIN: 'Todo, incluidos miembros, catálogos y tipos',
  MEMBER: 'Crea y cambia elementos',
  VIEWER: 'Solo consulta',
};
const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Miembros del espacio (HU-13). Todo miembro ve quién está; solo el Admin cambia roles, quita
 * miembros e invita. Ocultar botones no es seguridad: la API decide en cada petición.
 */
export function MembersPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: members } = useSuspenseQuery(membersQueryOptions(workspaceId));
  const canManage = roleHasPermission(workspace.role, 'member.manage');

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">Miembros</h1>
        <p className="text-sm text-muted-foreground">
          {canManage
            ? 'Quién trabaja en este espacio y con qué rol. Para sumar a alguien, invítalo con un enlace.'
            : 'Quién trabaja en este espacio y con qué rol.'}
        </p>
      </div>
      {canManage && <InviteCard workspaceId={workspaceId} />}
      <Card>
        <CardHeader>
          <CardTitle>En el espacio</CardTitle>
          <CardDescription>
            {members.length === 1 ? '1 miembro' : `${members.length} miembros`}
            {canManage && '. Debe quedar al menos un Admin.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2">
            {members.map((member) => (
              <MemberRow
                key={member.userId}
                workspaceId={workspaceId}
                member={member}
                canManage={canManage}
              />
            ))}
          </ul>
        </CardContent>
      </Card>
      {canManage && <PendingInvitations workspaceId={workspaceId} />}
    </div>
  );
}

function MemberRow({
  workspaceId,
  member,
  canManage,
}: {
  workspaceId: string;
  member: Member;
  canManage: boolean;
}) {
  const me = useCurrentUser();
  const changeRole = useChangeMemberRole(workspaceId);
  const remove = useRemoveMember(workspaceId, me.id);
  const [confirming, setConfirming] = useState(false);
  const isMe = member.userId === me.id;
  const pending = changeRole.isPending || remove.isPending;
  const error = changeRole.error ?? remove.error;

  function handleRemove() {
    // Si me quité a mí, el hook me lleva al inicio
    remove.mutate(member.userId, { onSuccess: () => setConfirming(false) });
  }

  return (
    <li className="grid gap-2 rounded-md border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid min-w-0 gap-0.5">
          <p className="font-medium break-words">
            {member.name}
            {isMe && <span className="text-muted-foreground"> (tú)</span>}
          </p>
          {member.email && (
            <p className="text-xs break-all text-muted-foreground">{member.email}</p>
          )}
        </div>
        {canManage ? (
          <div className="flex items-center gap-1">
            <Select
              aria-label={`Rol de ${member.name}`}
              value={member.role}
              disabled={pending}
              onChange={(event) => {
                remove.reset();
                changeRole.mutate({
                  userId: member.userId,
                  role: membershipRoleSchema.parse(event.target.value),
                });
              }}
              className="w-32"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Quitar a ${member.name} del espacio`}
              aria-expanded={confirming}
              disabled={pending}
              onClick={() => setConfirming(!confirming)}
            >
              <UserMinus aria-hidden />
            </Button>
          </div>
        ) : (
          <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">
            {ROLE_LABELS[member.role]}
          </span>
        )}
      </div>
      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <p className="text-sm">
            {isMe
              ? '¿Salir de este espacio? Dejarás de verlo; para volver necesitas otra invitación.'
              : `¿Quitar a ${member.name} del espacio? Deja de verlo; lo que capturó se queda.`}
          </p>
          <Button size="sm" variant="destructive" disabled={pending} onClick={handleRemove}>
            {isMe ? 'Salir del espacio' : 'Quitar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </li>
  );
}

/** Invitar: el enlace se muestra una sola vez (en la BD solo queda su hash) */
function InviteCard({ workspaceId }: { workspaceId: string }) {
  const create = useCreateInvitation(workspaceId);
  const [created, setCreated] = useState<{ email: string; link: string } | null>(null);
  const form = useSchemaForm(createInvitationRequestSchema, ['email', 'role'], (data, formEl) =>
    create.mutate(data, {
      onSuccess: ({ invitation, token }) => {
        setCreated({ email: invitation.email, link: invitationLink(token) });
        formEl.reset();
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitar a alguien</CardTitle>
        <CardDescription>
          Se crea un enlace para que lo envíes tú (por correo o mensaje). Sirve una sola vez y
          caduca en {INVITATION_TTL_HOURS} horas.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          onSubmit={form.onSubmit}
          onChange={() => create.reset()}
          noValidate
          className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-start"
        >
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('email')}>Correo</Label>
            <Input
              {...form.field('email')}
              type="email"
              autoComplete="off"
              placeholder="persona@correo.com"
              className="h-11"
            />
            <FieldError {...form.errorProps('email')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('role')}>Rol</Label>
            <Select {...form.field('role')} defaultValue="MEMBER" className="sm:w-40">
              {ROLES.map((role) => (
                <option key={role} value={role} title={ROLE_HELP[role]}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
            <FieldError {...form.errorProps('role')} />
          </div>
          <Button type="submit" disabled={create.isPending} className="h-11 sm:mt-5">
            <MailPlus aria-hidden />
            Crear enlace
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          {ROLES.map((role) => `${ROLE_LABELS[role]}: ${ROLE_HELP[role].toLowerCase()}`).join(
            ' · ',
          )}
          .
        </p>
        {create.error && (
          <p role="alert" className="text-sm text-destructive">
            {create.error.message}
          </p>
        )}
        {created && <CreatedLink {...created} onClose={() => setCreated(null)} />}
      </CardContent>
    </Card>
  );
}

function CreatedLink({
  email,
  link,
  onClose,
}: {
  email: string;
  link: string;
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
      <p className="text-sm">
        Enlace para <strong>{email}</strong>. Cópialo ahora: no se vuelve a mostrar.
      </p>
      <div className="flex gap-2">
        <Input
          aria-label="Enlace de la invitación"
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

function PendingInvitations({ workspaceId }: { workspaceId: string }) {
  const { data: invitations, error } = useQuery(invitationsQueryOptions(workspaceId));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitaciones pendientes</CardTitle>
        <CardDescription>
          Aún no se aceptan. Si alguien perdió su enlace, cancela su invitación y crea otra.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error.message}
          </p>
        ) : !invitations ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>
        ) : (
          <ul className="grid gap-2">
            {invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                workspaceId={workspaceId}
                invitation={invitation}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InvitationRow({
  workspaceId,
  invitation,
}: {
  workspaceId: string;
  invitation: Invitation;
}) {
  const revoke = useRevokeInvitation(workspaceId);

  return (
    <li className="grid gap-1 rounded-md border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid min-w-0 gap-0.5">
          <p className="font-medium break-all">{invitation.email}</p>
          <p className="text-xs text-muted-foreground">
            {ROLE_LABELS[invitation.role]} · caduca el{' '}
            {dateFormat.format(new Date(invitation.expiresAt))}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate(invitation.id)}
        >
          <X aria-hidden />
          Cancelar invitación
        </Button>
      </div>
      {revoke.error && (
        <p role="alert" className="text-sm text-destructive">
          {revoke.error.message}
        </p>
      )}
    </li>
  );
}
