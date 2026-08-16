import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

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
import { EmptyRow, PageHeader, Panel, StatusPill } from "@/shared/components/ui-kit";
import { hasPermission } from "@/modules/access-control/api";
import type {
  ProductStatus,
  ServiceLine,
} from "@/modules/company/organizational-structure/reference-data-api";
import { listCrmReferenceData } from "./reference-data-api";
import { saveLeadService } from "./lead-services-api";

const LANDER_SERVICES_CODE = "LANDERSERVICES";

type ServiceAction = { action: "create" } | { action: "edit"; record: ServiceLine } | null;

export function LeadServicesSettingsPage() {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ServiceAction>(null);

  const structureQuery = useQuery({
    queryKey: ["crm-reference-data"],
    queryFn: listCrmReferenceData,
  });
  const permissionQuery = useQuery({
    queryKey: ["lead-services-settings-permission"],
    queryFn: () => hasPermission("corporate.manage"),
  });

  const unit = structureQuery.data?.businessUnits.find(
    (item) => item.code === LANDER_SERVICES_CODE,
  );
  const services = useMemo(
    () =>
      (structureQuery.data?.serviceLines ?? [])
        .filter((item) => item.business_unit_id === unit?.id)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [structureQuery.data?.serviceLines, unit?.id],
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["crm-reference-data"] });
    await queryClient.invalidateQueries({ queryKey: ["crm-directory"] });
  }

  if (structureQuery.isLoading || permissionQuery.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        Carregando configuração...
      </div>
    );
  }

  if (structureQuery.isError || permissionQuery.isError || !structureQuery.data) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
        Não foi possível carregar a configuração dos serviços.
      </div>
    );
  }

  if (!permissionQuery.data) {
    return (
      <div className="rounded-md border p-6">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Somente usuários com permissão de gestão corporativa podem configurar os serviços exibidos
          no formulário de Leads.
        </p>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
        A unidade LANDER SERVICES não está disponível.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços de interesse dos leads"
        description="Página de configuração interna, sem item no menu principal. Os serviços ativos aparecem nos dropdowns do formulário de Leads."
      />

      <Panel
        title="Catálogo de serviços"
        description="Cadastre, edite, ative ou inative os serviços comerciais da LANDER SOLUTIONS / LANDER SERVICES."
        actions={
          <Button size="sm" onClick={() => setAction({ action: "create" })}>
            <Plus className="h-4 w-4" />
            Adicionar serviço
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                <th className="px-4 py-3 text-left">Serviço</th>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-left">Situação</th>
                <th className="w-20 px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 && (
                <EmptyRow colSpan={5} label="Nenhum serviço configurado." />
              )}
              {services.map((service) => (
                <tr key={service.id} className="border-t align-top">
                  <td className="px-4 py-3 font-medium">{service.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{service.code}</td>
                  <td className="max-w-md px-4 py-3 text-muted-foreground">
                    {service.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={statusLabel(service.status)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar ${service.name}`}
                      onClick={() => setAction({ action: "edit", record: service })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <ServiceDialog
        key={
          action?.action === "edit" ? `edit-${action.record.id}-${action.record.version}` : "create"
        }
        state={action}
        businessUnitId={unit.id}
        onClose={() => setAction(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function ServiceDialog({
  state,
  businessUnitId,
  onClose,
  onChanged,
}: {
  state: ServiceAction;
  businessUnitId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const record = state?.action === "edit" ? state.record : null;
  const [name, setName] = useState(record?.name ?? "");
  const [code, setCode] = useState(record?.code ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [status, setStatus] = useState<ProductStatus>(record?.status ?? "active");
  const [submitting, setSubmitting] = useState(false);

  if (!state) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedCode = normalizeCode(code || normalizedName);
    if (!normalizedName) {
      toast.error("Informe o nome do serviço.");
      return;
    }
    if (!normalizedCode) {
      toast.error("Informe um código válido.");
      return;
    }

    setSubmitting(true);
    try {
      await saveLeadService({
        businessUnitId,
        record,
        code: normalizedCode,
        name: normalizedName,
        description: description.trim() || null,
        status,
      });
      toast.success(record ? "Serviço atualizado." : "Serviço adicionado.");
      await onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar o serviço.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <form className="space-y-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{record ? "Editar serviço" : "Adicionar serviço"}</DialogTitle>
            <DialogDescription>
              Este item será disponibilizado nos dropdowns de interesse do Lead.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-service-name">Nome do serviço</Label>
              <Input
                id="lead-service-name"
                value={name}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setName(nextName);
                  if (!record && !code) setCode(normalizeCode(nextName));
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-service-code">Código</Label>
              <Input
                id="lead-service-code"
                value={code}
                onChange={(event) => setCode(normalizeCode(event.target.value))}
                required
                disabled={Boolean(record?.is_system)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-service-description">Descrição</Label>
            <textarea
              id="lead-service-description"
              className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-service-status">Situação</Label>
            <select
              id="lead-service-status"
              className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as ProductStatus)}
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="planned">Planejado</option>
              <option value="discontinued">Descontinuado</option>
            </select>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Salvar serviço
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function normalizeCode(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function statusLabel(status: ProductStatus): string {
  return {
    planned: "Planejado",
    active: "Ativo",
    inactive: "Inativo",
    discontinued: "Descontinuado",
  }[status];
}
