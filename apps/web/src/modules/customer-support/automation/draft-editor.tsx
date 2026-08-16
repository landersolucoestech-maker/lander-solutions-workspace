import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/shared/components/ui/textarea";
import { Panel } from "@/shared/components/ui-kit";
import { invokeSupportAction, publishSupportAutomation, validateSupportAutomation } from "../api";
import type {
  SupportAutomationPreview,
  SupportAutomationSettingsInput,
  SupportRoutingOptionInput,
} from "../contracts";
import { supportErrorMessage as errorMessage } from "../errors";
import type { SupportAutomationVersion, SupportRoutingOption, SupportWorkspace } from "../types";

const NONE_VALUE = "__none__";

type OptionDraft = SupportRoutingOptionInput & { localId: string };

function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

function optionFromRecord(option: SupportRoutingOption, tagIds: string[]): OptionDraft {
  return {
    localId: option.id,
    order: option.display_order,
    title: option.title,
    description: option.description ?? undefined,
    status: option.status,
    categoryId: option.category_id ?? undefined,
    queueId: option.queue_id ?? undefined,
    defaultAssigneeUserId: option.default_assignee_user_id ?? undefined,
    priority: option.priority,
    templateId: option.response_template_id ?? undefined,
    formId: option.form_id ?? undefined,
    actionType: option.action_type,
    actionSettings: option.action_settings,
    tagIds,
  };
}

