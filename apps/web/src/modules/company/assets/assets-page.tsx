import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, FileCheck2, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { EmptyRow, Kpi, PageHeader, StatusPill } from "@/shared/components/ui-kit";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  applyAssetEvent,
  createAsset,
  createAssetEvent,
  decideAssetEvent,
  deleteAsset,
  deleteAssetEvent,
  listAssetsWorkspace,
  submitAssetEvent,
  updateAsset,
  updateAssetEvent,
} from "./api";
import type { AssetEvent, CorporateAsset } from "./types";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_CATEGORY_TYPES,
  ASSET_TYPE_LABELS,
  type AssetCategory,
  type AssetType,
} from "./asset-classification";

const fieldClass = "h-9 w-full rounded-sm border bg-background px-3 text-sm";
const money = (value: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value || 0));
const localDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "—";

type ConfirmState = {
  title: string;
  description: string;
  action: () => Promise<unknown>;
  destructive?: boolean;
} | null;
type ReasonState = {
  title: string;
  description: string;
  action: (reason: string) => Promise<unknown>;
} | null;
type DetailState = { title: string; content: ReactNode } | null;

interface AssetForm {
  legal_entity_id: string;
  business_unit_id: string;
  product_id: string;
  service_line_id: string;
  project_id: string;
  supplier_party_id: string;
  contract_id: string;
  acquisition_document_id: string;
  custodian_user_id: string;
  code: string;
  name: string;
  description: string;
  asset_category: AssetCategory;
  asset_type: AssetType;
  asset_tag: string;
  serial_number: string;
  quantity: string;
  currency_code: string;
  acquisition_cost: string;
  current_value: string;
  depreciation_method: string;
  useful_life_months: string;
  acquired_on: string;
  in_service_on: string;
  warranty_until: string;
  renewal_date: string;
  expires_on: string;
  status: string;
  storage_location: string;
  external_reference: string;
  storage_object_key: string;
  checksum_sha256: string;
  notes: string;
}

interface EventForm {
  asset_id: string;
  event_type: string;
  occurred_on: string;
  to_business_unit_id: string;
  to_custodian_user_id: string;
  to_location: string;
  financial_document_id: string;
  currency_code: string;
  amount: string;
  reason: string;
  evidence_reference: string;
}

const emptyAsset: AssetForm = {
  legal_entity_id: "",
  business_unit_id: "",
  product_id: "",
  service_line_id: "",
  project_id: "",
  supplier_party_id: "",
  contract_id: "",
  acquisition_document_id: "",
  custodian_user_id: "",
  code: "",
  name: "",
  description: "",
  asset_category: "equipment",
  asset_type: "equipment",
  asset_tag: "",
  serial_number: "",
  quantity: "1",
  currency_code: "BRL",
  acquisition_cost: "0",
  current_value: "0",
  depreciation_method: "none",
  useful_life_months: "",
  acquired_on: "",
  in_service_on: "",
  warranty_until: "",
  renewal_date: "",
  expires_on: "",
  status: "planned",
  storage_location: "",
  external_reference: "",
  storage_object_key: "",
  checksum_sha256: "",
  notes: "",
};

const emptyEvent: EventForm = {
  asset_id: "",
  event_type: "assignment",
  occurred_on: "",
  to_business_unit_id: "",
  to_custodian_user_id: "",
  to_location: "",
  financial_document_id: "",
  currency_code: "BRL",
  amount: "",
  reason: "",
  evidence_reference: "",
};

