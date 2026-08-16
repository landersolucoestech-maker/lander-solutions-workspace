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

export type EscalationRecord = SupportWorkspace["escalationRules"][number];

export function EscalationEditor({
  workspace,
  record,
  open,
  onOpenChange,
}: SupportEditorProps<EscalationRecord>) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: record?.name ?? "",
    eventType: record?.event_type ?? "ticket_unassigned",
    elapsedMinutes: String(record?.elapsed_minutes ?? 0),
    level: String(record?.escalation_level ?? 1),
    queueId: record?.queue_id ?? NONE_VALUE,
    slaPolicyId: record?.sla_policy_id ?? NONE_VALUE,
    recipientRole: record?.recipient_role ?? "",
    recipientQueueId: record?.recipient_queue_id ?? NONE_VALUE,
    recipientUserId: record?.recipient_user_id ?? NONE_VALUE,
    message: record?.message ?? "",
    priority: record?.priority ?? "normal",
    status: record?.status ?? "active",
    order: String(record?.display_order ?? 1),
    repeatPolicy: record?.repeat_policy ?? "once",
    repeatIntervalMinutes: record?.repeat_interval_minutes
      ? String(record.repeat_interval_minutes)
      : "",
    notificationLimit: String(record?.notification_limit ?? 1),
    deliveryChannels: record?.delivery_channels ?? (["in_app"] as SupportNotificationChannel[]),
  });
  const toggleChannel = (channel: SupportNotificationChannel, checked: boolean) =>
    setForm((current) => ({
      ...current,
      deliveryChannels: checked
        ? [...new Set([...current.deliveryChannels, channel])]
        : current.deliveryChannels.filter((item) => item !== channel),
    }));
  const save = useMutation({
    mutationFn: () =>
      invokeSupportAction({
        action: "save-escalation-rule",
        productId: workspace.product.id,
        id: record?.id,
        expectedVersion: record?.version,
        slaPolicyId: form.slaPolicyId === NONE_VALUE ? undefined : form.slaPolicyId,
        queueId: form.queueId === NONE_VALUE ? undefined : form.queueId,
        name: form.name.trim(),
        eventType: form.eventType as SupportEscalationEvent,
        elapsedMinutes: Number(form.elapsedMinutes),
        level: Number(form.level),
        recipientRole: form.recipientRole.trim() || undefined,
        recipientQueueId: form.recipientQueueId === NONE_VALUE ? undefined : form.recipientQueueId,
        recipientUserId: form.recipientUserId === NONE_VALUE ? undefined : form.recipientUserId,
        deliveryChannels: form.deliveryChannels,
        message: form.message.trim(),
        priority: form.priority as SupportActionRequest<"save-escalation-rule">["priority"],
        status: form.status as "active" | "inactive" | "archived",
        order: Number(form.order),
        repeatPolicy: form.repeatPolicy as "once" | "repeat_until_resolved",
        repeatIntervalMinutes: form.repeatIntervalMinutes
          ? Number(form.repeatIntervalMinutes)
          : undefined,
        notificationLimit: Number(form.notificationLimit),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success(record ? "Escalonamento atualizado." : "Escalonamento criado.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Editar escalonamento" : "Criar escalonamento"}</DialogTitle>
          <DialogDescription>
            Defina evento, destinatário e canais. A execução é idempotente no backend.
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
            <Label>Evento</Label>
            <Select
              value={form.eventType}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, eventType: value as typeof current.eventType }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "first_response_at_risk",
                  "first_response_breached",
                  "resolution_at_risk",
                  "resolution_breached",
                  "customer_waiting",
                  "ticket_unassigned",
                  "critical_incident",
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tempo decorrido</Label>
            <Input
              type="number"
              min={0}
              value={form.elapsedMinutes}
              onChange={(event) =>
                setForm((current) => ({ ...current, elapsedMinutes: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Fila de origem</Label>
            <Select
              value={form.queueId}
              onValueChange={(value) => setForm((current) => ({ ...current, queueId: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Todas as filas</SelectItem>
                {workspace.queues.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>SLA</Label>
            <Select
              value={form.slaPolicyId}
              onValueChange={(value) => setForm((current) => ({ ...current, slaPolicyId: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Qualquer SLA</SelectItem>
                {workspace.slaPolicies.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fila destinatária</Label>
            <Select
              value={form.recipientQueueId}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, recipientQueueId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sem fila específica</SelectItem>
                {workspace.queues.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Usuário destinatário</Label>
            <Select
              value={form.recipientUserId}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, recipientUserId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sem usuário específico</SelectItem>
                {workspace.productMembers
                  .filter((member) => member.status === "active")
                  .map((member) => {
                    const profile = workspace.profiles.find((item) => item.id === member.user_id);
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
            <Label>Função destinatária</Label>
            <Input
              value={form.recipientRole}
              onChange={(event) =>
                setForm((current) => ({ ...current, recipientRole: event.target.value }))
              }
              placeholder="support_manager"
            />
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
                {["low", "normal", "high", "urgent", "critical"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Mensagem</Label>
            <Textarea
              value={form.message}
              onChange={(event) =>
                setForm((current) => ({ ...current, message: event.target.value }))
              }
              rows={3}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Canais de notificação</Label>
            <div className="flex flex-wrap gap-4 rounded-sm border p-3">
              {(
                ["in_app", "email", "whatsapp", "sms", "webhook"] as SupportNotificationChannel[]
              ).map((channel) => (
                <label key={channel} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.deliveryChannels.includes(channel)}
                    onCheckedChange={(checked) => toggleChannel(channel, checked === true)}
                  />
                  {channel}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                save.isPending ||
                !form.name.trim() ||
                !form.message.trim() ||
                form.deliveryChannels.length === 0 ||
                (!form.recipientRole.trim() &&
                  form.recipientQueueId === NONE_VALUE &&
                  form.recipientUserId === NONE_VALUE)
              }
            >
              {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} Salvar regra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
