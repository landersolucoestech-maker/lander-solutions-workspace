import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
import { Switch } from "@/shared/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";
import { Panel, StatusPill } from "@/shared/components/ui-kit";
import { invokeSupportAction } from "../../api";
import type {
  SupportActionRequest,
  SupportEscalationEvent,
  SupportFormFieldInput,
  SupportFormFieldType,
  SupportNotificationChannel,
  SupportTicketStatus,
} from "../../contracts";
import type {
  SupportBusinessHours,
  SupportForm,
  SupportSlaPolicy,
  SupportTemplate,
  SupportWorkspace,
} from "../../types";
import { NONE_VALUE, supportErrorMessage as errorMessage } from "../editor-helpers";
import type { SupportEditorProps } from "../editor-types";

type FieldDraft = SupportFormFieldInput & { localId: string };

export function FormEditor({
  workspace,
  record,
  open,
  onOpenChange,
}: SupportEditorProps<SupportForm>) {
  const queryClient = useQueryClient();
  const existingFields = record
    ? workspace.formFields.filter((field) => field.form_id === record.id)
    : [];
  const [form, setForm] = useState({
    code: record?.code ?? "",
    name: record?.name ?? "",
    description: record?.description ?? "",
    status: record?.status ?? "draft",
  });
  const [fields, setFields] = useState<FieldDraft[]>(
    existingFields.map((field) => ({
      localId: field.id,
      key: field.field_key,
      label: field.label,
      type: field.field_type as SupportFormFieldType,
      order: field.display_order,
      required: field.is_required,
      placeholder: field.placeholder ?? undefined,
      helpText: field.help_text ?? undefined,
      validation: field.validation_rules,
      options: field.options,
      privacy: field.privacy_settings,
    })),
  );
  const save = useMutation({
    mutationFn: () =>
      invokeSupportAction({
        action: "save-form",
        productId: workspace.product.id,
        id: record?.id,
        expectedVersion: record?.version,
        code: form.code
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_]/g, "_"),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status as SupportActionRequest<"save-form">["status"],
        fields: fields.map(({ localId: _localId, ...field }, index) => ({
          ...field,
          order: index + 1,
        })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success(record ? "Formulário atualizado." : "Formulário criado.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addField = () => {
    setFields((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        key: "",
        label: "",
        type: "text",
        order: current.length + 1,
        required: false,
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Editar formulário" : "Criar formulário"}</DialogTitle>
          <DialogDescription>
            Campos usam chaves estáveis; o texto apresentado não é utilizado como chave do dado.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="form-code">Código</Label>
              <Input
                id="form-code"
                value={form.code}
                disabled={Boolean(record)}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-name">Nome</Label>
              <Input
                id="form-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="form-description">Descrição</Label>
              <Textarea
                id="form-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Campos estruturados</p>
                <p className="text-sm text-muted-foreground">
                  A ordem é definida pela posição atual da lista.
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addField}>
                <Plus className="h-4 w-4" /> Adicionar campo
              </Button>
            </div>
            {fields.length === 0 ? (
              <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum campo. Adicione somente os dados necessários ao atendimento.
              </p>
            ) : (
              fields.map((field, index) => (
                <div
                  key={field.localId}
                  className="grid gap-3 rounded-sm border p-4 md:grid-cols-12"
                >
                  <div className="space-y-2 md:col-span-3">
                    <Label>Chave</Label>
                    <Input
                      value={field.key}
                      onChange={(event) =>
                        setFields((current) =>
                          current.map((item) =>
                            item.localId === field.localId
                              ? {
                                  ...item,
                                  key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                                }
                              : item,
                          ),
                        )
                      }
                      placeholder="problem_description"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-4">
                    <Label>Label</Label>
                    <Input
                      value={field.label}
                      onChange={(event) =>
                        setFields((current) =>
                          current.map((item) =>
                            item.localId === field.localId
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Tipo</Label>
                    <Select
                      value={field.type}
                      onValueChange={(value: SupportFormFieldType) =>
                        setFields((current) =>
                          current.map((item) =>
                            item.localId === field.localId ? { ...item, type: value } : item,
                          ),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "text",
                          "textarea",
                          "email",
                          "phone",
                          "number",
                          "date",
                          "datetime",
                          "select",
                          "multi_select",
                          "checkbox",
                          "radio",
                          "file",
                        ].map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-3 md:col-span-2">
                    <label className="flex h-10 items-center gap-2 text-sm">
                      <Checkbox
                        checked={Boolean(field.required)}
                        onCheckedChange={(checked) =>
                          setFields((current) =>
                            current.map((item) =>
                              item.localId === field.localId
                                ? { ...item, required: checked === true }
                                : item,
                            ),
                          )
                        }
                      />
                      Obrigatório
                    </label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remover campo ${index + 1}`}
                      onClick={() =>
                        setFields((current) =>
                          current.filter((item) => item.localId !== field.localId),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                save.isPending ||
                !form.code.trim() ||
                !form.name.trim() ||
                fields.some((field) => !field.key.trim() || !field.label.trim())
              }
            >
              {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Salvar formulário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
