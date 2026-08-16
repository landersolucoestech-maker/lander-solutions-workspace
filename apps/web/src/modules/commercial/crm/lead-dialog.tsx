import { useMemo, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { Check, LoaderCircle, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { SortableTableHeader } from "@/shared/components/sortable-table-header";
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
import {
  createLead,
  createLeadDiagnosticRequest,
  deleteLead,
  replaceLeadServices,
  updateLead,
} from "./api";
import type { CrmDirectory, CrmLead, CrmLeadPriority, CrmLeadSource, CrmLeadStatus } from "./types";
import { nextTableSort, sortTableRows, type TableSort } from "./table-sorting";
import { buildLeadViewRelationships } from "./lead-view-model";

export type LeadAction =
  { action: "create" } | { action: "view" | "edit" | "destroy"; leadId: string } | null;

type ResolvedLeadAction =
  { action: "create" } | { action: "view" | "edit" | "destroy"; record: CrmLead };

type LeadType = CrmLead["lead_type"];
type CompanySize = NonNullable<CrmLead["company_size"]>;
type ContactPreference = NonNullable<CrmLead["contact_preference"]>;

type LeadFormState = {
  businessUnitId: string;
  leadType: LeadType | null;
  fullName: string;
  cpf: string;
  birthDate: string;
  professionActivity: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  segment: string;
  companySize: CompanySize | "";
  website: string;
  contactName: string;
  contactRole: string;
  phone: string;
  whatsapp: string;
  email: string;
  city: string;
  stateRegion: string;
  selectedServiceKeys: string[];
  primaryServiceKey: string;
  customServiceName: string;
  needSummary: string;
  contactPreference: ContactPreference | "";
  bestContactTime: string;
  source: CrmLeadSource;
  campaign: string;
  referredBy: string;
  status: CrmLeadStatus;
  priority: CrmLeadPriority;
  ownerUserId: string;
  lastContactAt: string;
  nextAction: string;
  nextActionAt: string;
  notes: string;
};

const OTHER_SERVICE_KEY = "other";
const LANDER_SERVICES_CODE = "LANDERSERVICES";

type DiagnosticSortKey = "sentAt" | "mode" | "service" | "status" | "reference";

const diagnosticHeaders: Array<{ key: DiagnosticSortKey; label: string }> = [
  { key: "sentAt", label: "Enviado em" },
  { key: "mode", label: "Modalidade" },
  { key: "service", label: "Serviço" },
  { key: "status", label: "Status" },
  { key: "reference", label: "Referência" },
];

export function LeadDialog({
  state,
  directory,
  canConvert,
  canManage,
  onClose,
  onChanged,
  onConvert,
  onEdit,
}: {
  state: LeadAction;
  directory: CrmDirectory;
  canConvert: boolean;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onConvert: (lead: CrmLead) => void;
  onEdit: (lead: CrmLead) => void;
}) {
  if (!state) return null;
  const record =
    state.action === "create"
      ? null
      : (directory.leads.find((lead) => lead.id === state.leadId) ?? null);
  if (state.action !== "create" && !record) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead não encontrado</DialogTitle>
            <DialogDescription>
              O cadastro selecionado não está mais disponível no diretório atual.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  const resolvedState: ResolvedLeadAction =
    state.action === "create" ? state : { action: state.action, record: record! };
  return (
    <LeadDialogBody
      key={record ? `${record.id}-${record.version}-${state.action}` : "new-lead"}
      state={resolvedState}
      directory={directory}
      canConvert={canConvert}
      canManage={canManage}
      onClose={onClose}
      onChanged={onChanged}
      onConvert={onConvert}
      onEdit={onEdit}
    />
  );
}

function LeadDialogBody({
  state,
  directory,
  canConvert,
  canManage,
  onClose,
  onChanged,
  onConvert,
  onEdit,
}: {
  state: ResolvedLeadAction;
  directory: CrmDirectory;
  canConvert: boolean;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onConvert: (lead: CrmLead) => void;
  onEdit: (lead: CrmLead) => void;
}) {
  const { user } = useAuth();
  const record = state.action === "create" ? null : state.record;
  const initialState = useMemo(
    () => buildInitialState(record, directory, user?.id ?? ""),
    [directory, record, user?.id],
  );
  const [form, setForm] = useState<LeadFormState>(initialState);
  const unitOptions = useMemo(
    () =>
      directory.businessUnits
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map((unit) => [unit.id, `${unit.code ?? "UNIDADE"} — ${unit.name}`] as const),
    [directory.businessUnits],
  );
  const officialServices = useMemo(
    () =>
      directory.serviceLines
        .filter(
          (service) =>
            service.business_unit_id === form.businessUnitId && service.code !== "OTHER_SERVICES",
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [directory.serviceLines, form.businessUnitId],
  );
  const [submitting, setSubmitting] = useState(false);
  const [diagnosticMode, setDiagnosticMode] = useState<"internal" | "external">("external");
  const [diagnosticUrl, setDiagnosticUrl] = useState("");
  const [diagnosticSubmitting, setDiagnosticSubmitting] = useState(false);
  const [diagnosticSort, setDiagnosticSort] = useState<TableSort<DiagnosticSortKey>>({
    key: "sentAt",
    direction: "desc",
  });

  if (directory.businessUnits.length === 0 && ["create", "edit"].includes(state.action)) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nenhuma unidade cadastrada</DialogTitle>
            <DialogDescription>
              Cadastre ao menos uma unidade no sistema antes de criar ou editar leads.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (state.action === "destroy") {
    return (
      <DeleteLeadDialog
        record={record}
        submitting={submitting}
        onClose={onClose}
        onConfirm={async () => {
          if (!record) return;
          setSubmitting(true);
          try {
            await deleteLead(record.id);
            await onChanged();
            toast.success("Lead excluído.");
            onClose();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao excluir o lead.");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    );
  }

  if (state.action === "view" && record) {
    const viewedLead = record;
    const selectedServices = directory.leadServices.filter((item) => item.lead_id === record.id);
    const diagnostics = sortTableRows(
      directory.leadDiagnostics.filter((item) => item.lead_id === record.id),
      diagnosticSort.direction,
      (item) => {
        switch (diagnosticSort.key) {
          case "sentAt":
            return Date.parse(item.sent_at);
          case "mode":
            return item.delivery_mode === "internal" ? "Interno" : "Externo";
          case "service":
            return serviceSelectionLabel(item.service_line_id, item.custom_service_name, directory);
          case "status":
            return diagnosticStatusLabel(item.status);
          case "reference":
            return item.form_url ?? "Solicitação interna";
        }
      },
    );
    const eligibleForDiagnostic = [
      "contacted",
      "qualifying",
      "qualified",
      "proposal_sent",
      "negotiation",
      "converted",
    ].includes(record.status);
    const primaryService = leadPrimaryServiceLabel(record, directory);
    const relationships = buildLeadViewRelationships(record, directory);

    async function submitDiagnostic() {
      if (diagnosticMode === "external" && !isValidUrl(diagnosticUrl)) {
        toast.error("Informe uma URL válida para o formulário externo.");
        return;
      }
      setDiagnosticSubmitting(true);
      try {
        await createLeadDiagnosticRequest({
          lead_id: viewedLead.id,
          service_line_id: viewedLead.service_line_id,
          custom_service_name: viewedLead.service_line_id ? null : viewedLead.primary_service_other,
          delivery_mode: diagnosticMode,
          form_url: diagnosticMode === "external" ? diagnosticUrl.trim() : null,
        });
        await onChanged();
        setDiagnosticUrl("");
        toast.success(
          diagnosticMode === "external"
            ? "Formulário externo registrado como enviado."
            : "Solicitação interna de diagnóstico criada.",
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao registrar o diagnóstico.");
      } finally {
        setDiagnosticSubmitting(false);
      }
    }

    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{leadDisplayName(record)}</DialogTitle>
            <DialogDescription>
              {record.lead_type === "person" ? "Pessoa física" : "Pessoa jurídica"} ·{" "}
              {leadStatusLabel(record.status)} · {leadPriorityLabel(record.priority)}
            </DialogDescription>
          </DialogHeader>

          <Section title="Contato">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info
                label="Contato relacionado"
                value={
                  record.converted_party_id ? relationships.relatedPartyName : record.contact_name
                }
              />
              <Info label="E-mail" value={record.email ?? "—"} />
              <Info label="Telefone" value={record.phone ?? "—"} />
              <Info label="CPF/CNPJ" value={formatTaxId(record.tax_id, record.lead_type)} />
            </div>
          </Section>

          <Section title="Comercial">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Serviço principal" value={primaryService} />
              <Info label="Origem" value={leadSourceLabel(record.source)} />
              <Info label="Unidade" value={relationships.unitName} />
              <Info label="Responsável" value={relationships.ownerName} />
              <Info
                label="Tipo"
                value={record.lead_type === "person" ? "Pessoa física" : "Pessoa jurídica"}
              />
              <Info label="Prioridade" value={leadPriorityLabel(record.priority)} />
              <Info label="Situação" value={leadStatusLabel(record.status)} />
              <Info label="Próximo contato" value={dateTimeLabel(record.next_action_at)} />
            </div>
            {selectedServices.length > 1 && (
              <Info
                label="Outros serviços de interesse"
                value={
                  selectedServices
                    .filter((item) => !item.is_primary)
                    .map((item) =>
                      serviceSelectionLabel(
                        item.service_line_id,
                        item.custom_service_name,
                        directory,
                      ),
                    )
                    .join(", ") || "—"
                }
              />
            )}
          </Section>

          <Section title="Contexto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Próxima ação" value={record.next_action ?? "—"} />
              <Info
                label="Preferência de contato"
                value={contactPreferenceLabel(record.contact_preference)}
              />
              <Info
                label="Cidade/Estado"
                value={[record.city, record.state_region].filter(Boolean).join(" / ") || "—"}
              />
              <Info label="Última interação" value={dateTimeLabel(record.last_interaction_at)} />
            </div>
            <Info label="Necessidade resumida" value={record.need_summary ?? "—"} />
            <Info label="Observações internas" value={record.notes ?? "—"} />
            <details className="rounded-sm border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Outros dados</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Info label="Criado em" value={dateTimeLabel(record.created_at)} />
                <Info label="Atualizado em" value={dateTimeLabel(record.updated_at)} />
              </div>
            </details>
          </Section>

          <Section title="Diagnóstico do serviço">
            {eligibleForDiagnostic ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  O diagnóstico é registrado separadamente e não adiciona requisitos técnicos ao
                  cadastro principal do lead.
                </p>
                <div className="grid gap-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
                  <SelectField
                    label="Modalidade"
                    value={diagnosticMode}
                    onChange={(value) => setDiagnosticMode(value as "internal" | "external")}
                    options={[
                      ["internal", "Formulário interno"],
                      ["external", "Formulário externo"],
                    ]}
                  />
                  {diagnosticMode === "external" ? (
                    <TextField
                      label="URL do formulário"
                      value={diagnosticUrl}
                      onChange={setDiagnosticUrl}
                      placeholder="https://..."
                      type="url"
                    />
                  ) : (
                    <div className="rounded-sm border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      A solicitação ficará registrada para preenchimento interno.
                    </div>
                  )}
                  <Button
                    type="button"
                    onClick={() => void submitDiagnostic()}
                    disabled={diagnosticSubmitting}
                  >
                    {diagnosticSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    {diagnosticMode === "external" ? "Registrar envio" : "Criar solicitação"}
                  </Button>
                </div>
                {diagnostics.length > 0 && (
                  <div className="overflow-x-auto rounded-sm border">
                    <table className="w-full min-w-[680px] text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {diagnosticHeaders.map(({ key, label }) => (
                            <SortableTableHeader
                              key={key}
                              label={label}
                              active={diagnosticSort.key === key}
                              direction={diagnosticSort.direction}
                              onSort={() =>
                                setDiagnosticSort((current) => nextTableSort(current, key))
                              }
                            />
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {diagnostics.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="px-3 py-2">{dateTimeLabel(item.sent_at)}</td>
                            <td className="px-3 py-2">
                              {item.delivery_mode === "internal" ? "Interno" : "Externo"}
                            </td>
                            <td className="px-3 py-2">
                              {serviceSelectionLabel(
                                item.service_line_id,
                                item.custom_service_name,
                                directory,
                              )}
                            </td>
                            <td className="px-3 py-2">{diagnosticStatusLabel(item.status)}</td>
                            <td className="max-w-64 truncate px-3 py-2">
                              {item.form_url ?? "Solicitação interna"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                O diagnóstico poderá ser enviado após o primeiro contato ou durante a qualificação.
              </p>
            )}
          </Section>

          <DialogFooter>
            {canManage && (
              <Button type="button" variant="outline" onClick={() => onEdit(record)}>
                Editar
              </Button>
            )}
            {canConvert && !record.converted_party_id && record.status !== "converted" && (
              <Button type="button" onClick={() => onConvert(record)}>
                Converter em contato
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function setField<K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeLeadType(nextType: LeadType) {
    if (form.leadType === nextType) return;
    if (form.leadType && hasTypeSpecificData(form, form.leadType)) {
      const confirmed = window.confirm(
        "Alterar o tipo de pessoa apagará os campos específicos já preenchidos. Deseja continuar?",
      );
      if (!confirmed) return;
    }
    setForm((current) => clearTypeSpecificFields({ ...current, leadType: nextType }, nextType));
  }

  function toggleService(key: string, checked: boolean) {
    setForm((current) => {
      const selectedServiceKeys = checked
        ? [...new Set([...current.selectedServiceKeys, key])]
        : current.selectedServiceKeys.filter((item) => item !== key);
      let primaryServiceKey = current.primaryServiceKey;
      if (!checked && primaryServiceKey === key) primaryServiceKey = selectedServiceKeys[0] ?? "";
      if (checked && !primaryServiceKey) primaryServiceKey = key;
      return {
        ...current,
        selectedServiceKeys,
        primaryServiceKey,
        customServiceName:
          key === OTHER_SERVICE_KEY || selectedServiceKeys.includes(OTHER_SERVICE_KEY)
            ? current.customServiceName
            : "",
      };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateForm(form);
    if (error) {
      toast.error(error);
      return;
    }
    if (!form.businessUnitId) {
      toast.error("Selecione a unidade responsável pelo lead.");
      return;
    }

    const primaryIsOther = form.primaryServiceKey === OTHER_SERVICE_KEY;
    const values: Record<string, unknown> = {
      business_unit_id: form.businessUnitId,
      product_id: null,
      converted_party_id: record?.converted_party_id ?? null,
      lead_type: form.leadType,
      contact_name: form.leadType === "person" ? form.fullName.trim() : form.contactName.trim(),
      email: emptyToNull(form.email),
      phone: emptyToNull(form.phone),
      whatsapp: emptyToNull(form.whatsapp),
      city: emptyToNull(form.city),
      state_region: emptyToNull(form.stateRegion.toUpperCase()),
      country_code: "BR",
      preferred_currency_code: "BRL",
      service_line_id: primaryIsOther ? null : form.primaryServiceKey,
      primary_service_other: primaryIsOther ? form.customServiceName.trim() : null,
      need_summary: emptyToNull(form.needSummary),
      contact_preference: form.contactPreference || null,
      best_contact_time: emptyToNull(form.bestContactTime),
      source: form.source,
      campaign: emptyToNull(form.campaign),
      referred_by: emptyToNull(form.referredBy),
      status: form.status,
      priority: form.priority,
      owner_user_id: form.ownerUserId,
      last_contact_at: localDateTimeToIso(form.lastContactAt),
      next_action: emptyToNull(form.nextAction),
      next_action_at: localDateTimeToIso(form.nextActionAt),
      notes: emptyToNull(form.notes),
      ...(form.leadType === "person"
        ? {
            company_name: null,
            trade_name: null,
            tax_id: onlyDigits(form.cpf),
            birth_date: emptyToNull(form.birthDate),
            profession_activity: emptyToNull(form.professionActivity),
            segment: null,
            company_size: null,
            website: null,
            contact_role: null,
          }
        : {
            company_name: emptyToNull(form.legalName),
            trade_name: emptyToNull(form.tradeName),
            tax_id: onlyDigits(form.cnpj),
            birth_date: null,
            profession_activity: null,
            segment: emptyToNull(form.segment),
            company_size: form.companySize || null,
            website: emptyToNull(form.website),
            contact_role: emptyToNull(form.contactRole),
          }),
    };

    setSubmitting(true);
    try {
      const saved = record
        ? await updateLead(record.id, record.version, values)
        : await createLead(values);
      await replaceLeadServices(
        saved.id,
        form.selectedServiceKeys.map((key) => ({
          service_line_id: key === OTHER_SERVICE_KEY ? null : key,
          custom_service_name: key === OTHER_SERVICE_KEY ? form.customServiceName.trim() : null,
          is_primary: key === form.primaryServiceKey,
        })),
      );
      await onChanged();
      toast.success(record ? "Lead atualizado." : "Lead criado.");
      onClose();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Falha ao salvar o lead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <form className="space-y-6" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{record ? "Editar lead" : "Novo lead"}</DialogTitle>
            <DialogDescription>
              Cadastro comercial inicial da LANDER SOLUTIONS. Selecione a unidade responsável; o
              diagnóstico técnico é realizado separadamente.
            </DialogDescription>
          </DialogHeader>

          <Section title="1. Tipo de pessoa">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Tipo de pessoa"
                value={form.leadType ?? ""}
                onChange={(value) => changeLeadType(value as LeadType)}
                required
                placeholder="Selecione o tipo de pessoa"
                options={[
                  ["person", "Pessoa física"],
                  ["organization", "Pessoa jurídica"],
                ]}
              />
              <SelectField
                label="Unidade"
                value={form.businessUnitId}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    businessUnitId: value,
                    selectedServiceKeys: [],
                    primaryServiceKey: "",
                    customServiceName: "",
                  }))
                }
                required
                placeholder="Selecione a unidade"
                options={unitOptions}
              />
            </div>

            {!form.leadType && (
              <p className="rounded-sm border border-dashed px-4 py-5 text-sm text-muted-foreground">
                Selecione o tipo de pessoa para exibir os campos de identificação correspondentes.
              </p>
            )}

            {form.leadType === "person" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Nome completo"
                  value={form.fullName}
                  onChange={(value) => setField("fullName", value)}
                  required
                />
                <TextField
                  label="CPF"
                  value={form.cpf}
                  onChange={(value) => setField("cpf", maskCpf(value))}
                  inputMode="numeric"
                  maxLength={14}
                />
                <TextField
                  label="Data de nascimento"
                  value={form.birthDate}
                  onChange={(value) => setField("birthDate", value)}
                  type="date"
                />
                <TextField
                  label="Profissão ou atividade"
                  value={form.professionActivity}
                  onChange={(value) => setField("professionActivity", value)}
                />
                <TextField
                  label="Telefone"
                  value={form.phone}
                  onChange={(value) => setField("phone", formatPhoneInput(value))}
                  inputMode="tel"
                />
                <TextField
                  label="WhatsApp"
                  value={form.whatsapp}
                  onChange={(value) => setField("whatsapp", formatPhoneInput(value))}
                  inputMode="tel"
                />
                <TextField
                  label="E-mail"
                  value={form.email}
                  onChange={(value) => setField("email", value)}
                  type="email"
                />
                <TextField
                  label="Cidade"
                  value={form.city}
                  onChange={(value) => setField("city", value)}
                />
                <TextField
                  label="Estado"
                  value={form.stateRegion}
                  onChange={(value) => setField("stateRegion", value.slice(0, 2).toUpperCase())}
                  maxLength={2}
                />
              </div>
            )}

            {form.leadType === "organization" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Razão social"
                  value={form.legalName}
                  onChange={(value) => setField("legalName", value)}
                />
                <TextField
                  label="Nome fantasia"
                  value={form.tradeName}
                  onChange={(value) => setField("tradeName", value)}
                />
                <TextField
                  label="CNPJ"
                  value={form.cnpj}
                  onChange={(value) => setField("cnpj", maskCnpj(value))}
                  inputMode="numeric"
                  maxLength={18}
                />
                <TextField
                  label="Segmento de atuação"
                  value={form.segment}
                  onChange={(value) => setField("segment", value)}
                />
                <SelectField
                  label="Porte da empresa"
                  value={form.companySize}
                  onChange={(value) => setField("companySize", value as CompanySize | "")}
                  placeholder="Selecione"
                  options={companySizeOptions}
                />
                <TextField
                  label="Website"
                  value={form.website}
                  onChange={(value) => setField("website", value)}
                  type="url"
                />
                <TextField
                  label="Nome do contato"
                  value={form.contactName}
                  onChange={(value) => setField("contactName", value)}
                  required
                />
                <TextField
                  label="Cargo ou função"
                  value={form.contactRole}
                  onChange={(value) => setField("contactRole", value)}
                />
                <TextField
                  label="Telefone"
                  value={form.phone}
                  onChange={(value) => setField("phone", formatPhoneInput(value))}
                  inputMode="tel"
                />
                <TextField
                  label="WhatsApp"
                  value={form.whatsapp}
                  onChange={(value) => setField("whatsapp", formatPhoneInput(value))}
                  inputMode="tel"
                />
                <TextField
                  label="E-mail"
                  value={form.email}
                  onChange={(value) => setField("email", value)}
                  type="email"
                />
                <TextField
                  label="Cidade"
                  value={form.city}
                  onChange={(value) => setField("city", value)}
                />
                <TextField
                  label="Estado"
                  value={form.stateRegion}
                  onChange={(value) => setField("stateRegion", value.slice(0, 2).toUpperCase())}
                  maxLength={2}
                />
              </div>
            )}
          </Section>

          <Section title="2. Interesse do lead">
            <ServiceSelector
              services={officialServices}
              selectedKeys={form.selectedServiceKeys}
              primaryKey={form.primaryServiceKey}
              customServiceName={form.customServiceName}
              onToggle={toggleService}
              onPrimaryChange={(value) => setField("primaryServiceKey", value)}
              onCustomServiceNameChange={(value) => setField("customServiceName", value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Preferência de contato"
                value={form.contactPreference}
                onChange={(value) => setField("contactPreference", value as ContactPreference | "")}
                placeholder="Selecione"
                options={contactPreferenceOptions}
              />
              <TextField
                label="Melhor horário para contato"
                value={form.bestContactTime}
                onChange={(value) => setField("bestContactTime", value)}
                placeholder="Ex.: dias úteis, entre 14h e 17h"
              />
            </div>
            <TextAreaField
              label="Descrição breve da necessidade"
              value={form.needSummary}
              onChange={(value) => setField("needSummary", value)}
              maxLength={2000}
            />
          </Section>

          <Section title="3. Origem do lead">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Origem do lead"
                value={form.source}
                onChange={(value) => setField("source", value as CrmLeadSource)}
                required
                options={sourceOptions}
              />
              <TextField
                label="Campanha"
                value={form.campaign}
                onChange={(value) => setField("campaign", value)}
              />
              <TextField
                label="Indicado por"
                value={form.referredBy}
                onChange={(value) => setField("referredBy", value)}
              />
            </div>
          </Section>

          <Section title="4. Controle comercial">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Status"
                value={form.status}
                onChange={(value) => setField("status", value as CrmLeadStatus)}
                required
                options={leadStatusOptions}
              />
              <SelectField
                label="Prioridade"
                value={form.priority}
                onChange={(value) => setField("priority", value as CrmLeadPriority)}
                required
                options={priorityOptions}
              />
              <SelectField
                label="Responsável pelo lead"
                value={form.ownerUserId}
                onChange={(value) => setField("ownerUserId", value)}
                required
                placeholder="Selecione o responsável"
                options={directory.profiles.map((profile) => [profile.id, profile.name] as const)}
              />
              <TextField
                label="Data do último contato"
                value={form.lastContactAt}
                onChange={(value) => setField("lastContactAt", value)}
                type="datetime-local"
              />
              <TextField
                label="Próxima ação"
                value={form.nextAction}
                onChange={(value) => setField("nextAction", value)}
              />
              <TextField
                label="Data do próximo contato"
                value={form.nextActionAt}
                onChange={(value) => setField("nextActionAt", value)}
                type="datetime-local"
              />
            </div>
            <TextAreaField
              label="Observações internas"
              value={form.notes}
              onChange={(value) => setField("notes", value)}
              maxLength={4000}
            />
          </Section>

          <div className="rounded-sm border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            Código, unidade, datas, usuários de criação e atualização, última interação, quantidade
            de interações, serviço principal e status atual são controlados automaticamente pelo
            sistema.
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting || !form.leadType}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Salvar lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceSelector({
  services,
  selectedKeys,
  primaryKey,
  customServiceName,
  onToggle,
  onPrimaryChange,
  onCustomServiceNameChange,
}: {
  services: CrmDirectory["serviceLines"];
  selectedKeys: string[];
  primaryKey: string;
  customServiceName: string;
  onToggle: (key: string, checked: boolean) => void;
  onPrimaryChange: (key: string) => void;
  onCustomServiceNameChange: (value: string) => void;
}) {
  const items = [
    ...services.map((service) => ({ key: service.id, label: service.name })),
    { key: OTHER_SERVICE_KEY, label: "Outro" },
  ];
  const selectedLabels = items
    .filter((item) => selectedKeys.includes(item.key))
    .map((item) => item.label);
  const additionalItems = items.filter((item) => item.key !== primaryKey);
  const selectedAdditionalLabels = items
    .filter((item) => item.key !== primaryKey && selectedKeys.includes(item.key))
    .map((item) => item.label);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label>
              Serviço principal <span aria-hidden="true">*</span>
            </Label>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              onClick={() =>
                window.open("/configuracoes-servicos-leads", "_blank", "noopener,noreferrer")
              }
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configurar serviços
            </button>
          </div>
          <select
            className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
            value={primaryKey}
            onChange={(event) => {
              const nextKey = event.target.value;
              if (nextKey && !selectedKeys.includes(nextKey)) {
                onToggle(nextKey, true);
              }
              onPrimaryChange(nextKey);
            }}
            required
          >
            <option value="">Selecione o serviço principal</option>
            {items.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Outros serviços de interesse</Label>
          <details className="group relative">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-sm border bg-background px-3 text-sm [&::-webkit-details-marker]:hidden">
              <span className="truncate">
                {selectedAdditionalLabels.length
                  ? selectedAdditionalLabels.join(", ")
                  : "Selecionar serviços adicionais"}
              </span>
              <span className="ml-3 text-xs text-muted-foreground">
                {selectedAdditionalLabels.length || ""}
              </span>
            </summary>
            <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-sm border bg-popover p-1 shadow-md">
              {additionalItems.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhum outro serviço disponível.
                </p>
              ) : (
                additionalItems.map((item) => {
                  const selected = selectedKeys.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={(event) => {
                        event.preventDefault();
                        onToggle(item.key, !selected);
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </details>
        </div>
      </div>

      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items
            .filter((item) => selectedKeys.includes(item.key))
            .map((item) => (
              <span key={item.key} className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                {item.label}
                {item.key === primaryKey ? " · Principal" : ""}
              </span>
            ))}
        </div>
      )}

      {selectedKeys.includes(OTHER_SERVICE_KEY) && (
        <TextField
          label="Outro serviço"
          value={customServiceName}
          onChange={onCustomServiceNameChange}
          required
        />
      )}
    </div>
  );
}

function DeleteLeadDialog({
  record,
  submitting,
  onClose,
  onConfirm,
}: {
  record: CrmLead | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Excluir lead</DialogTitle>
          <DialogDescription>
            Leads convertidos ou vinculados a oportunidades não podem ser excluídos.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          Confirma a exclusão de <strong>{record ? leadDisplayName(record) : "Lead"}</strong>?
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" disabled={submitting} onClick={() => void onConfirm()}>
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildInitialState(
  record: CrmLead | null,
  directory: CrmDirectory,
  currentUserId: string,
): LeadFormState {
  const services = record
    ? directory.leadServices.filter((item) => item.lead_id === record.id)
    : [];
  const derivedSelections: string[] = services.length
    ? services.map((item) => item.service_line_id ?? OTHER_SERVICE_KEY)
    : record?.service_line_id
      ? [record.service_line_id]
      : record?.primary_service_other
        ? [OTHER_SERVICE_KEY]
        : [];
  const primary = services.find((item) => item.is_primary);
  const primaryKey =
    primary?.service_line_id ??
    (primary?.custom_service_name ? OTHER_SERVICE_KEY : derivedSelections[0] || "");
  const customService =
    services.find((item) => item.custom_service_name)?.custom_service_name ??
    record?.primary_service_other ??
    "";
  const defaultBusinessUnit =
    directory.businessUnits.find((unit) => unit.code === LANDER_SERVICES_CODE) ??
    directory.businessUnits[0];
  return {
    businessUnitId: record?.business_unit_id ?? defaultBusinessUnit?.id ?? "",
    leadType: record?.lead_type ?? null,
    fullName: record?.lead_type === "person" ? record.contact_name : "",
    cpf: record?.lead_type === "person" ? maskCpf(record.tax_id ?? "") : "",
    birthDate: record?.birth_date ?? "",
    professionActivity: record?.profession_activity ?? "",
    legalName: record?.lead_type === "organization" ? (record.company_name ?? "") : "",
    tradeName: record?.trade_name ?? "",
    cnpj: record?.lead_type === "organization" ? maskCnpj(record.tax_id ?? "") : "",
    segment: record?.segment ?? "",
    companySize: record?.company_size ?? "",
    website: record?.website ?? "",
    contactName: record?.lead_type === "organization" ? record.contact_name : "",
    contactRole: record?.contact_role ?? "",
    phone: record?.phone ?? "",
    whatsapp: record?.whatsapp ?? "",
    email: record?.email ?? "",
    city: record?.city ?? "",
    stateRegion: record?.state_region ?? "",
    selectedServiceKeys: [...new Set(derivedSelections)],
    primaryServiceKey: primaryKey,
    customServiceName: customService,
    needSummary: record?.need_summary ?? "",
    contactPreference: record?.contact_preference ?? "",
    bestContactTime: record?.best_contact_time ?? "",
    source: record?.source ?? "other",
    campaign: record?.campaign ?? "",
    referredBy: record?.referred_by ?? "",
    status: record?.status ?? "new",
    priority: record?.priority ?? "medium",
    ownerUserId: record?.owner_user_id ?? currentUserId,
    lastContactAt: isoToLocalDateTime(record?.last_contact_at),
    nextAction: record?.next_action ?? "",
    nextActionAt: isoToLocalDateTime(record?.next_action_at),
    notes: record?.notes ?? "",
  };
}

function validateForm(form: LeadFormState): string | null {
  if (!form.businessUnitId) return "Selecione a unidade responsável pelo lead.";
  if (!form.leadType) return "Selecione o tipo de pessoa.";
  if (!form.phone.trim() && !form.whatsapp.trim() && !form.email.trim())
    return "Informe telefone, WhatsApp ou e-mail.";
  if (form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
    return "Informe um e-mail válido.";
  if (form.leadType === "person") {
    if (!form.fullName.trim()) return "Informe o nome completo.";
    if (form.cpf.trim() && !isValidCpf(form.cpf)) return "Informe um CPF válido.";
  } else {
    if (!form.legalName.trim() && !form.tradeName.trim())
      return "Informe a razão social ou o nome fantasia.";
    if (!form.contactName.trim()) return "Informe o nome do contato.";
    if (form.cnpj.trim() && !isValidCnpj(form.cnpj)) return "Informe um CNPJ válido.";
    if (form.website.trim() && !isValidUrl(form.website)) return "Informe um website válido.";
  }
  if (!form.selectedServiceKeys.length || !form.primaryServiceKey)
    return "Selecione ao menos um serviço e defina o serviço principal.";
  if (!form.selectedServiceKeys.includes(form.primaryServiceKey))
    return "O serviço principal precisa estar selecionado.";
  if (form.selectedServiceKeys.includes(OTHER_SERVICE_KEY) && !form.customServiceName.trim())
    return "Descreva o serviço selecionado como Outro.";
  if (!form.ownerUserId) return "Selecione o responsável pelo lead.";
  return null;
}

function clearTypeSpecificFields(form: LeadFormState, nextType: LeadType): LeadFormState {
  if (nextType === "person") {
    return {
      ...form,
      legalName: "",
      tradeName: "",
      cnpj: "",
      segment: "",
      companySize: "",
      website: "",
      contactName: "",
      contactRole: "",
    };
  }
  return { ...form, fullName: "", cpf: "", birthDate: "", professionActivity: "" };
}

function hasTypeSpecificData(form: LeadFormState, type: LeadType): boolean {
  const values =
    type === "person"
      ? [form.fullName, form.cpf, form.birthDate, form.professionActivity]
      : [
          form.legalName,
          form.tradeName,
          form.cnpj,
          form.segment,
          form.companySize,
          form.website,
          form.contactName,
          form.contactRole,
        ];
  return values.some((value) => String(value).trim() !== "");
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  ...props
}: { label: string; value: string; onChange: (value: string) => void; required?: boolean } & Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange"
>) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        {...props}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <textarea
        className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<readonly [string, string]>;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <select
        className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex h-10 items-center rounded-sm border bg-muted/30 px-3 text-sm">
        {value}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

export const leadStatusOptions: Array<readonly [CrmLeadStatus, string]> = [
  ["new", "Novo"],
  ["contact_pending", "Contato pendente"],
  ["contacted", "Contato realizado"],
  ["qualifying", "Em qualificação"],
  ["qualified", "Qualificado"],
  ["proposal_sent", "Proposta enviada"],
  ["negotiation", "Em negociação"],
  ["converted", "Convertido"],
  ["lost", "Perdido"],
  ["disqualified", "Desqualificado"],
];

export function leadStatusLabel(value: CrmLeadStatus): string {
  return leadStatusOptions.find(([status]) => status === value)?.[1] ?? value;
}

const sourceOptions: Array<readonly [CrmLeadSource, string]> = [
  ["site", "Site"],
  ["online_form", "Formulário online"],
  ["whatsapp", "WhatsApp"],
  ["phone", "Telefone"],
  ["email", "E-mail"],
  ["social", "Redes sociais"],
  ["referral", "Indicação"],
  ["prospecting", "Prospecção"],
  ["partner", "Parceiro"],
  ["other", "Outro"],
];
const priorityOptions: Array<readonly [CrmLeadPriority, string]> = [
  ["low", "Baixa"],
  ["medium", "Média"],
  ["high", "Alta"],
  ["urgent", "Urgente"],
];
const companySizeOptions: Array<readonly [CompanySize, string]> = [
  ["mei", "MEI"],
  ["micro", "Microempresa"],
  ["small", "Pequena empresa"],
  ["medium", "Média empresa"],
  ["large", "Grande empresa"],
  ["other", "Outro"],
];
const contactPreferenceOptions: Array<readonly [ContactPreference, string]> = [
  ["phone", "Telefone"],
  ["whatsapp", "WhatsApp"],
  ["email", "E-mail"],
  ["no_preference", "Sem preferência"],
];

export function leadSourceLabel(value: CrmLeadSource): string {
  return sourceOptions.find(([key]) => key === value)?.[1] ?? value;
}
export function leadPriorityLabel(value: CrmLeadPriority): string {
  return priorityOptions.find(([key]) => key === value)?.[1] ?? value;
}
function contactPreferenceLabel(value: CrmLead["contact_preference"]): string {
  return value ? (contactPreferenceOptions.find(([key]) => key === value)?.[1] ?? value) : "—";
}
function diagnosticStatusLabel(value: string): string {
  return (
    (
      {
        sent: "Enviado",
        opened: "Aberto",
        completed: "Concluído",
        cancelled: "Cancelado",
      } as Record<string, string>
    )[value] ?? value
  );
}
function leadDisplayName(record: CrmLead): string {
  return record.lead_type === "organization"
    ? record.trade_name?.trim() || record.company_name?.trim() || record.contact_name
    : record.contact_name;
}
export function leadPrimaryServiceLabel(record: CrmLead, directory: CrmDirectory): string {
  return record.service_line_id
    ? optionName(directory.serviceLines, record.service_line_id)
    : (record.primary_service_other ?? "—");
}
function serviceSelectionLabel(
  serviceLineId: string | null,
  customName: string | null,
  directory: CrmDirectory,
): string {
  return serviceLineId
    ? optionName(directory.serviceLines, serviceLineId)
    : (customName ?? "Outro");
}
function optionName(
  options: CrmDirectory["profiles"] | CrmDirectory["serviceLines"],
  id: string | null,
): string {
  return options.find((item) => item.id === id)?.name ?? (id ? "Não encontrado" : "—");
}
function dateTimeLabel(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}
function emptyToNull(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}
function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}
function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
function formatPhoneInput(value: string): string {
  const trimmed = value.trim();
  const prefix = trimmed.startsWith("+") ? "+" : "";
  return prefix + onlyDigits(trimmed).slice(0, 15);
}
function isoToLocalDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function localDateTimeToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
function formatTaxId(value: string | null, type: LeadType): string {
  if (!value) return "—";
  return type === "person" ? maskCpf(value) : maskCnpj(value);
}
function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(digits[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(digits[10]);
}
function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calculate = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculate(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[12]) && second === Number(digits[13]);
}
