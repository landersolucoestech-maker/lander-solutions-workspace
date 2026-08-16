import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2, UserRoundCog } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { EmptyRow, Kpi, PageHeader, Panel, StatusPill, UnitTag } from "@/shared/components/ui-kit";
import {
  assignRole,
  deleteUser,
  hasPermission,
  inviteUser,
  listAccessData,
  revokeRoleAssignment,
  setProfileStatus,
  updateProfile,
} from "@/modules/access-control/api";
import type {
  AccessData,
  AccessProfile,
  AccessRole,
  ProfileStatus,
  RoleAssignment,
} from "@/modules/access-control/types";
import { formatDate } from "@/modules/access-control/format-date";
import { RolePermissionMatrix } from "../components/role-permission-matrix";

export const Route = createFileRoute("/acessos")({
  head: () => ({
    meta: [
      { title: "Acessos e permissões | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "Usuários, papéis, escopo por unidade, exigência de MFA e atribuições persistidas no Supabase.",
      },
      { property: "og:title", content: "Acessos e permissões | Lander Solutions" },
      {
        property: "og:description",
        content: "Controle de acesso por papel e unidade, com MFA, RLS e auditoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type ModalState =
  | { kind: "create" }
  | { kind: "view"; profile: AccessProfile }
  | { kind: "edit"; profile: AccessProfile }
  | { kind: "destroy"; profile: AccessProfile }
  | null;

interface AccessPermissions {
  manageUsers: boolean;
  manageRoles: boolean;
}

function Page() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  const accessQuery = useQuery({
    queryKey: ["access-data"],
    queryFn: listAccessData,
  });

  const permissionsQuery = useQuery({
    queryKey: ["access-page-permissions"],
    queryFn: async (): Promise<AccessPermissions> => {
      const [manageUsers, manageRoles] = await Promise.all([
        hasPermission("access.users.manage"),
        hasPermission("access.roles.manage"),
      ]);
      return { manageUsers, manageRoles };
    },
  });

  const data = accessQuery.data;
  const permissions = permissionsQuery.data ?? { manageUsers: false, manageRoles: false };
  const filteredProfiles = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data.profiles;

    return data.profiles.filter((profile) => {
      const assignments = activeAssignments(data, profile.id);
      const searchable = [
        profile.display_name,
        profile.email ?? "",
        statusLabel(profile.status),
        ...assignments.map((assignment) => roleName(data, assignment.role_id)),
        ...assignments.map((assignment) => assignment.unit_code ?? "global"),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalized);
    });
  }, [data, query]);

  async function refreshData() {
    await queryClient.invalidateQueries({ queryKey: ["access-data"] });
  }

  if (accessQuery.isLoading || permissionsQuery.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" /> Carregando usuários e permissões…
      </div>
    );
  }

  if (accessQuery.isError || permissionsQuery.isError || !data) {
    const error = accessQuery.error ?? permissionsQuery.error;
    return (
      <div className="space-y-4">
        <PageHeader
          title="Acessos e permissões"
          description="Não foi possível consultar os registros protegidos pelo Supabase."
        />
        <Panel title="Falha de autorização ou consulta">
          <div className="space-y-3 p-4">
            <p className="text-sm text-destructive">{errorMessage(error)}</p>
            <Button
              variant="outline"
              onClick={() => {
                void accessQuery.refetch();
                void permissionsQuery.refetch();
              }}
            >
              Tentar novamente
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  const activeUsers = data.profiles.filter((profile) => profile.status === "active");
  const pendingUsers = data.profiles.filter((profile) => profile.status === "pending");
  const mfaRequired = data.profiles.filter((profile) => profile.mfa_required);
  const globalAssignments = data.assignments.filter(
    (assignment) => assignment.status === "active" && assignment.unit_code === null,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acessos e permissões"
        description="Entenda quem possui cada papel, quais ações ele permite e em quais unidades o acesso se aplica. Alterações continuam protegidas por MFA e auditoria."
        actions={
          permissions.manageUsers ? (
            <Button onClick={() => setModal({ kind: "create" })}>
              <Plus /> Criar usuário
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Usuários ativos" value={String(activeUsers.length)} />
        <Kpi
          label="Aguardando ativação"
          value={String(pendingUsers.length)}
          tone={pendingUsers.length > 0 ? "warning" : "neutral"}
        />
        <Kpi
          label="MFA obrigatório"
          value={String(mfaRequired.length)}
          hint="Proteção reforçada (AAL2)"
        />
        <Kpi
          label="Escopos globais"
          value={String(globalAssignments.length)}
          tone={globalAssignments.length > 0 ? "warning" : "neutral"}
          hint="Acesso a todas as unidades"
        />
      </div>

      <Panel
        title="Usuários"
        description="Use as ações para visualizar, editar ou excluir/inativar cada registro."
        actions={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar usuário, papel ou unidade"
            className="h-9 w-full min-w-64 rounded-sm"
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                <th className="px-4 py-2 text-left font-semibold">Usuário</th>
                <th className="px-4 py-2 text-left font-semibold">Situação</th>
                <th className="px-4 py-2 text-left font-semibold">Papéis</th>
                <th className="px-4 py-2 text-left font-semibold">Escopos</th>
                <th className="px-4 py-2 text-left font-semibold">MFA</th>
                <th className="px-4 py-2 text-left font-semibold">Último acesso</th>
                <th className="px-4 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.length === 0 && (
                <EmptyRow colSpan={7} label="Nenhum usuário encontrado para o filtro atual." />
              )}
              {filteredProfiles.map((profile) => {
                const assignments = activeAssignments(data, profile.id);
                return (
                  <tr key={profile.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{profile.display_name || "Nome não informado"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {profile.email ?? profile.id}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={statusLabel(profile.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-72 flex-wrap gap-1">
                        {assignments.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sem papel ativo</span>
                        ) : (
                          assignments.map((assignment) => (
                            <span
                              key={assignment.id}
                              className="rounded-sm border bg-background px-1.5 py-0.5 text-[11px]"
                            >
                              {roleName(data, assignment.role_id)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-64 flex-wrap gap-1">
                        {assignments.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          assignments.map((assignment) => (
                            <UnitTag key={`${assignment.id}-scope`}>
                              {unitLabel(data, assignment.unit_code)}
                            </UnitTag>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={profile.mfa_required ? "obrigatório" : "opcional"} />
                    </td>
                    <td className="num px-4 py-3 text-muted-foreground">
                      {profile.last_seen_at ? formatDate(profile.last_seen_at) : "Nunca"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setModal({ kind: "view", profile })}
                        >
                          <Eye /> Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!permissions.manageUsers && !permissions.manageRoles}
                          onClick={() => setModal({ kind: "edit", profile })}
                        >
                          <Pencil /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!permissions.manageUsers || profile.id === user?.id}
                          onClick={() => setModal({ kind: "destroy", profile })}
                        >
                          <Trash2 /> Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Papéis cadastrados"
        description="Papéis persistidos e quantidade de atribuições ativas."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                <th className="px-4 py-2 text-left font-semibold">Papel</th>
                <th className="px-4 py-2 text-left font-semibold">Código</th>
                <th className="px-4 py-2 text-left font-semibold">Descrição</th>
                <th className="px-4 py-2 text-right font-semibold">Atribuições ativas</th>
              </tr>
            </thead>
            <tbody>
              {data.roles.length === 0 && <EmptyRow colSpan={4} label="Nenhum papel cadastrado." />}
              {data.roles.map((role) => (
                <tr key={role.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{role.name}</td>
                  <td className="num px-4 py-3 text-xs text-muted-foreground">{role.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{role.description ?? "—"}</td>
                  <td className="num px-4 py-3 text-right">
                    {
                      data.assignments.filter(
                        (assignment) =>
                          assignment.role_id === role.id && assignment.status === "active",
                      ).length
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <RolePermissionMatrix data={data} />

      <CreateUserDialog
        open={modal?.kind === "create"}
        onOpenChange={(open) => !open && setModal(null)}
        onSuccess={refreshData}
      />

      <ViewUserDialog
        profile={modal?.kind === "view" ? modal.profile : null}
        data={data}
        onOpenChange={(open) => !open && setModal(null)}
      />

      <EditUserDialog
        profile={modal?.kind === "edit" ? modal.profile : null}
        data={data}
        permissions={permissions}
        currentUserId={user?.id ?? null}
        onOpenChange={(open) => !open && setModal(null)}
        onChanged={refreshData}
      />

      <DestroyUserDialog
        profile={modal?.kind === "destroy" ? modal.profile : null}
        data={data}
        currentUserId={user?.id ?? null}
        onOpenChange={(open) => !open && setModal(null)}
        onChanged={refreshData}
      />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await inviteUser({ displayName, email });
      await onSuccess();
      toast.success("Convite enviado e usuário criado como pendente.");
      setDisplayName("");
      setEmail("");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Criar usuário</DialogTitle>
            <DialogDescription>
              O sistema enviará um convite pelo Supabase Auth. O perfil permanecerá pendente até ser
              ativado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="create-user-name">Nome</Label>
            <Input
              id="create-user-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-user-email">E-mail</Label>
            <Input
              id="create-user-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin" />}
              Criar e enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewUserDialog({
  profile,
  data,
  onOpenChange,
}: {
  profile: AccessProfile | null;
  data: AccessData;
  onOpenChange: (open: boolean) => void;
}) {
  if (!profile) return null;
  const assignments = data.assignments.filter((assignment) => assignment.user_id === profile.id);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ver usuário</DialogTitle>
          <DialogDescription>
            Visualização somente leitura do perfil e das atribuições.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label="Nome" value={profile.display_name || "Não informado"} />
          <ReadOnlyField label="E-mail" value={profile.email ?? "Não informado"} />
          <ReadOnlyField label="Situação" value={statusLabel(profile.status)} />
          <ReadOnlyField label="MFA" value={profile.mfa_required ? "Obrigatório" : "Opcional"} />
          <ReadOnlyField label="Criado em" value={formatDate(profile.created_at)} />
          <ReadOnlyField label="Atualizado em" value={formatDate(profile.updated_at)} />
          <ReadOnlyField label="Versão" value={String(profile.version)} />
          <ReadOnlyField
            label="Último acesso"
            value={profile.last_seen_at ? formatDate(profile.last_seen_at) : "Nunca"}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Atribuições</p>
          {assignments.length === 0 ? (
            <p className="rounded-sm border p-3 text-sm text-muted-foreground">
              Nenhuma atribuição registrada.
            </p>
          ) : (
            <div className="divide-y rounded-sm border">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{roleName(data, assignment.role_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {unitLabel(data, assignment.unit_code)} · {assignment.status}
                    </p>
                  </div>
                  <StatusPill status={assignment.status === "active" ? "ativo" : "revogado"} />
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  profile,
  data,
  permissions,
  currentUserId,
  onOpenChange,
  onChanged,
}: {
  profile: AccessProfile | null;
  data: AccessData;
  permissions: AccessPermissions;
  currentUserId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  if (!profile) return null;
  return (
    <EditUserDialogBody
      key={`${profile.id}-${profile.version}`}
      profile={profile}
      data={data}
      permissions={permissions}
      currentUserId={currentUserId}
      onOpenChange={onOpenChange}
      onChanged={onChanged}
    />
  );
}

function EditUserDialogBody({
  profile,
  data,
  permissions,
  currentUserId,
  onOpenChange,
  onChanged,
}: {
  profile: AccessProfile;
  data: AccessData;
  permissions: AccessPermissions;
  currentUserId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [mfaRequired, setMfaRequired] = useState(profile.mfa_required);
  const [status, setStatus] = useState<Exclude<ProfileStatus, "pending">>(
    profile.status === "pending" ? "active" : profile.status,
  );
  const [statusReason, setStatusReason] = useState("");
  const [roleId, setRoleId] = useState(data.roles[0]?.id ?? "");
  const [unitCode, setUnitCode] = useState("");
  const [revokeReasons, setRevokeReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const assignments = activeAssignments(data, profile.id);

  async function saveProfile() {
    setBusy("profile");
    try {
      await updateProfile({
        id: profile.id,
        displayName,
        mfaRequired,
        expectedVersion: profile.version,
      });
      await onChanged();
      toast.success("Perfil atualizado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function saveStatus() {
    setBusy("status");
    try {
      await setProfileStatus({
        id: profile.id,
        status,
        reason: statusReason,
        expectedVersion: profile.version,
      });
      await onChanged();
      toast.success("Situação do usuário atualizada.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function addAssignment() {
    setBusy("assignment");
    try {
      await assignRole({
        userId: profile.id,
        roleId,
        unitCode: unitCode || null,
      });
      await onChanged();
      toast.success("Papel atribuído ao usuário.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function revokeAssignment(assignment: RoleAssignment) {
    const reason = revokeReasons[assignment.id]?.trim() ?? "";
    setBusy(assignment.id);
    try {
      await revokeRoleAssignment({
        assignmentId: assignment.id,
        expectedVersion: assignment.version,
        reason,
      });
      await onChanged();
      toast.success("Atribuição revogada.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Alterações usam controle de versão. Se outro usuário modificar o registro, a operação
            será bloqueada.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 rounded-sm border p-4">
          <div>
            <h3 className="text-sm font-semibold">Perfil</h3>
            <p className="text-xs text-muted-foreground">Dados básicos e exigência de MFA.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-user-name">Nome</Label>
              <Input
                id="edit-user-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                disabled={!permissions.manageUsers}
                minLength={2}
                maxLength={120}
              />
            </div>
            <ReadOnlyField label="E-mail" value={profile.email ?? "Não informado"} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mfaRequired}
              onChange={(event) => setMfaRequired(event.target.checked)}
              disabled={!permissions.manageUsers}
            />
            Exigir autenticação em duas etapas
          </label>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void saveProfile()}
              disabled={!permissions.manageUsers || busy !== null || displayName.trim().length < 2}
            >
              {busy === "profile" && <LoaderCircle className="animate-spin" />}
              Salvar perfil
            </Button>
          </div>
        </section>

        <section className="space-y-3 rounded-sm border p-4">
          <div>
            <h3 className="text-sm font-semibold">Situação do acesso</h3>
            <p className="text-xs text-muted-foreground">
              Ativação, suspensão e inativação exigem justificativa e ficam registradas na
              auditoria.
            </p>
          </div>
          {profile.id === currentUserId ? (
            <p className="text-sm text-muted-foreground">
              O usuário não pode alterar a própria situação.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-user-status">Nova situação</Label>
                  <select
                    id="edit-user-status"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as Exclude<ProfileStatus, "pending">)
                    }
                    className="h-9 w-full rounded-sm border bg-background px-3 text-sm"
                    disabled={!permissions.manageUsers}
                  >
                    <option value="active">Ativo</option>
                    <option value="suspended">Suspenso</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-user-reason">Justificativa</Label>
                  <Input
                    id="edit-user-reason"
                    value={statusReason}
                    onChange={(event) => setStatusReason(event.target.value)}
                    minLength={5}
                    maxLength={500}
                    disabled={!permissions.manageUsers}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void saveStatus()}
                  disabled={
                    !permissions.manageUsers || busy !== null || statusReason.trim().length < 5
                  }
                >
                  {busy === "status" && <LoaderCircle className="animate-spin" />}
                  Atualizar situação
                </Button>
              </div>
            </>
          )}
        </section>

        <section className="space-y-3 rounded-sm border p-4">
          <div>
            <h3 className="text-sm font-semibold">Papéis e escopos</h3>
            <p className="text-xs text-muted-foreground">
              Papéis globais concedem acesso a todas as unidades. Use o menor escopo necessário.
            </p>
          </div>
          {permissions.manageRoles ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">Papel</Label>
                <select
                  id="edit-user-role"
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  className="h-9 w-full rounded-sm border bg-background px-3 text-sm"
                >
                  {data.roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-unit">Escopo</Label>
                <select
                  id="edit-user-unit"
                  value={unitCode}
                  onChange={(event) => setUnitCode(event.target.value)}
                  className="h-9 w-full rounded-sm border bg-background px-3 text-sm"
                >
                  <option value="">Todas as unidades</option>
                  {data.businessUnits.map((unit) => (
                    <option key={unit.id} value={unit.code}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                className="self-end"
                onClick={() => void addAssignment()}
                disabled={busy !== null || !roleId}
              >
                {busy === "assignment" && <LoaderCircle className="animate-spin" />}
                Atribuir
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Seu papel permite editar o perfil, mas não administrar papéis.
            </p>
          )}

          <div className="divide-y rounded-sm border">
            {assignments.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nenhum papel ativo atribuído.</p>
            ) : (
              assignments.map((assignment) => (
                <div key={assignment.id} className="grid gap-3 p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <p className="text-sm font-medium">{roleName(data, assignment.role_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      Escopo: {unitLabel(data, assignment.unit_code)}
                    </p>
                  </div>
                  <Input
                    value={revokeReasons[assignment.id] ?? ""}
                    onChange={(event) =>
                      setRevokeReasons((current) => ({
                        ...current,
                        [assignment.id]: event.target.value,
                      }))
                    }
                    placeholder="Justificativa para revogar"
                    minLength={5}
                    disabled={!permissions.manageRoles}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void revokeAssignment(assignment)}
                    disabled={
                      !permissions.manageRoles ||
                      busy !== null ||
                      (revokeReasons[assignment.id]?.trim().length ?? 0) < 5
                    }
                  >
                    {busy === assignment.id && <LoaderCircle className="animate-spin" />}
                    Revogar
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DestroyUserDialog({
  profile,
  data,
  currentUserId,
  onOpenChange,
  onChanged,
}: {
  profile: AccessProfile | null;
  data: AccessData;
  currentUserId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  if (!profile) return null;
  return (
    <DestroyUserDialogBody
      key={`${profile.id}-${profile.version}`}
      profile={profile}
      data={data}
      currentUserId={currentUserId}
      onOpenChange={onOpenChange}
      onChanged={onChanged}
    />
  );
}

function DestroyUserDialogBody({
  profile,
  data,
  currentUserId,
  onOpenChange,
  onChanged,
}: {
  profile: AccessProfile;
  data: AccessData;
  currentUserId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const assignments = data.assignments.filter((assignment) => assignment.user_id === profile.id);
  const physicalDeleteAllowed =
    profile.id !== currentUserId &&
    assignments.length === 0 &&
    (profile.status === "pending" || profile.status === "inactive");
  const canInactivate = profile.id !== currentUserId && profile.status !== "inactive";
  const expectedConfirmation = profile.email ?? profile.display_name;
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handlePhysicalDelete() {
    setSubmitting(true);
    try {
      await deleteUser(profile.id);
      await onChanged();
      toast.success("Usuário excluído fisicamente do Supabase Auth.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInactivate() {
    setSubmitting(true);
    try {
      await setProfileStatus({
        id: profile.id,
        status: "inactive",
        reason,
        expectedVersion: profile.version,
      });
      await onChanged();
      toast.success("Usuário inativado; o histórico foi preservado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir usuário</DialogTitle>
          <DialogDescription>
            A ação aplicada depende do histórico e dos vínculos existentes.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">{profile.display_name || profile.email}</p>
          <p className="mt-1 text-muted-foreground">
            {physicalDeleteAllowed
              ? "O usuário não possui atribuições e está pendente ou inativo. A exclusão física é permitida."
              : canInactivate
                ? "O registro possui situação ou histórico que exige preservação. O botão executará uma inativação auditada."
                : "O usuário já está inativo e possui histórico. A exclusão física não é permitida."}
          </p>
        </div>

        {physicalDeleteAllowed && (
          <div className="space-y-2">
            <Label htmlFor="delete-user-confirmation">
              Digite <span className="font-semibold">{expectedConfirmation}</span> para confirmar
            </Label>
            <Input
              id="delete-user-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        {!physicalDeleteAllowed && canInactivate && (
          <div className="space-y-2">
            <Label htmlFor="inactivate-user-reason">Justificativa da inativação</Label>
            <textarea
              id="inactivate-user-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={5}
              maxLength={500}
              className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          {physicalDeleteAllowed && (
            <Button
              type="button"
              variant="destructive"
              disabled={submitting || confirmation !== expectedConfirmation}
              onClick={() => void handlePhysicalDelete()}
            >
              {submitting && <LoaderCircle className="animate-spin" />}
              Excluir definitivamente
            </Button>
          )}
          {!physicalDeleteAllowed && canInactivate && (
            <Button
              type="button"
              variant="destructive"
              disabled={submitting || reason.trim().length < 5}
              onClick={() => void handleInactivate()}
            >
              {submitting && <LoaderCircle className="animate-spin" />}
              Inativar usuário
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border bg-muted/30 p-3">
      <p className="label-caps">{label}</p>
      <p className="mt-1 break-words text-sm">{value}</p>
    </div>
  );
}

function activeAssignments(data: AccessData, userId: string): RoleAssignment[] {
  return data.assignments.filter(
    (assignment) => assignment.user_id === userId && assignment.status === "active",
  );
}

function roleName(data: AccessData, roleId: string): string {
  return data.roles.find((role: AccessRole) => role.id === roleId)?.name ?? "Papel removido";
}

function unitLabel(data: AccessData, unitCode: string | null): string {
  if (!unitCode) return "Todas as unidades";
  return data.businessUnits.find((unit) => unit.code === unitCode)?.name ?? unitCode;
}

function statusLabel(status: ProfileStatus): string {
  return {
    pending: "pendente",
    active: "ativo",
    suspended: "suspenso",
    inactive: "inativo",
  }[status];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "A operação não pôde ser concluída.";
}
