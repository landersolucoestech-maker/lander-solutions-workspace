import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
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
import type { SupportActionRequest, SupportChannelType } from "../../contracts";
import type { SupportChannel, SupportWorkspace } from "../../types";
import { invokeSupportAction } from "../../api";
import {
  NONE_VALUE,
  supportErrorMessage as errorMessage,
  useUnsavedWarning,
} from "../editor-helpers";

interface ChannelEditorProps {
  workspace: SupportWorkspace;
  record: SupportChannel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChannelEditor({ workspace, record, open, onOpenChange }: ChannelEditorProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    channelType: record?.channel_type ?? "manual",
    name: record?.name ?? "",
    provider: record?.provider ?? "",
    status: record?.status ?? "not_configured",
    externalIdentifier: "",
  });
  const externalProvider = ["email", "whatsapp", "sms"].includes(form.channelType);
  const canActivate = !externalProvider || Boolean(record?.integration_connection_id);

  const save = useMutation({
    mutationFn: () =>
      invokeSupportAction({
        action: "save-channel",
        productId: workspace.product.id,
        id: record?.id,
        expectedVersion: record?.version,
        channelType: form.channelType as SupportChannelType,
        name: form.name.trim(),
        provider: form.provider.trim() || undefined,
        status: form.status as SupportActionRequest<"save-channel">["status"],
        integrationConnectionId: record?.integration_connection_id ?? undefined,
        externalIdentifier: form.externalIdentifier.trim() || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success(record ? "Canal atualizado." : "Canal cadastrado.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{record ? "Editar canal" : "Cadastrar canal"}</DialogTitle>
          <DialogDescription>
            O status ativo somente é permitido quando a integração necessária realmente existe.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (!canActivate && ["configured", "active"].includes(form.status)) {
              toast.error("Configure a integração correspondente antes de ativar este canal.");
              return;
            }
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.channelType}
                disabled={Boolean(record)}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    channelType: value as typeof current.channelType,
                    status: ["email", "whatsapp", "sms"].includes(value)
                      ? "not_configured"
                      : current.status,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="web_chat">Web chat</SelectItem>
                  <SelectItem value="in_app">In-app</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="not_configured">Não configurado</SelectItem>
                  <SelectItem value="disabled">Desativado</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  {canActivate ? (
                    <>
                      <SelectItem value="configured">Configurado</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                    </>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="channel-name">Nome</Label>
              <Input
                id="channel-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-provider">Provedor</Label>
              <Input
                id="channel-provider"
                value={form.provider}
                onChange={(event) =>
                  setForm((current) => ({ ...current, provider: event.target.value }))
                }
                placeholder="Somente quando houver integração real"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-external">Identificador externo</Label>
              <Input
                id="channel-external"
                value={form.externalIdentifier}
                onChange={(event) =>
                  setForm((current) => ({ ...current, externalIdentifier: event.target.value }))
                }
              />
            </div>
          </div>
          {!canActivate ? (
            <Alert>
              <AlertTitle>Integração ausente</AlertTitle>
              <AlertDescription>
                Este canal permanecerá não configurado ou desativado até existir uma conexão real no
                módulo Integrações. Nenhum envio será simulado.
              </AlertDescription>
            </Alert>
          ) : null}
          {record?.last_error ? (
            <Alert variant="destructive">
              <AlertTitle>Último erro do canal</AlertTitle>
              <AlertDescription>{record.last_error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || !form.name.trim()}>
              {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Salvar canal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
