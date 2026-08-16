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

export function SlaEditor({
  workspace,
  record,
  open,
  onOpenChange,
}: SupportEditorProps<SupportSlaPolicy>) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: record?.name ?? "",
    status: record?.status ?? "active",
    businessHoursId: record?.business_hours_id ?? NONE_VALUE,
    priority: record?.priority ?? NONE_VALUE,
    firstResponseMinutes: String(record?.first_response_minutes ?? 60),
    nextResponseMinutes: record?.next_response_minutes ? String(record.next_response_minutes) : "",
    resolutionMinutes: String(record?.resolution_minutes ?? 480),
  });
  const save = useMutation({
    mutationFn: () =>
      invokeSupportAction({
        action: "save-sla-policy",
        productId: workspace.product.id,
        id: record?.id,
        expectedVersion: record?.version,
        name: form.name.trim(),
        status: form.status as "active" | "inactive" | "archived",
        businessHoursId: form.businessHoursId === NONE_VALUE ? undefined : form.businessHoursId,
        priority:
          form.priority === NONE_VALUE
            ? undefined
            : (form.priority as SupportActionRequest<"save-sla-policy">["priority"]),
        firstResponseMinutes: Number(form.firstResponseMinutes),
        nextResponseMinutes: form.nextResponseMinutes
          ? Number(form.nextResponseMinutes)
          : undefined,
        resolutionMinutes: Number(form.resolutionMinutes),
        pauseStatuses: (record?.pause_statuses ?? [
          "waiting_for_customer",
        ]) as SupportTicketStatus[],
        conditions: record?.conditions ?? {},
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success(record ? "SLA atualizado." : "SLA criado.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{record ? "Editar SLA" : "Criar SLA"}</DialogTitle>
          <DialogDescription>
            Metas em minutos, calculadas pelo backend com o calendário selecionado.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2 md:col-span-2">
            <Label>Nome</Label>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
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
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select
              value={form.priority}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, priority: value as typeof current.priority }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Todas</SelectItem>
                {["low", "normal", "high", "urgent", "critical"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Calendário</Label>
            <Select
              value={form.businessHoursId}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, businessHoursId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>24 horas corridas</SelectItem>
                {workspace.businessHours.map((item) => (
                  <SelectItem key={item.id} value={item.id} disabled={item.status !== "active"}>
                    {item.name}
                    {item.status !== "active" ? " — inativo" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Primeira resposta</Label>
            <Input
              type="number"
              min={1}
              value={form.firstResponseMinutes}
              onChange={(event) =>
                setForm((current) => ({ ...current, firstResponseMinutes: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Próxima resposta</Label>
            <Input
              type="number"
              min={1}
              value={form.nextResponseMinutes}
              onChange={(event) =>
                setForm((current) => ({ ...current, nextResponseMinutes: event.target.value }))
              }
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-2">
            <Label>Resolução</Label>
            <Input
              type="number"
              min={1}
              value={form.resolutionMinutes}
              onChange={(event) =>
                setForm((current) => ({ ...current, resolutionMinutes: event.target.value }))
              }
            />
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || !form.name.trim()}>
              {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} Salvar SLA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