export function DraftEditor({
  workspace,
  draft,
}: {
  workspace: SupportWorkspace;
  draft: SupportAutomationVersion;
}) {
  const queryClient = useQueryClient();
  const initialOptions = useMemo(
    () =>
      workspace.routingOptions
        .filter((option) => option.automation_version_id === draft.id)
        .map((option) =>
          optionFromRecord(
            option,
            workspace.routingOptionTags
              .filter((item) => item.routing_option_id === option.id)
              .map((item) => item.tag_id),
          ),
        ),
    [draft.id, workspace.routingOptionTags, workspace.routingOptions],
  );
  const initialSettings: SupportAutomationSettingsInput = {
    welcomeMessage: draft.welcome_message ?? undefined,
    invalidOptionMessage: draft.invalid_option_message ?? undefined,
    inactivityMessage: draft.inactivity_message ?? undefined,
    outOfHoursMessage: draft.out_of_hours_message ?? undefined,
    humanHandoffMessage: draft.human_handoff_message ?? undefined,
    closingMessage: draft.closing_message ?? undefined,
    returnCommands: draft.return_commands,
    invalidAttemptLimit: draft.invalid_attempt_limit,
    inactivityMinutes: draft.inactivity_minutes,
    inactivityAction: draft.inactivity_action,
    fallbackQueueId: draft.fallback_queue_id ?? undefined,
    languageCode: draft.language_code,
    timezone: draft.timezone,
    menuRenderMode: draft.menu_render_mode,
    customMenuText: draft.custom_menu_text ?? undefined,
  };
  const [settings, setSettings] = useState(initialSettings);
  const [options, setOptions] = useState<OptionDraft[]>(initialOptions);
  const [preview, setPreview] = useState<SupportAutomationPreview | null>(null);
  const dirty =
    JSON.stringify(settings) !== JSON.stringify(initialSettings) ||
    JSON.stringify(options) !== JSON.stringify(initialOptions);
  useUnsavedWarning(dirty);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["support-workspace", workspace.product.id] });

  const save = useMutation({
    mutationFn: () =>
      invokeSupportAction({
        action: "save-automation-draft",
        versionId: draft.id,
        expectedVersion: draft.version,
        settings,
        options: options.map(({ localId: _localId, ...option }, index) => ({
          ...option,
          order: index + 1,
        })),
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Rascunho salvo.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const validate = useMutation({
    mutationFn: () => validateSupportAutomation(draft.id),
    onSuccess: (result) =>
      result.valid
        ? toast.success("Automação válida para publicação.")
        : toast.error(result.errors.map((item) => item.message).join(" ")),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const publish = useMutation({
    mutationFn: () => publishSupportAutomation(draft.id, draft.version),
    onSuccess: async (result) => {
      if (!result.valid) {
        toast.error(result.errors?.map((item) => item.message).join(" ") || "Automação inválida.");
        return;
      }
      await invalidate();
      toast.success("Automação publicada.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const loadPreview = useMutation({
    mutationFn: () =>
      invokeSupportAction<"preview-automation">({
        action: "preview-automation",
        versionId: draft.id,
      }),
    onSuccess: setPreview,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addOption = () => {
    setOptions((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        order: current.length + 1,
        title: "",
        status: "active",
        priority: "normal",
        actionType: "human_handoff",
        tagIds: [],
      },
    ]);
  };

  const updateOption = (localId: string, patch: Partial<OptionDraft>) =>
    setOptions((current) =>
      current.map((option) => (option.localId === localId ? { ...option, ...patch } : option)),
    );

  return (
    <div className="space-y-4">
      <Panel
        title={`Rascunho v${draft.version_number}`}
        description="Alterações ficam isoladas até validação e publicação."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={loadPreview.isPending || dirty}
              onClick={() => loadPreview.mutate()}
            >
              <Eye className="h-4 w-4" /> Visualizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={validate.isPending || dirty}
              onClick={() => validate.mutate()}
            >
              Validar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar rascunho
            </Button>
            <Button
              size="sm"
              disabled={dirty || publish.isPending}
              onClick={() => publish.mutate()}
            >
              Publicar
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Mensagem de boas-vindas</Label>
            <Textarea
              value={settings.welcomeMessage ?? ""}
              onChange={(event) =>
                setSettings((current) => ({ ...current, welcomeMessage: event.target.value }))
              }
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Mensagem de opção inválida</Label>
            <Textarea
              value={settings.invalidOptionMessage ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  invalidOptionMessage: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Mensagem fora do horário</Label>
            <Textarea
              value={settings.outOfHoursMessage ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  outOfHoursMessage: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Mensagem de inatividade</Label>
            <Textarea
              value={settings.inactivityMessage ?? ""}
              onChange={(event) =>
                setSettings((current) => ({ ...current, inactivityMessage: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Mensagem de transferência humana</Label>
            <Textarea
              value={settings.humanHandoffMessage ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  humanHandoffMessage: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Mensagem de encerramento</Label>
            <Textarea
              value={settings.closingMessage ?? ""}
              onChange={(event) =>
                setSettings((current) => ({ ...current, closingMessage: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Comandos de retorno</Label>
            <Input
              value={settings.returnCommands.join(", ")}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  returnCommands: event.target.value
                    .split(",")
                    .map((item) => item.trim().toLowerCase())
                    .filter(Boolean),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Fila de fallback</Label>
            <Select
              value={settings.fallbackQueueId ?? NONE_VALUE}
              onValueChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  fallbackQueueId: value === NONE_VALUE ? undefined : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sem fallback</SelectItem>
                {workspace.queues.map((queue) => (
                  <SelectItem key={queue.id} value={queue.id} disabled={queue.status !== "active"}>
                    {queue.name}
                    {queue.status !== "active" ? " — inativa" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ação após inatividade</Label>
            <Select
              value={settings.inactivityAction}
              onValueChange={(value: SupportAutomationSettingsInput["inactivityAction"]) =>
                setSettings((current) => ({ ...current, inactivityAction: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="return_to_menu">Voltar ao menu</SelectItem>
                <SelectItem value="human_handoff">Transferir para humano</SelectItem>
                <SelectItem value="close_conversation">Encerrar conversa</SelectItem>
                <SelectItem value="none">Nenhuma</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tempo de inatividade</Label>
            <Input
              type="number"
              min={1}
              max={10080}
              value={settings.inactivityMinutes}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  inactivityMinutes: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Tentativas inválidas</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={settings.invalidAttemptLimit}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  invalidAttemptLimit: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Idioma</Label>
            <Input
              value={settings.languageCode}
              onChange={(event) =>
                setSettings((current) => ({ ...current, languageCode: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input
              value={settings.timezone}
              onChange={(event) =>
                setSettings((current) => ({ ...current, timezone: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Renderização do menu</Label>
            <Select
              value={settings.menuRenderMode}
              onValueChange={(value: "auto_generated" | "custom") =>
                setSettings((current) => ({ ...current, menuRenderMode: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto_generated">Gerado pelas opções</SelectItem>
                <SelectItem value="custom">Texto customizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {settings.menuRenderMode === "custom" ? (
            <div className="space-y-2 md:col-span-2">
              <Label>Texto customizado do menu</Label>
              <Textarea
                value={settings.customMenuText ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, customMenuText: event.target.value }))
                }
              />
            </div>
          ) : null}
          {dirty ? (
            <p className="text-sm text-amber-700 md:col-span-2">
              Salve o rascunho antes de validar, visualizar ou publicar.
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Fluxo de triagem"
        description="O menu numerado é derivado das opções ativas."
        actions={
          <Button size="sm" variant="outline" onClick={addOption}>
            <Plus className="h-4 w-4" /> Adicionar opção
          </Button>
        }
      >
        <div className="space-y-3 p-4">
          {options.length === 0 ? (
            <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma opção configurada.
            </p>
          ) : (
            options.map((option, index) => (
              <div key={option.localId} className="space-y-4 rounded-sm border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Opção {index + 1}</p>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remover opção ${index + 1}`}
                    onClick={() =>
                      setOptions((current) =>
                        current.filter((item) => item.localId !== option.localId),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2 xl:col-span-2">
                    <Label>Título</Label>
                    <Input
                      value={option.title}
                      onChange={(event) =>
                        updateOption(option.localId, { title: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={option.status ?? "active"}
                      onValueChange={(value: "active" | "inactive") =>
                        updateOption(option.localId, { status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="inactive">Inativa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 xl:col-span-3">
                    <Label>Descrição</Label>
                    <Input
                      value={option.description ?? ""}
                      onChange={(event) =>
                        updateOption(option.localId, { description: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ação</Label>
                    <Select
                      value={option.actionType}
                      onValueChange={(value) =>
                        updateOption(option.localId, {
                          actionType: value as SupportRoutingOptionInput["actionType"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "collect_form",
                          "assign_queue",
                          "assign_agent",
                          "create_ticket",
                          "send_template",
                          "close_conversation",
                          "return_to_menu",
                          "human_handoff",
                        ].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select
                      value={option.priority ?? "normal"}
                      onValueChange={(value) =>
                        updateOption(option.localId, {
                          priority: value as SupportRoutingOptionInput["priority"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["low", "normal", "high", "urgent", "critical"].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={option.categoryId ?? NONE_VALUE}
                      onValueChange={(value) =>
                        updateOption(option.localId, {
                          categoryId: value === NONE_VALUE ? undefined : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Sem categoria</SelectItem>
                        {workspace.categories.map((item) => (
                          <SelectItem
                            key={item.id}
                            value={item.id}
                            disabled={item.status !== "active"}
                          >
                            {item.name}
                            {item.status !== "active" ? " — inativa" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fila</Label>
                    <Select
                      value={option.queueId ?? NONE_VALUE}
                      onValueChange={(value) =>
                        updateOption(option.localId, {
                          queueId: value === NONE_VALUE ? undefined : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Sem fila</SelectItem>
                        {workspace.queues.map((item) => (
                          <SelectItem
                            key={item.id}
                            value={item.id}
                            disabled={item.status !== "active"}
                          >
                            {item.name}
                            {item.status !== "active" ? " — inativa" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável padrão</Label>
                    <Select
                      value={option.defaultAssigneeUserId ?? NONE_VALUE}
                      onValueChange={(value) =>
                        updateOption(option.localId, {
                          defaultAssigneeUserId: value === NONE_VALUE ? undefined : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Sem responsável</SelectItem>
                        {workspace.productMembers
                          .filter((member) => member.status === "active")
                          .map((member) => {
                            const profile = workspace.profiles.find(
                              (item) => item.id === member.user_id,
                            );
                            return profile ? (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.displayName}
                              </SelectItem>
                            ) : null;
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Template</Label>
                    <Select
                      value={option.templateId ?? NONE_VALUE}
                      onValueChange={(value) =>
                        updateOption(option.localId, {
                          templateId: value === NONE_VALUE ? undefined : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Sem template</SelectItem>
                        {workspace.templates.map((item) => (
                          <SelectItem
                            key={item.id}
                            value={item.id}
                            disabled={item.status !== "active"}
                          >
                            {item.name}
                            {item.status !== "active" ? " — inativo" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Formulário</Label>
                    <Select
                      value={option.formId ?? NONE_VALUE}
                      onValueChange={(value) =>
                        updateOption(option.localId, {
                          formId: value === NONE_VALUE ? undefined : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Sem formulário</SelectItem>
                        {workspace.forms.map((item) => (
                          <SelectItem
                            key={item.id}
                            value={item.id}
                            disabled={item.status !== "active"}
                          >
                            {item.name}
                            {item.status !== "active" ? " — inativo" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {workspace.tags.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-3 rounded-sm border p-3">
                      {workspace.tags.map((tag) => (
                        <label key={tag.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={(option.tagIds ?? []).includes(tag.id)}
                            disabled={tag.status !== "active"}
                            onCheckedChange={(checked) =>
                              updateOption(option.localId, {
                                tagIds:
                                  checked === true
                                    ? [...new Set([...(option.tagIds ?? []), tag.id])]
                                    : (option.tagIds ?? []).filter((id) => id !== tag.id),
                              })
                            }
                          />
                          {tag.name}
                          {tag.status !== "active" ? " — inativa" : ""}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Panel>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prévia da automação</DialogTitle>
            <DialogDescription>
              A prévia não envia mensagens nem executa escalonamentos.
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-sm border p-4 whitespace-pre-wrap">
                {preview.renderedMenu || "O menu ainda não possui conteúdo renderizável."}
              </div>
              <p>{preview.options.length} opções estruturadas.</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
