import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  LoaderCircle,
  Plus,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { RowActionsMenu } from "@/shared/components/row-actions-menu";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
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
import { Skeleton } from "@/shared/components/ui/skeleton";
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
import { Kpi, Panel, StatusPill } from "@/shared/components/ui-kit";
import { hasPermission } from "@/modules/access-control/api";
import {
  createIntellectualPropertyAsset,
  createIntellectualPropertyEvent,
  deleteIntellectualPropertyAsset,
  deleteIntellectualPropertyEvent,
  decideIntellectualPropertyEvent,
  listIntellectualPropertyWorkspace,
  updateIntellectualPropertyAsset,
  updateIntellectualPropertyEvent,
} from "./api";
import type {
  IntellectualPropertyAsset,
  IntellectualPropertyEvent,
  IntellectualPropertyWorkspace,
} from "./types";

const NONE_VALUE = "__none__";
const IP_TYPES = [
  ["trademark", "Marca"],
  ["copyright", "Direito autoral"],
  ["domain", "Domínio"],
  ["software", "Software"],
  ["patent", "Patente"],
  ["industrial_design", "Desenho industrial"],
  ["trade_secret", "Segredo empresarial"],
  ["other", "Outro"],
] as const;
const ASSET_STATUSES = [
  ["planned", "Planejado"],
  ["filed", "Depositado"],
  ["pending", "Em análise"],
  ["registered", "Registrado"],
  ["active", "Ativo"],
  ["opposed", "Em oposição"],
  ["expired", "Expirado"],
  ["abandoned", "Abandonado"],
  ["cancelled", "Cancelado"],
] as const;
const EVENT_TYPES = [
  ["filing", "Depósito"],
  ["office_action", "Exigência"],
  ["opposition", "Oposição"],
  ["registration", "Registro"],
  ["renewal", "Renovação"],
  ["expiration", "Expiração"],
  ["assignment", "Cessão"],
  ["license", "Licenciamento"],
  ["monitoring", "Monitoramento"],
  ["other", "Outro"],
] as const;
const EVENT_STATUSES = [
  ["planned", "Planejado"],
  ["pending", "Pendente"],
  ["completed", "Concluído"],
  ["cancelled", "Cancelado"],
  ["overdue", "Atrasado"],
] as const;

type AssetDialogState =
  { action: "create" } | { action: "edit" | "delete"; asset: IntellectualPropertyAsset };
type EventDialogState =
  | { action: "create"; asset: IntellectualPropertyAsset }
  | {
      action: "edit" | "delete";
      asset: IntellectualPropertyAsset;
      event: IntellectualPropertyEvent;
    };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
}

function optionLabel<T extends readonly (readonly [string, string])[]>(options: T, value: string) {
  return options.find(([key]) => key === value)?.[1] ?? value;
}

