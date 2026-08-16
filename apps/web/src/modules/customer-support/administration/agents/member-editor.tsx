import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { SupportAvailabilityStatus, SupportOperationRole } from "../../contracts";
import type { SupportProductMember, SupportWorkspace } from "../../types";
import { invokeSupportAction } from "../../api";
import {
  NONE_VALUE,
  supportErrorMessage as errorMessage,
  useUnsavedWarning,
} from "../editor-helpers";

interface MemberEditorProps {
  workspace: SupportWorkspace;
  record: SupportProductMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberEditor({ workspace, record, open, onOpenChange }: MemberEditorProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    userId: record?.user_id ?? "",
    operationRole: record?.operation_role ?? "agent",
    availabilityStatus: record?.availability_status ?? "offline",
    capacity: String(record?.capacity ?? 5),
    supervisorUserId: record?.supervisor_user_id ?? NONE_VALUE,
    status: record?.status ?? "active",
  });
  const profiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workspace.profiles.filter((profile) => {
      if (profile.status !== "active") return false;
      if (!record && workspace.productMembers.some((member) => member.user_id === profile.id)) {
        return false;
      }
      if (!term) return true;
      return `${profile.displayName} ${profile.email ?? ""}`.toLowerCase().includes(term);
    });
  }, [record, search, workspace.productMembers, workspace.profiles]);
  const supervisorOptions = workspace.productMembers
    .filter((member) => member.status === "active" && member.user_id !== form.userId)
    .map((member) => workspace.profiles.find((profile) => profile.id === member.user_id))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));

  const save = useMutation({
    mutationFn: () =>
      invokeSupportAction({
        action: "save-product-member",
        productId: workspace.product.id,
        id: record?.id,
        expectedVersion: record?.version,
        userId: form.userId,
        operationRole: form.operationRole as SupportOperationRole,
        availabilityStatus: form.availabilityStatus as SupportAvailabilityStatus,
        capacity: Number(form.capacity),
        supervisorUserId: form.supervisorUserId === NONE_VALUE ? undefined : form.supervisorUserId,
        status: form.status as "active" | "inactive",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success(record ? "Agente atualizado." : "Agente vinculado.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Editar agente" : "Vincular agente"}</DialogTitle>
          <DialogDescription>
            Somente usuários ativos do sistema podem ser vinculados ao produto.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          {!record ? (
            <div className="space-y-2">
              <Label htmlFor="member-search">Buscar usuário</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="member-search"
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome ou e-mail"
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Select
              value={form.userId}
              disabled={Boolean(record)}
              onValueChange={(value) => setForm((current) => ({ ...current, userId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {profiles.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    Nenhum usuário elegível
                  </SelectItem>
                ) : (
                  profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.displayName}
                      {profile.email ? ` — ${profile.email}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Função</Label>
              <Select
                value={form.operationRole}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    operationRole: value as typeof current.operationRole,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="manager">Gestor</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agent">Agente</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Disponibilidade</Label>
              <Select
                value={form.availabilityStatus}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    availabilityStatus: value as typeof current.availabilityStatus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="available">Disponível</SelectItem>
                  <SelectItem value="busy">Ocupado</SelectItem>
                  <SelectItem value="away">Ausente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-capacity">Capacidade</Label>
              <Input
                id="member-capacity"
                type="number"
                min={1}
                max={100}
                value={form.capacity}
                onChange={(event) =>
                  setForm((current) => ({ ...current, capacity: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value as typeof current.status }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Supervisor</Label>
            <Select
              value={form.supervisorUserId}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, supervisorUserId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem supervisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sem supervisor</SelectItem>
                {supervisorOptions.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || !form.userId}>
              {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Salvar agente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