export function AssetsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["assets-workspace"], queryFn: listAssetsWorkspace });
  const data = query.data;
  const [search, setSearch] = useState("");
  const [assetOpen, setAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CorporateAsset | null>(null);
  const [assetForm, setAssetForm] = useState<AssetForm>(emptyAsset);
  const [eventOpen, setEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AssetEvent | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(emptyEvent);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [reasonDialog, setReasonDialog] = useState<ReasonState>(null);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState<DetailState>(null);

  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assets-workspace"] });
      toast.success("Operação concluída.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha na operação."),
  });
  const run = (action: () => Promise<unknown>, close?: () => void) =>
    mutation.mutateAsync(action).then(() => close?.());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!data) return { assets: [], events: [] };
    return {
      assets: data.assets.filter((row) =>
        [
          row.code,
          row.name,
          ASSET_CATEGORY_LABELS[row.asset_category],
          ASSET_TYPE_LABELS[row.asset_type],
          row.asset_tag,
          row.serial_number,
          row.storage_location,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term),
      ),
      events: data.assetEvents.filter((row) =>
        [row.event_type, row.reason, row.status, row.evidence_reference]
          .join(" ")
          .toLowerCase()
          .includes(term),
      ),
    };
  }, [data, search]);

  if (query.error) return <p className="p-6 text-sm text-destructive">{query.error.message}</p>;
  if (query.isLoading || !data) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando ativos...</p>;
  }

  const optionName = (items: { id: string; name: string }[], id: string | null) =>
    id ? (items.find((row) => row.id === id)?.name ?? id.slice(0, 8)) : "—";
  const unitName = (id: string | null) => optionName(data.businessUnits, id);
  const profileName = (id: string | null) => optionName(data.profiles, id);
  const assetName = (id: string) =>
    data.assets.find((row) => row.id === id)?.name ?? id.slice(0, 8);
  const eventsFor = (assetId: string) => data.assetEvents.filter((row) => row.asset_id === assetId);

  const openAsset = (row?: CorporateAsset) => {
    setEditingAsset(row ?? null);
    setAssetForm(
      row
        ? {
            legal_entity_id: row.legal_entity_id,
            business_unit_id: row.business_unit_id ?? "",
            product_id: row.product_id ?? "",
            service_line_id: row.service_line_id ?? "",
            project_id: row.project_id ?? "",
            supplier_party_id: row.supplier_party_id ?? "",
            contract_id: row.contract_id ?? "",
            acquisition_document_id: row.acquisition_document_id ?? "",
            custodian_user_id: row.custodian_user_id ?? "",
            code: row.code,
            name: row.name,
            description: row.description ?? "",
            asset_category: row.asset_category,
            asset_type: row.asset_type,
            asset_tag: row.asset_tag ?? "",
            serial_number: row.serial_number ?? "",
            quantity: String(row.quantity),
            currency_code: row.currency_code,
            acquisition_cost: String(row.acquisition_cost),
            current_value: String(row.current_value),
            depreciation_method: row.depreciation_method,
            useful_life_months: row.useful_life_months ? String(row.useful_life_months) : "",
            acquired_on: row.acquired_on ?? "",
            in_service_on: row.in_service_on ?? "",
            warranty_until: row.warranty_until ?? "",
            renewal_date: row.renewal_date ?? "",
            expires_on: row.expires_on ?? "",
            status: row.status,
            storage_location: row.storage_location ?? "",
            external_reference: row.external_reference ?? "",
            storage_object_key: row.storage_object_key ?? "",
            checksum_sha256: row.checksum_sha256 ?? "",
            notes: row.notes ?? "",
          }
        : {
            ...emptyAsset,
            legal_entity_id: data.legalEntities[0]?.id ?? "",
            business_unit_id: data.businessUnits.find((unit) => unit.status === "active")?.id ?? "",
          },
    );
    setAssetOpen(true);
  };

  const openEvent = (assetId: string, row?: AssetEvent) => {
    const asset = data.assets.find((item) => item.id === assetId);
    setEditingEvent(row ?? null);
    setEventForm(
      row
        ? {
            asset_id: row.asset_id,
            event_type: row.event_type,
            occurred_on: row.occurred_on,
            to_business_unit_id: row.to_business_unit_id ?? "",
            to_custodian_user_id: row.to_custodian_user_id ?? "",
            to_location: row.to_location ?? "",
            financial_document_id: row.financial_document_id ?? "",
            currency_code: row.currency_code ?? asset?.currency_code ?? "BRL",
            amount: row.amount === null ? "" : String(row.amount),
            reason: row.reason,
            evidence_reference: row.evidence_reference ?? "",
          }
        : {
            ...emptyEvent,
            asset_id: assetId,
            currency_code: asset?.currency_code ?? "BRL",
            occurred_on: new Date().toISOString().slice(0, 10),
          },
    );
    setEventOpen(true);
  };

  const detailRows = (rows: [string, ReactNode][]) => (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-sm border p-3">
          <dt className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {label}
          </dt>
          <dd className="mt-1 text-sm break-words">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );

  const activeAssets = data.assets.filter((row) => row.status === "active");
  const pendingEvents = data.assetEvents.filter((row) => row.status === "pending_approval");
  const renewalLimit = new Date();
  renewalLimit.setDate(renewalLimit.getDate() + 60);
  const expiring = data.assets.filter(
    (row) =>
      row.expires_on && new Date(row.expires_on) <= renewalLimit && row.status !== "disposed",
  );

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Patrimônio e Licenças"
        description="Ativos físicos, equipamentos e licenças administrativas com custódia, aquisição, garantia, renovação e validade. Marcas e direitos intelectuais pertencem a Propriedade Intelectual."
      />
      <div className="rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Fronteira financeira:</strong> este cadastro controla o bem, a custódia ou a licença
        administrativa. Mensalidades de Supabase, Vercel, hosting, APIs, gateways e outros serviços
        operacionais continuam sendo despesas da unidade no Financeiro; registrá-las aqui não cria
        nem duplica custo.
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Ativos cadastrados" value={String(data.assets.length)} />
        <Kpi label="Ativos em uso" value={String(activeAssets.length)} />
        <Kpi label="Eventos para aprovação" value={String(pendingEvents.length)} />
        <Kpi label="Vencimentos em 60 dias" value={String(expiring.length)} />
      </div>
      <Input
        className="max-w-md"
        placeholder="Buscar código, ativo, categoria ou local"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">Ativos</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
        </TabsList>
        <TabsContent value="assets" className="rounded-sm border">
          <TableHeader
            title="Cadastro patrimonial"
            action={
              <Button size="sm" onClick={() => openAsset()}>
                <Plus className="h-4 w-4" /> Criar
              </Button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <Th>Código / ativo</Th>
                  <Th>Categoria</Th>
                  <Th>Unidade</Th>
                  <Th>Custódia</Th>
                  <Th>Valor atual</Th>
                  <Th>Renovação / validade</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.assets.length === 0 && (
                  <EmptyRow colSpan={8} label="Nenhum ativo encontrado." />
                )}
                {filtered.assets.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <Td>
                      <strong>{row.code}</strong>
                      <div>{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.asset_tag || row.serial_number || "Sem etiqueta"}
                      </div>
                    </Td>
                    <Td>
                      {ASSET_CATEGORY_LABELS[row.asset_category]}
                      <span className="block text-xs text-muted-foreground">
                        {ASSET_TYPE_LABELS[row.asset_type]}
                      </span>
                    </Td>
                    <Td>{unitName(row.business_unit_id)}</Td>
                    <Td>{profileName(row.custodian_user_id)}</Td>
                    <Td>{money(row.current_value, row.currency_code)}</Td>
                    <Td>{localDate(row.renewal_date || row.expires_on)}</Td>
                    <Td>
                      <StatusPill status={row.status} />
                    </Td>
                    <Td>
                      <ActionRow>
                        <IconButton
                          label="Ver"
                          onClick={() =>
                            setDetail({
                              title: row.name,
                              content: (
                                <div className="space-y-4">
                                  {detailRows([
                                    ["Código", row.code],
                                    ["Categoria", ASSET_CATEGORY_LABELS[row.asset_category]],
                                    ["Tipo técnico", ASSET_TYPE_LABELS[row.asset_type]],
                                    ["Unidade", unitName(row.business_unit_id)],
                                    ["Custodiante", profileName(row.custodian_user_id)],
                                    ["Local", row.storage_location],
                                    ["Aquisição", localDate(row.acquired_on)],
                                    ["Custo", money(row.acquisition_cost, row.currency_code)],
                                    ["Valor atual", money(row.current_value, row.currency_code)],
                                    ["Garantia", localDate(row.warranty_until)],
                                    ["Renovação", localDate(row.renewal_date)],
                                    ["Validade", localDate(row.expires_on)],
                                    ["Referência", row.external_reference],
                                    ["Objeto", row.storage_object_key],
                                    ["Notas", row.notes],
                                  ])}
                                  <div>
                                    <h3 className="mb-2 font-semibold">Eventos</h3>
                                    {eventsFor(row.id).map((event) => (
                                      <div
                                        key={event.id}
                                        className="flex items-center justify-between border-b py-2"
                                      >
                                        <span>
                                          {localDate(event.occurred_on)} · {event.event_type} ·{" "}
                                          {event.status}
                                        </span>
                                        {event.status === "draft" && (
                                          <IconButton
                                            label="Editar evento"
                                            onClick={() => {
                                              setDetail(null);
                                              openEvent(row.id, event);
                                            }}
                                          >
                                            <Pencil />
                                          </IconButton>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ),
                            })
                          }
                        >
                          <Eye />
                        </IconButton>
                        {!["disposed", "cancelled"].includes(row.status) && (
                          <IconButton label="Editar" onClick={() => openAsset(row)}>
                            <Pencil />
                          </IconButton>
                        )}
                        {!["disposed", "cancelled"].includes(row.status) && (
                          <IconButton label="Criar evento" onClick={() => openEvent(row.id)}>
                            <Plus />
                          </IconButton>
                        )}
                        {row.status === "planned" && eventsFor(row.id).length === 0 && (
                          <IconButton
                            label="Excluir"
                            destructive
                            onClick={() =>
                              setConfirm({
                                title: "Excluir ativo",
                                description: "O ativo planejado sem eventos será removido.",
                                action: () => deleteAsset(row.id),
                                destructive: true,
                              })
                            }
                          >
                            <Trash2 />
                          </IconButton>
                        )}
                      </ActionRow>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="events" className="rounded-sm border">
          <TableHeader title="Eventos patrimoniais" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <Th>Ativo</Th>
                  <Th>Evento</Th>
                  <Th>Data</Th>
                  <Th>Valor</Th>
                  <Th>Motivo</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.events.length === 0 && (
                  <EmptyRow colSpan={7} label="Nenhum evento encontrado." />
                )}
                {filtered.events.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <Td>{assetName(row.asset_id)}</Td>
                    <Td>{row.event_type}</Td>
                    <Td>{localDate(row.occurred_on)}</Td>
                    <Td>
                      {row.amount === null ? "—" : money(row.amount, row.currency_code ?? "BRL")}
                    </Td>
                    <Td>{row.reason}</Td>
                    <Td>
                      <StatusPill status={row.status} />
                    </Td>
                    <Td>
                      <ActionRow>
                        <IconButton
                          label="Ver"
                          onClick={() =>
                            setDetail({
                              title: "Evento patrimonial",
                              content: detailRows([
                                ["Ativo", assetName(row.asset_id)],
                                ["Tipo", row.event_type],
                                ["Data", localDate(row.occurred_on)],
                                ["Unidade de destino", unitName(row.to_business_unit_id)],
                                ["Custodiante de destino", profileName(row.to_custodian_user_id)],
                                ["Local de destino", row.to_location],
                                [
                                  "Valor",
                                  row.amount === null
                                    ? null
                                    : money(row.amount, row.currency_code ?? "BRL"),
                                ],
                                ["Motivo", row.reason],
                                ["Evidência", row.evidence_reference],
                                ["Decisão", row.decision_reason],
                              ]),
                            })
                          }
                        >
                          <Eye />
                        </IconButton>
                        {row.status === "draft" && (
                          <IconButton label="Editar" onClick={() => openEvent(row.asset_id, row)}>
                            <Pencil />
                          </IconButton>
                        )}
                        {row.status === "draft" && (
                          <IconButton
                            label="Submeter"
                            onClick={() =>
                              setConfirm({
                                title: "Submeter evento",
                                description:
                                  "Os dados do evento ficarão congelados para aprovação.",
                                action: () => submitAssetEvent(row.id, row.version),
                              })
                            }
                          >
                            <Send />
                          </IconButton>
                        )}
                        {row.status === "pending_approval" && (
                          <IconButton
                            label="Aprovar"
                            onClick={() =>
                              setConfirm({
                                title: "Aprovar evento",
                                description:
                                  "O aprovador deve ser diferente do criador e solicitante.",
                                action: () => decideAssetEvent(row.id, row.version, true),
                              })
                            }
                          >
                            <Check />
                          </IconButton>
                        )}
                        {row.status === "pending_approval" && (
                          <IconButton
                            label="Rejeitar"
                            destructive
                            onClick={() => {
                              setReason("");
                              setReasonDialog({
                                title: "Rejeitar evento",
                                description: "Informe o motivo da rejeição.",
                                action: (text) =>
                                  decideAssetEvent(row.id, row.version, false, text),
                              });
                            }}
                          >
                            <X />
                          </IconButton>
                        )}
                        {row.status === "approved" && (
                          <IconButton
                            label="Aplicar evento"
                            onClick={() =>
                              setConfirm({
                                title: "Aplicar evento",
                                description:
                                  "O cadastro patrimonial será atualizado conforme o evento aprovado.",
                                action: () => applyAssetEvent(row.id, row.version),
                              })
                            }
                          >
                            <FileCheck2 />
                          </IconButton>
                        )}
                        {row.status === "draft" && (
                          <IconButton
                            label="Excluir"
                            destructive
                            onClick={() =>
                              setConfirm({
                                title: "Excluir evento",
                                description: "O evento em rascunho será removido.",
                                action: () => deleteAssetEvent(row.id),
                                destructive: true,
                              })
                            }
                          >
                            <Trash2 />
                          </IconButton>
                        )}
                      </ActionRow>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Editar ativo" : "Criar ativo"}</DialogTitle>
            <DialogDescription>
              Classifique somente um bem, licença ou registro administrativo real. Valores servem ao
              controle patrimonial e não substituem o lançamento financeiro da despesa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Pessoa jurídica">
              <select
                className={fieldClass}
                value={assetForm.legal_entity_id}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, legal_entity_id: event.target.value })
                }
              >
                {data.legalEntities.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unidade">
              <select
                className={fieldClass}
                value={assetForm.business_unit_id}
                onChange={(event) =>
                  setAssetForm({
                    ...assetForm,
                    business_unit_id: event.target.value,
                    product_id: "",
                    service_line_id: "",
                    project_id: "",
                  })
                }
              >
                <option value="">Corporativo geral</option>
                {data.businessUnits
                  .filter((row) => row.status === "active")
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Categoria">
              <select
                className={fieldClass}
                value={assetForm.asset_category}
                onChange={(event) => {
                  const asset_category = event.target.value as AssetCategory;
                  setAssetForm({
                    ...assetForm,
                    asset_category,
                    asset_type: ASSET_CATEGORY_TYPES[asset_category][0],
                  });
                }}
              >
                {(Object.keys(ASSET_CATEGORY_TYPES) as AssetCategory[]).map((value) => (
                  <option key={value} value={value}>
                    {ASSET_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo técnico">
              <select
                className={fieldClass}
                value={assetForm.asset_type}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, asset_type: event.target.value as AssetType })
                }
              >
                {ASSET_CATEGORY_TYPES[assetForm.asset_category].map((value) => (
                  <option key={value} value={value}>
                    {ASSET_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Produto">
              <select
                className={fieldClass}
                value={assetForm.product_id}
                onChange={(event) =>
                  setAssetForm({
                    ...assetForm,
                    product_id: event.target.value,
                    service_line_id: "",
                  })
                }
              >
                <option value="">Nenhum</option>
                {data.products
                  .filter((row) => row.business_unit_id === assetForm.business_unit_id)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Linha de serviço">
              <select
                className={fieldClass}
                value={assetForm.service_line_id}
                onChange={(event) =>
                  setAssetForm({
                    ...assetForm,
                    service_line_id: event.target.value,
                    product_id: "",
                  })
                }
              >
                <option value="">Nenhuma</option>
                {data.serviceLines
                  .filter((row) => row.business_unit_id === assetForm.business_unit_id)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Projeto">
              <select
                className={fieldClass}
                value={assetForm.project_id}
                onChange={(event) => setAssetForm({ ...assetForm, project_id: event.target.value })}
              >
                <option value="">Nenhum</option>
                {data.projects
                  .filter((row) => row.business_unit_id === assetForm.business_unit_id)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Código">
              <Input
                placeholder="AST_NOTEBOOK_001"
                value={assetForm.code}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, code: event.target.value.toUpperCase() })
                }
              />
            </Field>
            <Field label="Nome" className="lg:col-span-2">
              <Input
                value={assetForm.name}
                onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })}
              />
            </Field>
            <Field label="Fornecedor">
              <select
                className={fieldClass}
                value={assetForm.supplier_party_id}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, supplier_party_id: event.target.value })
                }
              >
                <option value="">Nenhum</option>
                {data.parties.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contrato">
              <select
                className={fieldClass}
                value={assetForm.contract_id}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, contract_id: event.target.value })
                }
              >
                <option value="">Nenhum</option>
                {data.contracts.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code} — {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Documento de aquisição">
              <select
                className={fieldClass}
                value={assetForm.acquisition_document_id}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, acquisition_document_id: event.target.value })
                }
              >
                <option value="">Nenhum</option>
                {data.financialDocuments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Custodiante">
              <select
                className={fieldClass}
                value={assetForm.custodian_user_id}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, custodian_user_id: event.target.value })
                }
              >
                <option value="">Nenhum</option>
                {data.profiles
                  .filter((row) => row.status === "active")
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Etiqueta">
              <Input
                value={assetForm.asset_tag}
                onChange={(event) => setAssetForm({ ...assetForm, asset_tag: event.target.value })}
              />
            </Field>
            <Field label="Número de série">
              <Input
                value={assetForm.serial_number}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, serial_number: event.target.value })
                }
              />
            </Field>
            <Field label="Quantidade">
              <Input
                type="number"
                min="0.0001"
                step="0.0001"
                value={assetForm.quantity}
                onChange={(event) => setAssetForm({ ...assetForm, quantity: event.target.value })}
              />
            </Field>
            <Field label="Moeda">
              <select
                className={fieldClass}
                value={assetForm.currency_code}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, currency_code: event.target.value })
                }
              >
                {data.currencies
                  .filter((row) => row.status === "active")
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Custo de aquisição">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={assetForm.acquisition_cost}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, acquisition_cost: event.target.value })
                }
              />
            </Field>
            <Field label="Valor atual">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={assetForm.current_value}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, current_value: event.target.value })
                }
              />
            </Field>
            <Field label="Depreciação">
              <select
                className={fieldClass}
                value={assetForm.depreciation_method}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, depreciation_method: event.target.value })
                }
              >
                <option value="none">Sem depreciação</option>
                <option value="straight_line">Linear</option>
                <option value="manual">Manual</option>
              </select>
            </Field>
            <Field label="Vida útil (meses)">
              <Input
                type="number"
                min="1"
                value={assetForm.useful_life_months}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, useful_life_months: event.target.value })
                }
              />
            </Field>
            <Field label="Aquisição">
              <Input
                type="date"
                value={assetForm.acquired_on}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, acquired_on: event.target.value })
                }
              />
            </Field>
            <Field label="Início de uso">
              <Input
                type="date"
                value={assetForm.in_service_on}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, in_service_on: event.target.value })
                }
              />
            </Field>
            <Field label="Garantia até">
              <Input
                type="date"
                value={assetForm.warranty_until}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, warranty_until: event.target.value })
                }
              />
            </Field>
            <Field label="Renovação">
              <Input
                type="date"
                value={assetForm.renewal_date}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, renewal_date: event.target.value })
                }
              />
            </Field>
            <Field label="Validade">
              <Input
                type="date"
                value={assetForm.expires_on}
                onChange={(event) => setAssetForm({ ...assetForm, expires_on: event.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                className={fieldClass}
                value={assetForm.status}
                onChange={(event) => setAssetForm({ ...assetForm, status: event.target.value })}
              >
                {["planned", "active", "maintenance", "suspended", "expired"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Local">
              <Input
                value={assetForm.storage_location}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, storage_location: event.target.value })
                }
              />
            </Field>
            <Field label="Referência externa">
              <Input
                value={assetForm.external_reference}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, external_reference: event.target.value })
                }
              />
            </Field>
            <Field label="Objeto no storage">
              <Input
                value={assetForm.storage_object_key}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, storage_object_key: event.target.value })
                }
              />
            </Field>
            <Field label="Checksum SHA-256" className="lg:col-span-2">
              <Input
                value={assetForm.checksum_sha256}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, checksum_sha256: event.target.value })
                }
              />
            </Field>
            <Field label="Descrição" className="sm:col-span-2 lg:col-span-3">
              <Textarea
                value={assetForm.description}
                onChange={(event) =>
                  setAssetForm({ ...assetForm, description: event.target.value })
                }
              />
            </Field>
            <Field label="Notas" className="sm:col-span-2 lg:col-span-3">
              <Textarea
                value={assetForm.notes}
                onChange={(event) => setAssetForm({ ...assetForm, notes: event.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!assetForm.code || !assetForm.name || mutation.isPending}
              onClick={() =>
                run(
                  () => {
                    const values = {
                      ...assetForm,
                      business_unit_id: assetForm.business_unit_id || null,
                      product_id: assetForm.product_id || null,
                      service_line_id: assetForm.service_line_id || null,
                      project_id: assetForm.project_id || null,
                      supplier_party_id: assetForm.supplier_party_id || null,
                      contract_id: assetForm.contract_id || null,
                      acquisition_document_id: assetForm.acquisition_document_id || null,
                      custodian_user_id: assetForm.custodian_user_id || null,
                      description: assetForm.description || null,
                      asset_tag: assetForm.asset_tag || null,
                      serial_number: assetForm.serial_number || null,
                      quantity: Number(assetForm.quantity),
                      acquisition_cost: Number(assetForm.acquisition_cost),
                      current_value: Number(assetForm.current_value),
                      useful_life_months: assetForm.useful_life_months
                        ? Number(assetForm.useful_life_months)
                        : null,
                      acquired_on: assetForm.acquired_on || null,
                      in_service_on: assetForm.in_service_on || null,
                      warranty_until: assetForm.warranty_until || null,
                      renewal_date: assetForm.renewal_date || null,
                      expires_on: assetForm.expires_on || null,
                      storage_location: assetForm.storage_location || null,
                      external_reference: assetForm.external_reference || null,
                      storage_object_key: assetForm.storage_object_key || null,
                      checksum_sha256: assetForm.checksum_sha256 || null,
                      notes: assetForm.notes || null,
                    };
                    return editingAsset
                      ? updateAsset(editingAsset.id, editingAsset.version, values)
                      : createAsset(values);
                  },
                  () => setAssetOpen(false),
                )
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar evento" : "Criar evento"}</DialogTitle>
            <DialogDescription>
              O evento será submetido, aprovado por outro usuário e somente então aplicado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ativo">
              <select className={fieldClass} disabled value={eventForm.asset_id}>
                <option value={eventForm.asset_id}>{assetName(eventForm.asset_id)}</option>
              </select>
            </Field>
            <Field label="Tipo">
              <select
                className={fieldClass}
                value={eventForm.event_type}
                onChange={(event) => setEventForm({ ...eventForm, event_type: event.target.value })}
              >
                {[
                  "acquisition",
                  "assignment",
                  "transfer",
                  "maintenance",
                  "renewal",
                  "impairment",
                  "inventory_check",
                  "suspension",
                  "reactivation",
                  "disposal",
                  "note",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Data">
              <Input
                type="date"
                value={eventForm.occurred_on}
                onChange={(event) =>
                  setEventForm({ ...eventForm, occurred_on: event.target.value })
                }
              />
            </Field>
            <Field label="Unidade de destino">
              <select
                className={fieldClass}
                value={eventForm.to_business_unit_id}
                onChange={(event) =>
                  setEventForm({ ...eventForm, to_business_unit_id: event.target.value })
                }
              >
                <option value="">Nenhuma</option>
                {data.businessUnits.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Custodiante de destino">
              <select
                className={fieldClass}
                value={eventForm.to_custodian_user_id}
                onChange={(event) =>
                  setEventForm({ ...eventForm, to_custodian_user_id: event.target.value })
                }
              >
                <option value="">Nenhum</option>
                {data.profiles.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Local de destino">
              <Input
                value={eventForm.to_location}
                onChange={(event) =>
                  setEventForm({ ...eventForm, to_location: event.target.value })
                }
              />
            </Field>
            <Field label="Documento financeiro">
              <select
                className={fieldClass}
                value={eventForm.financial_document_id}
                onChange={(event) =>
                  setEventForm({ ...eventForm, financial_document_id: event.target.value })
                }
              >
                <option value="">Nenhum</option>
                {data.financialDocuments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={eventForm.amount}
                onChange={(event) => setEventForm({ ...eventForm, amount: event.target.value })}
              />
            </Field>
            <Field label="Motivo" className="sm:col-span-2">
              <Textarea
                value={eventForm.reason}
                onChange={(event) => setEventForm({ ...eventForm, reason: event.target.value })}
              />
            </Field>
            <Field label="Evidência" className="sm:col-span-2">
              <Input
                value={eventForm.evidence_reference}
                onChange={(event) =>
                  setEventForm({ ...eventForm, evidence_reference: event.target.value })
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !eventForm.occurred_on || eventForm.reason.trim().length < 3 || mutation.isPending
              }
              onClick={() =>
                run(
                  () => {
                    const asset = data.assets.find((row) => row.id === eventForm.asset_id);
                    const values = {
                      asset_id: eventForm.asset_id,
                      event_type: eventForm.event_type,
                      occurred_on: eventForm.occurred_on,
                      from_business_unit_id:
                        editingEvent?.from_business_unit_id ?? asset?.business_unit_id ?? null,
                      to_business_unit_id: eventForm.to_business_unit_id || null,
                      from_custodian_user_id:
                        editingEvent?.from_custodian_user_id ?? asset?.custodian_user_id ?? null,
                      to_custodian_user_id: eventForm.to_custodian_user_id || null,
                      from_location: editingEvent?.from_location ?? asset?.storage_location ?? null,
                      to_location: eventForm.to_location || null,
                      financial_document_id: eventForm.financial_document_id || null,
                      currency_code: eventForm.amount ? eventForm.currency_code : null,
                      amount: eventForm.amount ? Number(eventForm.amount) : null,
                      reason: eventForm.reason,
                      evidence_reference: eventForm.evidence_reference || null,
                    };
                    return editingEvent
                      ? updateAssetEvent(editingEvent.id, editingEvent.version, values)
                      : createAssetEvent(values);
                  },
                  () => setEventOpen(false),
                )
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
          </DialogHeader>
          {detail?.content}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirm?.destructive ? "destructive" : "default"}
              disabled={mutation.isPending}
              onClick={() => confirm && run(confirm.action, () => setConfirm(null))}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(reasonDialog)} onOpenChange={(open) => !open && setReasonDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonDialog?.title}</DialogTitle>
            <DialogDescription>{reasonDialog?.description}</DialogDescription>
          </DialogHeader>
          <Field label="Motivo">
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || mutation.isPending}
              onClick={() =>
                reasonDialog &&
                run(
                  () => reasonDialog.action(reason.trim()),
                  () => setReasonDialog(null),
                )
              }
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TableHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action}
    </div>
  );
}
function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1">{children}</div>;
}
function IconButton({
  label,
  children,
  onClick,
  destructive = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={destructive ? "destructive" : "ghost"}
      className="h-8 w-8"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
