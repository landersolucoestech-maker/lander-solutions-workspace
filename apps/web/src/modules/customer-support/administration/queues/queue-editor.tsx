import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
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
import { Textarea } from "@/shared/components/ui/textarea";
import type { SupportActionRequest, SupportDistributionStrategy } from "../../contracts";
import type { SupportQueue, SupportWorkspace } from "../../types";
import { invokeSupportAction } from "../../api";
import {
  NONE_VALUE,
  supportErrorMessage as errorMessage,
  useUnsavedWarning,
} from "../editor-helpers";

interface QueueEditorProps {
  workspace: SupportWorkspace;
  record: SupportQueue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QueueEditor({ workspace, record, open, onOpenChange }: QueueEditorProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    code: record?.code ?? "",
    name: record?.name ?? "",
    description: record?.description ?? "",
    status: record?.status ?? "active",
    defaultPriority: record?.default_priority ?? "normal",
    distributionStrategy: record?.distribution_strategy ?? "manual",
    businessHoursId: record?.business_hours_id ?? NONE_VALUE,
    slaPolicyId: record?.sla_policy_id ?? NONE_VALUE,
    capacity: record?.capacity ? String(record.capacity) : "",
  });
  const dirty =
    JSON.stringify(form) !==
    JSON.stringify({
      code: record?.code ?? "",
      name: record?.name ?? "",
      description: record?.description ?? "",
      status: record?.status ?? "active",
      defaultPriority: record?.default_priority ?? "normal",
      distributionStrategy: record?.distribution_strategy ?? "manual",
      businessHoursId: record?.business_hours_id ?? NONE_VALUE,
      slaPolicyId: record?.sla_policy_id ?? NONE_VALUE,
      capacity: record?.capacity ? String(record.capacity) : "",
    });
  useUnsavedWarning(open && dirty);

  const save = useMutation({
    mutationFn: () => {
      const request: SupportActionRequest<"save-queue"> = {
        action: "save-queue",
        id: record?.id,
        expectedVersion: record?.version,
        productId: workspace.product.id,
        code: form.code
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_]/g, "_"),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status as "active" | "inactive" | "archived",
        defaultPriority:
          form.defaultPriority as SupportActionRequest<"save-queue">["defaultPriority"],
        distributionStrategy: form.distributionStrategy as SupportDistributionStrategy,
        businessHoursId: form.businessHoursId === NONE_VALUE ? undefined : form.businessHoursId,
        slaPolicyId: form.slaPolicyId === NONE_VALUE ? undefined : form.slaPolicyId,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      };
      return invokeSupportAction(request);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["support-workspace", workspace.product.id],
      });
      toast.success(record ? "Fila atualizada." : "Fila criada.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && dirty && !window.confirm("Descartar alterações não salvas?")) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Editar fila" : "Criar fila"}</DialogTitle>
          <DialogDescription>
            Configure uma fila real do produto e sua estratégia de distribuição.
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
            <Label htmlFor="queue-code">Código estável</Label>
            <Input
              id="queue-code"
              value={form.code}
              disabled={Boolean(record)}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="SUPORTE_GERAL"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="queue-name">Nome</Label>
            <Input
              id="queue-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="queue-description">Descrição</Label>
            <Textarea
              id="queue-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
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
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="inactive">Inativa</SelectItem>
                <SelectItem value="archived">Arquivada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estratégia</Label>
            <Select
              value={form.distributionStrategy}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  distributionStrategy: value as typeof current.distributionStrategy,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="round_robin">Round robin</SelectItem>
                <SelectItem value="least_loaded">Menor carga</SelectItem>
                <SelectItem value="specific_agent">Agente específico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade padrão</Label>
            <Select
              value={form.defaultPriority}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  defaultPriority: value as typeof current.defaultPriority,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="queue-capacity">Capacidade</Label>
            <Input
              id="queue-capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(event) =>
                setForm((current) => ({ ...current, capacity: event.target.value }))
              }
              placeholder="Sem limite específico"
            />
          </div>
          <div className="space-y-2">
            <Label>Horário de atendimento</Label>
            <Select
              value={form.businessHoursId}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, businessHoursId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem calendário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sem calendário</SelectItem>
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
            <Label>Política de SLA</Label>
            <Select
              value={form.slaPolicyId}
              onValueChange={(value) => setForm((current) => ({ ...current, slaPolicyId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem SLA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sem SLA</SelectItem>
                {workspace.slaPolicies.map((item) => (
                  <SelectItem key={item.id} value={item.id} disabled={item.status !== "active"}>
                    {item.name}
                    {item.status !== "active" ? " — inativo" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={save.isPending || !form.code.trim() || !form.name.trim()}
            >
              {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Salvar fila
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
