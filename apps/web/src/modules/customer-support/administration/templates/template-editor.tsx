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

export function TemplateEditor({
  workspace,
  record,
  open,
  onOpenChange,
}: SupportEditorProps<SupportTemplate>) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    code: record?.code ?? "",
    name: record?.name ?? "",
    category: record?.category ?? "general",
    channelType: record?.channel_type ?? NONE_VALUE,
    languageCode: record?.language_code ?? workspace.settings.default_language,
    status: record?.status ?? "draft",
    content: record?.content ?? "",
    allowedVariables: (record?.allowed_variables ?? []).join(", "),
  });
  const save = useMutation({
    mutationFn: () =>
      invokeSupportAction({
        action: "save-template",
        productId: workspace.product.id,
        id: record?.id,
        expectedVersion: record?.version,
        code: form.code
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_]/g, "_"),
        name: form.name.trim(),
        category: form.category.trim(),
        channelType:
          form.channelType === NONE_VALUE
            ? undefined
            : (form.channelType as SupportActionRequest<"save-template">["channelType"]),
        languageCode: form.languageCode.trim(),
        status: form.status as SupportActionRequest<"save-template">["status"],
        content: form.content,
        allowedVariables: form.allowedVariables
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success(record ? "Template atualizado." : "Template criado.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Editar template" : "Criar template"}</DialogTitle>
          <DialogDescription>
            Variáveis precisam ser declaradas e são validadas pelo backend.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="template-code">Código</Label>
            <Input
              id="template-code"
              value={form.code}
              disabled={Boolean(record)}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-name">Nome</Label>
            <Input
              id="template-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-category">Categoria</Label>
            <Input
              id="template-category"
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Canal</Label>
            <Select
              value={form.channelType}
              onValueChange={(value) => setForm((current) => ({ ...current, channelType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Todos os canais</SelectItem>
                <SelectItem value="web_chat">Web chat</SelectItem>
                <SelectItem value="in_app">In-app</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-language">Idioma</Label>
            <Input
              id="template-language"
              value={form.languageCode}
              onChange={(event) =>
                setForm((current) => ({ ...current, languageCode: event.target.value }))
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
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="template-variables">Variáveis permitidas</Label>
            <Input
              id="template-variables"
              value={form.allowedVariables}
              onChange={(event) =>
                setForm((current) => ({ ...current, allowedVariables: event.target.value }))
              }
              placeholder="customer_name, product_name, ticket_number"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="template-content">Conteúdo</Label>
            <Textarea
              id="template-content"
              value={form.content}
              onChange={(event) =>
                setForm((current) => ({ ...current, content: event.target.value }))
              }
              rows={8}
              placeholder="Olá {{customer_name}}, seu ticket é {{ticket_number}}."
            />
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                save.isPending || !form.code.trim() || !form.name.trim() || !form.content.trim()
              }
            >
              {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Salvar template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