export function IntellectualPropertyPage() {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assetDialog, setAssetDialog] = useState<AssetDialogState | null>(null);
  const [eventDialog, setEventDialog] = useState<EventDialogState | null>(null);
  const readPermission = useQuery({
    queryKey: ["permission", "ip.read"],
    queryFn: () => hasPermission("ip.read"),
    enabled: Boolean(session && user),
  });
  const managePermission = useQuery({
    queryKey: ["permission", "ip.manage"],
    queryFn: () => hasPermission("ip.manage"),
    enabled: Boolean(session && user),
  });
  const approvePermission = useQuery({
    queryKey: ["permission", "ip.approve"],
    queryFn: () => hasPermission("ip.approve"),
    enabled: Boolean(session && user),
  });
  const workspace = useQuery({
    queryKey: ["intellectual-property-workspace"],
    queryFn: listIntellectualPropertyWorkspace,
    enabled: !session || !user || readPermission.data === true,
  });
  const data = workspace.data;
  const canManage = Boolean(session && user && managePermission.data === true);
  const canApprove = Boolean(session && user && approvePermission.data === true);

  const assets = useMemo(() => {
    if (!data) return [];
    const normalized = search.trim().toLowerCase();
    return data.assets.filter((asset) => {
      if (typeFilter !== "all" && asset.ip_type !== typeFilter) return false;
      const text = [
        asset.code,
        asset.title,
        asset.description,
        asset.application_number,
        asset.registration_number,
        asset.authority,
        asset.jurisdiction,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !normalized || text.includes(normalized);
    });
  }, [data, search, typeFilter]);
  const activeAssetId = data?.assets.some((item) => item.id === selectedAssetId)
    ? selectedAssetId
    : (assets[0]?.id ?? data?.assets[0]?.id ?? "");
  const activeAsset = data?.assets.find((item) => item.id === activeAssetId) ?? null;
  const activeEvents = useMemo(
    () =>
      data?.events
        .filter((item) => item.intellectual_property_id === activeAssetId)
        .sort((a, b) => b.sequence_no - a.sequence_no) ?? [],
    [activeAssetId, data?.events],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["intellectual-property-workspace"] });
  };

  if (
    workspace.isLoading ||
    (session &&
      user &&
      (readPermission.isLoading || managePermission.isLoading || approvePermission.isLoading))
  ) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-sm" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-sm" />
      </div>
    );
  }
  if (session && user && readPermission.data !== true) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Acesso negado a Propriedade Intelectual</AlertTitle>
        <AlertDescription>
          A permissão ip.read é necessária para consultar este domínio.
        </AlertDescription>
      </Alert>
    );
  }
  if (workspace.isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Falha ao carregar Propriedade Intelectual</AlertTitle>
        <AlertDescription>{errorMessage(workspace.error)}</AlertDescription>
      </Alert>
    );
  }

  const registered = data.assets.filter(
    (item) => item.status === "registered" || item.status === "active",
  ).length;
  const pending = data.assets.filter(
    (item) => item.status === "filed" || item.status === "pending" || item.status === "opposed",
  ).length;
  const renewalWindow = data.assets.filter((item) => {
    const days = daysUntil(item.renewal_due_on || item.expires_on);
    return days !== null && days >= 0 && days <= 120;
  }).length;
  const overdueEvents = data.events.filter((item) => {
    const days = daysUntil(item.due_date);
    return item.event_status !== "completed" && days !== null && days < 0;
  }).length;

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>Direitos e registros intelectuais</AlertTitle>
        <AlertDescription>
          Esta área controla marcas, patentes, direitos autorais, software protegido, obras,
          titularidade, pedidos, renovações e eventos registrais. Equipamentos, SaaS comum, licenças
          operacionais e processos judiciais pertencem a outros domínios.
        </AlertDescription>
      </Alert>
      {!canManage && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Modo consultivo</AlertTitle>
          <AlertDescription>
            Ativos e prazos reais estão disponíveis para leitura. Criação e alteração exigem
            autenticação e a permissão ip.manage.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Ativos protegidos"
          value={String(registered)}
          hint={`${data.assets.length} cadastrados`}
        />
        <Kpi
          label="Processos em andamento"
          value={String(pending)}
          hint="Depósito, análise ou oposição"
        />
        <Kpi
          label="Renovações em 120 dias"
          value={String(renewalWindow)}
          hint="Prazos futuros"
          tone={renewalWindow > 0 ? "warning" : "positive"}
        />
        <Kpi
          label="Eventos vencidos"
          value={String(overdueEvents)}
          hint="Providências pendentes"
          tone={overdueEvents > 0 ? "negative" : "positive"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <Panel
          title="Ativos de propriedade intelectual"
          description="Marcas, domínios, softwares, direitos autorais e demais ativos protegidos."
          actions={
            <Button
              size="sm"
              disabled={!canManage}
              onClick={() => setAssetDialog({ action: "create" })}
            >
              <Plus className="h-4 w-4" /> Novo ativo
            </Button>
          }
        >
          <div className="grid gap-2 border-b p-3 sm:grid-cols-[1fr_190px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar código, título, protocolo ou autoridade"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {IP_TYPES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[670px] divide-y overflow-y-auto">
            {assets.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Nenhum ativo encontrado.
              </p>
            ) : (
              assets.map((asset) => {
                const deadline = asset.renewal_due_on || asset.expires_on;
                const remaining = daysUntil(deadline);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={`w-full p-4 text-left transition-colors hover:bg-muted/50 ${asset.id === activeAssetId ? "bg-muted/60" : ""}`}
                    onClick={() => setSelectedAssetId(asset.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {asset.code} · {asset.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {optionLabel(IP_TYPES, asset.ip_type)} ·{" "}
                          {asset.jurisdiction || "Sem jurisdição"}
                        </p>
                      </div>
                      <StatusPill status={asset.status} />
                    </div>
                    {deadline && (
                      <p
                        className={`mt-2 flex items-center gap-1 text-xs ${remaining !== null && remaining < 0 ? "text-destructive" : remaining !== null && remaining <= 120 ? "text-warning" : "text-muted-foreground"}`}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        {asset.renewal_due_on ? "Renovação" : "Expiração"}: {formatDate(deadline)}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Panel>

        <Panel
          title={activeAsset ? `${activeAsset.code} · ${activeAsset.title}` : "Detalhes e eventos"}
          description="Dados registrais, vínculos corporativos e histórico de providências."
          actions={
            activeAsset ? (
              <RowActionsMenu
                onEdit={() => setAssetDialog({ action: "edit", asset: activeAsset })}
                editDisabled={!canManage}
                onDelete={() => setAssetDialog({ action: "delete", asset: activeAsset })}
                deleteDisabled={!canManage}
              />
            ) : undefined
          }
        >
          {!activeAsset ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Selecione um ativo.</p>
          ) : (
            <div className="space-y-5 p-4">
              <div className="grid gap-3 rounded-sm border p-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                <Detail label="Tipo" value={optionLabel(IP_TYPES, activeAsset.ip_type)} />
                <Detail
                  label="Entidade titular"
                  value={
                    data.legalEntities.find((item) => item.id === activeAsset.legal_entity_id)
                      ?.name ?? "—"
                  }
                />
                <Detail
                  label="Unidade"
                  value={
                    data.businessUnits.find((item) => item.id === activeAsset.business_unit_id)
                      ?.name ?? "Corporativo"
                  }
                />
                <Detail label="Autoridade" value={activeAsset.authority || "—"} />
                <Detail label="Pedido" value={activeAsset.application_number || "—"} />
                <Detail label="Registro" value={activeAsset.registration_number || "—"} />
                <Detail label="Depósito" value={formatDate(activeAsset.filing_date)} />
                <Detail
                  label="Registro concedido"
                  value={formatDate(activeAsset.registration_date)}
                />
                <Detail label="Renovação" value={formatDate(activeAsset.renewal_due_on)} />
              </div>

              {activeAsset.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Descrição
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{activeAsset.description}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Eventos e prazos</h3>
                  <p className="text-xs text-muted-foreground">
                    Histórico sequencial do ativo selecionado.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canManage}
                  onClick={() => setEventDialog({ action: "create", asset: activeAsset })}
                >
                  <Plus className="h-4 w-4" /> Novo evento
                </Button>
              </div>

              <div className="overflow-x-auto rounded-sm border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Data / prazo</TableHead>
                      <TableHead>Protocolo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                          Nenhum evento registrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeEvents.map((event) => {
                        const overdue =
                          event.event_status !== "completed" &&
                          (daysUntil(event.due_date) ?? 0) < 0;
                        return (
                          <TableRow key={event.id}>
                            <TableCell>{event.sequence_no}</TableCell>
                            <TableCell>
                              <p className="font-medium">
                                {optionLabel(EVENT_TYPES, event.event_type)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {event.authority || event.reason || "—"}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p>{formatDate(event.occurred_on)}</p>
                              {event.due_date && (
                                <p
                                  className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}
                                >
                                  {overdue && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                                  Prazo {formatDate(event.due_date)}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>{event.protocol || "—"}</TableCell>
                            <TableCell>
                              <StatusPill status={overdue ? "overdue" : event.event_status} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {event.event_status === "pending" && (
                                  <>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      aria-label="Aprovar evento de propriedade intelectual"
                                      disabled={!canApprove}
                                      onClick={async () => {
                                        try {
                                          await decideIntellectualPropertyEvent(
                                            event.id,
                                            event.version,
                                            true,
                                          );
                                          toast.success("Evento de PI aprovado.");
                                          await refresh();
                                        } catch (error) {
                                          toast.error(errorMessage(error));
                                        }
                                      }}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive"
                                      aria-label="Rejeitar evento de propriedade intelectual"
                                      disabled={!canApprove}
                                      onClick={async () => {
                                        const reason = window.prompt(
                                          "Motivo da rejeição do evento de PI:",
                                        );
                                        if (reason === null) return;
                                        try {
                                          await decideIntellectualPropertyEvent(
                                            event.id,
                                            event.version,
                                            false,
                                            reason,
                                          );
                                          toast.success("Evento de PI rejeitado.");
                                          await refresh();
                                        } catch (error) {
                                          toast.error(errorMessage(error));
                                        }
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <RowActionsMenu
                                  onEdit={() =>
                                    setEventDialog({ action: "edit", asset: activeAsset, event })
                                  }
                                  editDisabled={!canManage}
                                  onDelete={() =>
                                    setEventDialog({ action: "delete", asset: activeAsset, event })
                                  }
                                  deleteDisabled={!canManage}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <AssetDialog
        state={assetDialog}
        data={data}
        onClose={() => setAssetDialog(null)}
        onChanged={refresh}
      />
      <EventDialog
        state={eventDialog}
        events={data.events}
        onClose={() => setEventDialog(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function AssetDialog({
  state,
  data,
  onClose,
  onChanged,
}: {
  state: AssetDialogState | null;
  data: IntellectualPropertyWorkspace;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const asset = state && state.action !== "create" ? state.asset : undefined;
  const [values, setValues] = useState(() => assetValues(asset));
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!state) return null;
  const activeState = state;
  const set = (field: string, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = buildAssetPayload(values, data);
      if (activeState.action === "create") {
        const created = await createIntellectualPropertyAsset(payload);
        toast.success(`Ativo ${created.code} criado.`);
      } else if (activeState.action === "edit") {
        await updateIntellectualPropertyAsset(
          activeState.asset.id,
          activeState.asset.version,
          payload,
        );
        toast.success("Ativo atualizado.");
      }
      await onChanged();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function destroy() {
    if (!asset) return;
    setSubmitting(true);
    try {
      await deleteIntellectualPropertyAsset(asset.id);
      await onChanged();
      toast.success("Ativo excluído.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (activeState.action === "delete") {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir ativo</DialogTitle>
            <DialogDescription>
              Todos os eventos vinculados serão removidos em cascata.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-sm border p-4">
            <p className="font-medium">{activeState.asset.title}</p>
            <p className="font-mono text-xs text-muted-foreground">{activeState.asset.code}</p>
          </div>
          <div className="space-y-2">
            <Label>Digite {activeState.asset.code} para confirmar</Label>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={submitting || confirmation !== activeState.asset.code}
              onClick={() => void destroy()}
            >
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const units = data.businessUnits.filter(
    (item) => !values.legal_entity_id || item.legal_entity_id === values.legal_entity_id,
  );
  const products = data.products.filter(
    (item) => !values.business_unit_id || item.business_unit_id === values.business_unit_id,
  );
  const services = data.serviceLines.filter(
    (item) => !values.business_unit_id || item.business_unit_id === values.business_unit_id,
  );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {activeState.action === "create" ? "Novo ativo" : "Editar ativo"}
            </DialogTitle>
            <DialogDescription>
              Cadastro registral e vínculos corporativos do ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Código"
              value={values.code}
              onChange={(value) => set("code", value.toUpperCase())}
              required
            />
            <Field
              label="Título"
              value={values.title}
              onChange={(value) => set("title", value)}
              required
              className="lg:col-span-2"
            />
            <SelectField
              label="Tipo"
              value={values.ip_type}
              onChange={(value) => set("ip_type", value)}
              options={[...IP_TYPES]}
            />
            <SelectField
              label="Status"
              value={values.status}
              onChange={(value) => set("status", value)}
              options={[...ASSET_STATUSES]}
            />
            <SelectField
              label="Entidade jurídica"
              value={values.legal_entity_id}
              onChange={(value) => {
                set("legal_entity_id", value);
                set("business_unit_id", "");
              }}
              options={data.legalEntities.map((item) => [item.id, `${item.code} · ${item.name}`])}
            />
            <SelectField
              label="Unidade"
              value={values.business_unit_id || NONE_VALUE}
              onChange={(value) => set("business_unit_id", value === NONE_VALUE ? "" : value)}
              options={[
                [NONE_VALUE, "Corporativo"],
                ...units.map((item) => [item.id, `${item.code ?? ""} · ${item.name}`] as const),
              ]}
            />
            <SelectField
              label="Produto"
              value={values.product_id || NONE_VALUE}
              onChange={(value) => {
                set("product_id", value === NONE_VALUE ? "" : value);
                if (value !== NONE_VALUE) set("service_line_id", "");
              }}
              options={[
                [NONE_VALUE, "Sem produto"],
                ...products.map((item) => [item.id, item.name] as const),
              ]}
            />
            <SelectField
              label="Serviço"
              value={values.service_line_id || NONE_VALUE}
              onChange={(value) => {
                set("service_line_id", value === NONE_VALUE ? "" : value);
                if (value !== NONE_VALUE) set("product_id", "");
              }}
              options={[
                [NONE_VALUE, "Sem serviço"],
                ...services.map((item) => [item.id, item.name] as const),
              ]}
            />
            <SelectField
              label="Criador / titular original"
              value={values.creator_party_id || NONE_VALUE}
              onChange={(value) => set("creator_party_id", value === NONE_VALUE ? "" : value)}
              options={[
                [NONE_VALUE, "Não informado"],
                ...data.parties.map(
                  (item) => [item.id, item.trade_name || item.legal_name] as const,
                ),
              ]}
            />
            <SelectField
              label="Responsável interno"
              value={values.responsible_user_id || NONE_VALUE}
              onChange={(value) => set("responsible_user_id", value === NONE_VALUE ? "" : value)}
              options={[
                [NONE_VALUE, "Não atribuído"],
                ...data.profiles
                  .filter((item) => item.status === "active")
                  .map((item) => [item.id, item.display_name] as const),
              ]}
            />
            <Field
              label="Jurisdição"
              value={values.jurisdiction}
              onChange={(value) => set("jurisdiction", value)}
            />
            <Field
              label="Autoridade"
              value={values.authority}
              onChange={(value) => set("authority", value)}
            />
            <Field
              label="Número do pedido"
              value={values.application_number}
              onChange={(value) => set("application_number", value)}
            />
            <Field
              label="Número do registro"
              value={values.registration_number}
              onChange={(value) => set("registration_number", value)}
            />
            <Field
              label="Classificações"
              value={values.classification_codes}
              onChange={(value) => set("classification_codes", value)}
              placeholder="Ex.: NCL 35, NCL 41"
            />
            <Field
              label="Data do depósito"
              type="date"
              value={values.filing_date}
              onChange={(value) => set("filing_date", value)}
            />
            <Field
              label="Data do registro"
              type="date"
              value={values.registration_date}
              onChange={(value) => set("registration_date", value)}
            />
            <Field
              label="Expiração"
              type="date"
              value={values.expires_on}
              onChange={(value) => set("expires_on", value)}
            />
            <Field
              label="Prazo de renovação"
              type="date"
              value={values.renewal_due_on}
              onChange={(value) => set("renewal_due_on", value)}
            />
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label>Descrição</Label>
              <Textarea
                value={values.description}
                onChange={(event) => set("description", event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label>Observações</Label>
              <Textarea
                value={values.notes}
                onChange={(event) => set("notes", event.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventDialog({
  state,
  events,
  onClose,
  onChanged,
}: {
  state: EventDialogState | null;
  events: IntellectualPropertyEvent[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const event = state && state.action !== "create" ? state.event : undefined;
  const [values, setValues] = useState(() => eventValues(event));
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!state) return null;
  const activeState = state;
  const set = (field: string, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setSubmitting(true);
    try {
      const payload = buildEventPayload(values);
      if (activeState.action === "create") {
        const nextSequence =
          Math.max(
            0,
            ...events
              .filter((item) => item.intellectual_property_id === activeState.asset.id)
              .map((item) => item.sequence_no),
          ) + 1;
        await createIntellectualPropertyEvent({
          ...payload,
          intellectual_property_id: activeState.asset.id,
          sequence_no: nextSequence,
        });
        toast.success("Evento criado.");
      } else if (activeState.action === "edit") {
        await updateIntellectualPropertyEvent(
          activeState.event.id,
          activeState.event.version,
          payload,
        );
        toast.success("Evento atualizado.");
      }
      await onChanged();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function destroy() {
    if (!event) return;
    setSubmitting(true);
    try {
      await deleteIntellectualPropertyEvent(event.id);
      await onChanged();
      toast.success("Evento excluído.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (activeState.action === "delete") {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir evento</DialogTitle>
            <DialogDescription>Esta operação remove o registro do histórico.</DialogDescription>
          </DialogHeader>
          <div className="rounded-sm border p-4">
            <p className="font-medium">{optionLabel(EVENT_TYPES, activeState.event.event_type)}</p>
            <p className="text-xs text-muted-foreground">
              Sequência {activeState.event.sequence_no}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Digite EXCLUIR para confirmar</Label>
            <Input
              value={confirmation}
              onChange={(input) => setConfirmation(input.target.value.toUpperCase())}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={submitting || confirmation !== "EXCLUIR"}
              onClick={() => void destroy()}
            >
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {activeState.action === "create" ? "Novo evento" : "Editar evento"}
            </DialogTitle>
            <DialogDescription>
              {activeState.asset.code} · {activeState.asset.title}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Tipo"
              value={values.event_type}
              onChange={(value) => set("event_type", value)}
              options={[...EVENT_TYPES]}
            />
            <SelectField
              label="Status"
              value={values.event_status}
              onChange={(value) => set("event_status", value)}
              options={[...EVENT_STATUSES]}
            />
            <Field
              label="Data de ocorrência"
              type="date"
              value={values.occurred_on}
              onChange={(value) => set("occurred_on", value)}
            />
            <Field
              label="Prazo"
              type="date"
              value={values.due_date}
              onChange={(value) => set("due_date", value)}
            />
            <Field
              label="Protocolo"
              value={values.protocol}
              onChange={(value) => set("protocol", value)}
            />
            <Field
              label="Autoridade"
              value={values.authority}
              onChange={(value) => set("authority", value)}
            />
            <Field
              label="Evidência / documento"
              value={values.evidence_reference}
              onChange={(value) => set("evidence_reference", value)}
              className="sm:col-span-2"
            />
            <div className="space-y-2 sm:col-span-2">
              <Label>Motivo / observação</Label>
              <Textarea
                value={values.reason}
                onChange={(input) => set("reason", input.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function assetValues(asset?: IntellectualPropertyAsset) {
  return {
    code: asset?.code ?? "",
    title: asset?.title ?? "",
    description: asset?.description ?? "",
    ip_type: asset?.ip_type ?? "trademark",
    jurisdiction: asset?.jurisdiction ?? "BR",
    authority: asset?.authority ?? "",
    application_number: asset?.application_number ?? "",
    registration_number: asset?.registration_number ?? "",
    classification_codes: asset?.classification_codes.join(", ") ?? "",
    filing_date: asset?.filing_date ?? "",
    registration_date: asset?.registration_date ?? "",
    expires_on: asset?.expires_on ?? "",
    renewal_due_on: asset?.renewal_due_on ?? "",
    status: asset?.status ?? "planned",
    legal_entity_id: asset?.legal_entity_id ?? "",
    business_unit_id: asset?.business_unit_id ?? "",
    product_id: asset?.product_id ?? "",
    service_line_id: asset?.service_line_id ?? "",
    creator_party_id: asset?.creator_party_id ?? "",
    responsible_user_id: asset?.responsible_user_id ?? "",
    notes: asset?.notes ?? "",
  };
}

function buildAssetPayload(
  values: ReturnType<typeof assetValues>,
  data: IntellectualPropertyWorkspace,
) {
  const nullable = (value: string) => value.trim() || null;
  if (!/^[A-Z0-9][A-Z0-9_-]{1,49}$/.test(values.code.trim().toUpperCase()))
    throw new Error("Informe um código válido em caixa alta.");
  if (values.title.trim().length < 2) throw new Error("Informe o título do ativo.");
  if (!data.legalEntities.some((item) => item.id === values.legal_entity_id))
    throw new Error("Selecione a entidade jurídica titular.");
  if (values.product_id && values.service_line_id)
    throw new Error("Selecione produto ou serviço, não ambos.");
  return {
    legal_entity_id: values.legal_entity_id,
    business_unit_id: nullable(values.business_unit_id),
    product_id: nullable(values.product_id),
    service_line_id: nullable(values.service_line_id),
    creator_party_id: nullable(values.creator_party_id),
    responsible_user_id: nullable(values.responsible_user_id),
    code: values.code.trim().toUpperCase(),
    title: values.title.trim(),
    description: nullable(values.description),
    ip_type: values.ip_type,
    jurisdiction: nullable(values.jurisdiction),
    authority: nullable(values.authority),
    application_number: nullable(values.application_number),
    registration_number: nullable(values.registration_number),
    classification_codes: values.classification_codes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    filing_date: nullable(values.filing_date),
    registration_date: nullable(values.registration_date),
    expires_on: nullable(values.expires_on),
    renewal_due_on: nullable(values.renewal_due_on),
    status: values.status,
    storage_provider: "external",
    notes: nullable(values.notes),
  };
}

function eventValues(event?: IntellectualPropertyEvent) {
  return {
    event_type: event?.event_type ?? "filing",
    event_status: event?.event_status ?? "planned",
    occurred_on: event?.occurred_on ?? "",
    due_date: event?.due_date ?? "",
    protocol: event?.protocol ?? "",
    authority: event?.authority ?? "",
    reason: event?.reason ?? "",
    evidence_reference: event?.evidence_reference ?? "",
  };
}

function buildEventPayload(values: ReturnType<typeof eventValues>) {
  const nullable = (value: string) => value.trim() || null;
  if (!values.event_type) throw new Error("Selecione o tipo do evento.");
  return {
    event_type: values.event_type,
    event_status: values.event_status,
    occurred_on: nullable(values.occurred_on),
    due_date: nullable(values.due_date),
    protocol: nullable(values.protocol),
    authority: nullable(values.authority),
    reason: nullable(values.reason),
    evidence_reference: nullable(values.evidence_reference),
  };
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<readonly [string, string]>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map(([key, labelValue]) => (
            <SelectItem key={key} value={key}>
              {labelValue}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
