import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { Panel } from "@/shared/components/ui-kit";
import type { SupportWorkspace } from "../../types";
import { invokeSupportAction } from "../../api";
import {
  NONE_VALUE,
  supportErrorMessage as errorMessage,
  useUnsavedWarning,
} from "../editor-helpers";

export function ProductSettingsEditor({ workspace }: { workspace: SupportWorkspace }) {
  const queryClient = useQueryClient();
  const settings = workspace.settings;
  const [form, setForm] = useState({
    brandName: settings.brand_name,
    internalDescription: settings.internal_description ?? "",
    timezone: settings.timezone,
    defaultLanguage: settings.default_language,
    status: settings.status,
    automationEnabled: settings.automation_enabled,
    fallbackQueueId: settings.fallback_queue_id ?? NONE_VALUE,
  });
  const initial = JSON.stringify({
    brandName: settings.brand_name,
    internalDescription: settings.internal_description ?? "",
    timezone: settings.timezone,
    defaultLanguage: settings.default_language,
    status: settings.status,
    automationEnabled: settings.automation_enabled,
    fallbackQueueId: settings.fallback_queue_id ?? NONE_VALUE,
  });
  const dirty = JSON.stringify(form) !== initial;
  useUnsavedWarning(dirty);

  const save = useMutation({
    mutationFn: () =>
      invokeSupportAction({
        action: "save-product-settings",
        productId: workspace.product.id,
        settingsId: settings.id,
        expectedVersion: settings.version,
        brandName: form.brandName.trim(),
        internalDescription: form.internalDescription.trim() || undefined,
        timezone: form.timezone.trim(),
        defaultLanguage: form.defaultLanguage.trim(),
        status: form.status,
        automationEnabled: form.automationEnabled,
        fallbackQueueId: form.fallbackQueueId === NONE_VALUE ? undefined : form.fallbackQueueId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success("Configurações do produto salvas.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Panel
      title="Configurações do produto"
      description="Identidade interna, idioma, timezone, fallback e ativação da automação."
      actions={
        <Button
          size="sm"
          disabled={!dirty || save.isPending || !form.brandName.trim() || !form.timezone.trim()}
          onClick={() => save.mutate()}
        >
          {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          Salvar alterações
        </Button>
      }
    >
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="support-brand-name">Nome da marca</Label>
          <Input
            id="support-brand-name"
            value={form.brandName}
            onChange={(event) =>
              setForm((current) => ({ ...current, brandName: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-status">Status</Label>
          <Select
            value={form.status}
            onValueChange={(value: "active" | "inactive" | "archived") =>
              setForm((current) => ({ ...current, status: value as typeof current.status }))
            }
          >
            <SelectTrigger id="support-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
              <SelectItem value="archived">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-timezone">Timezone</Label>
          <Input
            id="support-timezone"
            value={form.timezone}
            onChange={(event) =>
              setForm((current) => ({ ...current, timezone: event.target.value }))
            }
            placeholder="America/Sao_Paulo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-language">Idioma padrão</Label>
          <Input
            id="support-language"
            value={form.defaultLanguage}
            onChange={(event) =>
              setForm((current) => ({ ...current, defaultLanguage: event.target.value }))
            }
            placeholder="pt-BR"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="support-fallback-queue">Fila de fallback</Label>
          <Select
            value={form.fallbackQueueId}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, fallbackQueueId: value }))
            }
          >
            <SelectTrigger id="support-fallback-queue">
              <SelectValue placeholder="Sem fila" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Sem fila de fallback</SelectItem>
              {workspace.queues.map((queue) => (
                <SelectItem key={queue.id} value={queue.id} disabled={queue.status !== "active"}>
                  {queue.name}
                  {queue.status !== "active" ? " — inativa" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="support-description">Descrição interna</Label>
          <Textarea
            id="support-description"
            value={form.internalDescription}
            onChange={(event) =>
              setForm((current) => ({ ...current, internalDescription: event.target.value }))
            }
            rows={3}
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-sm border p-4 md:col-span-2">
          <div>
            <p className="font-medium">Automação ativa</p>
            <p className="text-sm text-muted-foreground">
              A ativação não publica rascunhos nem configura canais automaticamente.
            </p>
          </div>
          <Switch
            checked={form.automationEnabled}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, automationEnabled: checked }))
            }
          />
        </div>
        {dirty ? (
          <p className="text-sm text-amber-700 md:col-span-2">
            Existem alterações não salvas neste produto.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
