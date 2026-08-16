import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  LoaderCircle,
  PenLine,
  Plus,
  Trash2,
  Users,
  Variable,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { ContractReferenceData } from "@/modules/contracts/reference-data-api";
import {
  createContractRecord,
  listContractTemplates,
  updateContractRecord,
} from "@/modules/contracts/api";
import type {
  Contract,
  ContractDirectory,
  ContractParty,
  ContractTemplate,
  ContractTemplateVariable,
  ContractVersion,
  PartyOption,
} from "@/modules/contracts/types";

export type ContractWizardState =
  { action: "create" } | { action: "edit"; record: Contract } | null;

interface ContractWizardDialogProps {
  state: ContractWizardState;
  directory: ContractDirectory;
  structure: ContractReferenceData;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

type PartySource = "lander" | "crm" | "manual";

type PartyDraft = {
  role: string;
  source: PartySource;
  partyId: string;
  name: string;
  taxId: string;
  address: string;
  email: string;
};

type SignerDraft = {
  id: string;
  role: string;
  name: string;
  email: string;
  required: boolean;
  order: number;
  provider: "internal" | "autentique" | "clicksign" | "docusign";
};

const steps = [
  { label: "Template", icon: FileText },
  { label: "Partes", icon: Users },
  { label: "Variáveis", icon: Variable },
  { label: "Documento", icon: Eye },
  { label: "Signatários", icon: PenLine },
  { label: "Revisão", icon: ClipboardList },
] as const;

export function ContractWizardDialog(props: ContractWizardDialogProps) {
  if (!props.state) return null;
  const record = props.state.action === "edit" ? props.state.record : null;
  return (
    <ContractWizardBody
      key={record ? `${record.id}-${record.version}` : "new-contract-template-wizard"}
      {...props}
      state={props.state}
    />
  );
}

function ContractWizardBody({
  state,
  directory,
  structure,
  userId,
  onClose,
  onChanged,
}: ContractWizardDialogProps & { state: Exclude<ContractWizardState, null> }) {
  const record = state.action === "edit" ? state.record : null;
  const templatesQuery = useQuery({
    queryKey: ["contract-templates"],
    queryFn: listContractTemplates,
  });
  const templates = (templatesQuery.data ?? []).filter((template) => template.status === "active");
  const legalEntity = structure.legalEntities[0] ?? null;
  const firstUnit =
    structure.businessUnits.find(
      (item) => item.code !== "CORPORATIVO" && item.status === "active",
    ) ??
    structure.businessUnits.find((item) => item.status === "active") ??
    null;
  const currentVersion = useMemo(
    () =>
      directory.versions
        .filter((item) => item.contract_id === record?.id)
        .sort((a, b) => b.version_number - a.version_number)[0] ?? null,
    [directory.versions, record?.id],
  );

  const [step, setStep] = useState(record ? 1 : 0);
  const [templateId, setTemplateId] = useState(record?.template_id ?? "");
  const [code, setCode] = useState(record?.code ?? "");
  const [title, setTitle] = useState(record?.title ?? "");
  const [contractType, setContractType] = useState(record?.contract_type ?? "");
  const [unitId, setUnitId] = useState(record?.business_unit_id ?? firstUnit?.id ?? "");
  const [productId, setProductId] = useState(record?.product_id ?? "");
  const [serviceLineId, setServiceLineId] = useState(record?.service_line_id ?? "");
  const [currency, setCurrency] = useState(record?.currency_code ?? "BRL");
  const [billing, setBilling] = useState(record?.billing_frequency ?? "none");
  const [baseAmount, setBaseAmount] = useState(record?.base_amount?.toString() ?? "");
  const [regime, setRegime] = useState(record?.recognition_regime ?? "COMPETENCIA");
  const [startsOn, setStartsOn] = useState(record?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(record?.ends_on ?? "");
  const [autoRenewal, setAutoRenewal] = useState(record?.auto_renewal ?? false);
  const [noticeDays, setNoticeDays] = useState(String(record?.renewal_notice_days ?? 30));
  const [paymentTermDays, setPaymentTermDays] = useState(
    String(currentVersion?.payment_term_days ?? 30),
  );
  const [calculationBasis, setCalculationBasis] = useState(currentVersion?.calculation_basis ?? "");
  const [includedComponents, setIncludedComponents] = useState(
    currentVersion?.included_components.join(", ") ?? "",
  );
  const [excludedComponents, setExcludedComponents] = useState(
    currentVersion?.excluded_components.join(", ") ?? "",
  );
  const [lossRule, setLossRule] = useState(currentVersion?.loss_rule ?? "");
  const [investmentRule, setInvestmentRule] = useState(currentVersion?.investment_rule ?? "");
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [parties, setParties] = useState<PartyDraft[]>(() => readPartySnapshot(currentVersion));
  const [variables, setVariables] = useState<Record<string, string>>(() =>
    readStringRecord(currentVersion?.template_variables),
  );
  const [signers, setSigners] = useState<SignerDraft[]>(() => readSigners(currentVersion));
  const [submitting, setSubmitting] = useState(false);

  const selectedTemplate = templates.find((template) => template.id === templateId) ?? null;
  const selectedUnit = structure.businessUnits.find((item) => item.id === unitId) ?? null;
  const products = structure.products.filter(
    (item) => item.business_unit_id === unitId && item.status === "active",
  );
  const services = structure.serviceLines.filter(
    (item) => item.business_unit_id === unitId && item.status === "active",
  );
  const partyOptions = directory.partyOptions.filter((item) => item.status === "active");
  const manifest = manifestFor(selectedTemplate);
  const detectedPartyRoles = partyRolesFor(selectedTemplate);
  const detectedSignatureRoles = signatureRolesFor(selectedTemplate);
  const derivedParties = selectedTemplate
    ? detectedPartyRoles.map((role, index) => {
        const internal = isInternalRole(selectedTemplate, role, index);
        return internal
          ? {
              role,
              source: "lander" as const,
              partyId: "",
              name: legalEntity?.legal_name ?? "LANDER SOLUTIONS",
              taxId: legalEntity?.tax_id ?? "",
              address: "",
              email: "",
            }
          : emptyParty(role);
      })
    : [];
  const effectiveParties = parties.length > 0 ? parties : derivedParties;
  const defaultVariables: Record<string, string> = selectedTemplate
    ? defaultVariableValues({
        template: selectedTemplate,
        record,
        title,
        unitName: selectedUnit?.name ?? "",
        productName: structure.products.find((item) => item.id === productId)?.name ?? "",
        serviceName: structure.serviceLines.find((item) => item.id === serviceLineId)?.name ?? "",
        startsOn,
        endsOn,
        autoRenewal,
        noticeDays,
        baseAmount,
        currency,
        billing,
        paymentTermDays,
        calculationBasis,
        includedComponents,
        excludedComponents,
        lossRule,
        investmentRule,
        notes,
      })
    : {};
  const effectiveVariables: Record<string, string> = { ...defaultVariables, ...variables };
  const derivedSigners = selectedTemplate
    ? detectedSignatureRoles.map((role, index) => {
        const party = effectiveParties.find((item) => item.role === role);
        return {
          id: `template-signer-${role}`,
          role,
          name: party?.name ?? "",
          email: party?.email ?? "",
          required: true,
          order: index + 1,
          provider: "internal" as const,
        };
      })
    : [];
  const effectiveSigners = signers.length > 0 ? signers : derivedSigners;
  const resolvedValues = buildResolvedValues({
    parties: effectiveParties,
    variables: effectiveVariables,
    signers: effectiveSigners,
  });
  const renderResult = renderTemplate(selectedTemplate?.body_text ?? "", resolvedValues);

  function chooseTemplate(template: ContractTemplate) {
    setTemplateId(template.id);
    setContractType(template.contract_type);
    if (!title.trim()) setTitle(template.name);
    setCalculationBasis(template.default_calculation_basis);
    setIncludedComponents(template.default_included_components.join(", "));
    setExcludedComponents(template.default_excluded_components.join(", "));
    setLossRule(template.default_loss_rule);
    setInvestmentRule(template.default_investment_rule);
    setParties([]);
    setSigners([]);
    setVariables({});
  }

  function patchParty(role: string, values: Partial<PartyDraft>) {
    const nextParties = effectiveParties.map((party) =>
      party.role === role ? { ...party, ...values } : party,
    );
    setParties(nextParties);
    setSigners(
      effectiveSigners.map((signer) =>
        signer.role === role
          ? {
              ...signer,
              name: values.name ?? signer.name,
              email: values.email ?? signer.email,
            }
          : signer,
      ),
    );
  }

  function selectParty(role: string, partyId: string) {
    const option = partyOptions.find((party) => party.id === partyId);
    patchParty(role, {
      source: "crm",
      partyId,
      name: option?.trade_name?.trim() || option?.legal_name || "",
      taxId: option?.tax_id ?? "",
    });
  }

  function validateStep(target: number) {
    if (target >= 1 && !selectedTemplate) return "Selecione um template contratual ativo.";
    if (target >= 2) {
      const invalidParty = effectiveParties.find(
        (party) => !party.name.trim() || (party.source === "crm" && !party.partyId),
      );
      if (invalidParty) return `Complete os dados da parte ${roleLabel(invalidParty.role)}.`;
    }
    if (target >= 3) {
      const missing = manifest.find(
        (field) => field.required && !effectiveVariables[field.key]?.trim(),
      );
      if (missing) return `Preencha o campo obrigatório “${missing.label}”.`;
    }
    if (target >= 4 && (!code.trim() || !title.trim() || !unitId)) {
      return "Preencha código, título e unidade do contrato.";
    }
    if (target >= 4 && startsOn && endsOn && endsOn < startsOn) {
      return "A data final não pode ser anterior à data inicial.";
    }
    if (target >= 5) {
      const invalidSigner = effectiveSigners.find(
        (signer) => signer.required && (!signer.name.trim() || !isEmail(signer.email)),
      );
      if (invalidSigner) {
        return `Informe nome e e-mail válido para ${roleLabel(invalidSigner.role)}.`;
      }
    }
    if (target >= 5 && renderResult.unresolved.length > 0) {
      return `Ainda existem variáveis não resolvidas: ${renderResult.unresolved.join(", ")}.`;
    }
    return null;
  }

  function next() {
    const error = validateStep(step + 1);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function syncContractParties(savedContract: Contract) {
    const existing = directory.parties.filter((item) => item.contract_id === savedContract.id);
    const persisted = effectiveParties.filter((party) => party.partyId);
    for (const party of persisted) {
      const current = existing.find((item) => item.party_role === party.role.toLowerCase());
      const values = {
        contract_id: savedContract.id,
        party_id: party.partyId,
        party_role: party.role.toLowerCase(),
        is_primary: persisted[0]?.role === party.role,
        status: "active",
        starts_on: startsOn || null,
        ends_on: endsOn || null,
        notes: null,
      };
      if (current) {
        await updateContractRecord<ContractParty>(
          "contract_parties",
          current.id,
          current.version,
          values,
        );
      } else {
        await createContractRecord<ContractParty>("contract_parties", values);
      }
    }
    for (const current of existing) {
      if (!persisted.some((party) => party.role.toLowerCase() === current.party_role)) {
        await updateContractRecord<ContractParty>("contract_parties", current.id, current.version, {
          status: "ended",
          ends_on: endsOn || new Date().toISOString().slice(0, 10),
        });
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateStep(steps.length - 1);
    if (error) {
      toast.error(error);
      return;
    }
    if (!legalEntity || !selectedTemplate) {
      toast.error("Estrutura jurídica ou template indisponível.");
      return;
    }

    setSubmitting(true);
    try {
      const contractValues = {
        legal_entity_id: record?.legal_entity_id ?? legalEntity.id,
        business_unit_id: unitId,
        product_id: productId || null,
        service_line_id: serviceLineId || null,
        template_id: selectedTemplate.id,
        code: normalizeCode(code),
        title: title.trim(),
        contract_type: contractType || selectedTemplate.contract_type,
        currency_code: currency,
        billing_frequency: billing,
        base_amount: baseAmount.trim() ? Number(baseAmount) : null,
        recognition_regime: regime,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
        auto_renewal: autoRenewal,
        renewal_notice_days: Number(noticeDays || 0),
        responsible_user_id: record?.responsible_user_id ?? userId,
        status: record?.status ?? "draft",
        notes: notes.trim() || null,
        created_by: record?.created_by ?? userId,
      };

      const savedContract = record
        ? await updateContractRecord<Contract>(
            "contracts",
            record.id,
            record.version,
            contractValues,
          )
        : await createContractRecord<Contract>("contracts", contractValues);

      await syncContractParties(savedContract);

      const editableVersion =
        currentVersion && ["draft", "rejected"].includes(currentVersion.status)
          ? currentVersion
          : null;
      const versionValues = {
        contract_id: savedContract.id,
        version_number: editableVersion
          ? editableVersion.version_number
          : (currentVersion?.version_number ?? 0) + 1,
        effective_from: startsOn || new Date().toISOString().slice(0, 10),
        effective_to: endsOn || null,
        change_reason: editableVersion
          ? "Atualização pelo assistente contratual orientado por template."
          : currentVersion
            ? "Nova versão criada pelo assistente contratual."
            : "Versão inicial criada pelo assistente contratual.",
        template_body_snapshot: selectedTemplate.body_text,
        calculation_basis: calculationBasis.trim(),
        included_components: splitList(includedComponents),
        excluded_components: splitList(excludedComponents),
        loss_rule: lossRule.trim() || "none",
        investment_rule: investmentRule.trim() || "none",
        reserve_method: editableVersion?.reserve_method ?? currentVersion?.reserve_method ?? "none",
        reserve_value: editableVersion?.reserve_value ?? currentVersion?.reserve_value ?? null,
        rounding_scale: editableVersion?.rounding_scale ?? currentVersion?.rounding_scale ?? 2,
        allows_distinct_bases:
          editableVersion?.allows_distinct_bases ?? currentVersion?.allows_distinct_bases ?? false,
        payment_term_days: Number(paymentTermDays || 0),
        status: editableVersion?.status ?? "draft",
        requested_by: editableVersion?.requested_by ?? null,
        approved_by: editableVersion?.approved_by ?? null,
        approved_at: editableVersion?.approved_at ?? null,
        party_snapshot: effectiveParties,
        template_variables: effectiveVariables,
        signers_snapshot: effectiveSigners
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(({ id: _id, ...signer }) => signer),
        rendered_body: renderResult.text,
        unresolved_placeholders: renderResult.unresolved,
      };

      if (editableVersion) {
        await updateContractRecord<ContractVersion>(
          "contract_versions",
          editableVersion.id,
          editableVersion.version,
          versionValues,
        );
      } else {
        await createContractRecord<ContractVersion>("contract_versions", versionValues);
      }

      await onChanged();
      toast.success(
        record ? "Contrato e versão atualizados." : "Contrato criado a partir do template.",
      );
      onClose();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Falha ao salvar o contrato.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[90vh] max-h-[90vh] w-[96vw] max-w-5xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">
          {record ? "Editar Contrato" : "Novo Contrato"}
        </DialogTitle>

        <form className="flex h-full overflow-hidden" onSubmit={submit}>
          <aside className="hidden w-52 shrink-0 flex-col border-r bg-muted/30 md:flex">
            <div className="border-b p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                {record ? "Editar Contrato" : "Novo Contrato"}
              </p>
              {selectedTemplate && (
                <p className="mt-1 truncate text-xs font-medium text-foreground">
                  {selectedTemplate.name}
                </p>
              )}
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {steps.map((item, index) => {
                const active = step === index;
                const done = step > index;
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => index <= step && setStep(index)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                      active
                        ? "bg-primary font-medium text-primary-foreground"
                        : done
                          ? "cursor-pointer text-foreground hover:bg-muted"
                          : "cursor-default text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        active
                          ? "bg-primary-foreground text-primary"
                          : done
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : index + 1}
                    </span>
                    <span>{item.label}</span>
                    {active && <Icon className="ml-auto h-3 w-3 opacity-60" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-2 border-b px-5 py-3 md:hidden">
              {steps.map((item, index) => (
                <div
                  key={item.label}
                  className={`h-1.5 rounded-full transition-all ${
                    step >= index ? "w-4 bg-primary" : "w-1.5 bg-muted"
                  }`}
                />
              ))}
              <span className="ml-2 text-xs font-medium">{steps[step]?.label}</span>
              <span className="text-xs text-muted-foreground">
                ({step + 1}/{steps.length})
              </span>
            </div>

            <main className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mx-auto w-full max-w-3xl space-y-5">
                {step === 0 && (
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold">Escolha o modelo de contrato</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Selecione o template. O formulário será gerado automaticamente a partir dos
                        placeholders.
                      </p>
                    </div>
                    {templatesQuery.isLoading ? (
                      <Loading label="Carregando templates contratuais…" />
                    ) : templatesQuery.error ? (
                      <ErrorBox error={templatesQuery.error} />
                    ) : templates.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        Nenhum template ativo. Crie um template em Contratos → Templates.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {templates.map((template) => {
                          const selected = template.id === templateId;
                          return (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => chooseTemplate(template)}
                              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                                selected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "border-border hover:border-primary/40 hover:bg-muted/30"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{template.name}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {template.contract_type}
                                  </p>
                                  {template.description && (
                                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                      {template.description}
                                    </p>
                                  )}
                                </div>
                                {selected && (
                                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {step === 1 && selectedTemplate && (
                  <WizardSection
                    title="Partes do contrato"
                    description="Os papéis foram detectados no template. Use a entidade LANDER, um contato do CRM ou dados manuais."
                  >
                    <div className="space-y-4">
                      {effectiveParties.map((party) => (
                        <PartyCard
                          key={party.role}
                          party={party}
                          options={partyOptions}
                          legalEntityName={legalEntity?.legal_name ?? "LANDER SOLUTIONS"}
                          legalEntityTaxId={legalEntity?.tax_id ?? ""}
                          onPatch={(values) => patchParty(party.role, values)}
                          onSelect={(partyId) => selectParty(party.role, partyId)}
                        />
                      ))}
                    </div>
                  </WizardSection>
                )}

                {step === 2 && selectedTemplate && (
                  <WizardSection
                    title="Variáveis do template"
                    description="Preencha todos os campos exigidos pelo manifesto. Valores contratuais são pré-preenchidos e permanecem editáveis."
                  >
                    <div className="space-y-6">
                      {groupManifest(manifest).map(([group, fields]) => (
                        <section key={group} className="space-y-3">
                          <h4 className="text-sm font-semibold">{group}</h4>
                          <div className="grid gap-4 md:grid-cols-2">
                            {fields.map((field) => (
                              <VariableField
                                key={field.key}
                                field={field}
                                value={effectiveVariables[field.key] ?? ""}
                                onChange={(value) =>
                                  setVariables((current) => ({ ...current, [field.key]: value }))
                                }
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </WizardSection>
                )}

                {step === 3 && selectedTemplate && (
                  <WizardSection
                    title="Documento e condições contratuais"
                    description="Defina identificação, escopo, vigência, valores e regras econômicas da versão."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField label="Código" value={code} onChange={setCode} required />
                      <TextField label="Título" value={title} onChange={setTitle} required />
                      <TextField
                        label="Tipo contratual"
                        value={contractType}
                        onChange={setContractType}
                        required
                      />
                      <SelectField
                        label="Unidade de negócio"
                        value={unitId}
                        onChange={(value) => {
                          setUnitId(value);
                          setProductId("");
                          setServiceLineId("");
                        }}
                        options={structure.businessUnits
                          .filter((item) => item.status === "active")
                          .map((item): [string, string] => [
                            item.id,
                            `${item.code} — ${item.name}`,
                          ])}
                      />
                      <SelectField
                        label="Produto"
                        value={productId}
                        onChange={(value) => {
                          setProductId(value);
                          if (value) setServiceLineId("");
                        }}
                        options={[
                          ["", "Sem produto"],
                          ...products.map((item): [string, string] => [item.id, item.name]),
                        ]}
                      />
                      <SelectField
                        label="Linha de serviço"
                        value={serviceLineId}
                        onChange={(value) => {
                          setServiceLineId(value);
                          if (value) setProductId("");
                        }}
                        options={[
                          ["", "Sem linha de serviço"],
                          ...services.map((item): [string, string] => [item.id, item.name]),
                        ]}
                      />
                      <SelectField
                        label="Moeda"
                        value={currency}
                        onChange={setCurrency}
                        options={structure.currencies
                          .filter((item) => item.is_active)
                          .map((item): [string, string] => [
                            item.code,
                            `${item.code} — ${item.name}`,
                          ])}
                      />
                      <SelectField
                        label="Faturamento"
                        value={billing}
                        onChange={setBilling}
                        options={billingOptions}
                      />
                      <TextField
                        label="Valor base"
                        value={baseAmount}
                        onChange={setBaseAmount}
                        type="number"
                        min="0"
                        step="0.01"
                      />
                      <SelectField
                        label="Regime de reconhecimento"
                        value={regime}
                        onChange={(value) => setRegime(value as Contract["recognition_regime"])}
                        options={[
                          ["COMPETENCIA", "Competência"],
                          ["CAIXA", "Caixa"],
                          ["HIBRIDO_CONTRATUAL", "Híbrido contratual"],
                        ]}
                      />
                      <TextField
                        label="Data de início"
                        value={startsOn}
                        onChange={setStartsOn}
                        type="date"
                      />
                      <TextField
                        label="Data de encerramento"
                        value={endsOn}
                        onChange={setEndsOn}
                        type="date"
                      />
                      <TextField
                        label="Prazo de pagamento (dias)"
                        value={paymentTermDays}
                        onChange={setPaymentTermDays}
                        type="number"
                        min="0"
                      />
                      <TextField
                        label="Aviso de renovação (dias)"
                        value={noticeDays}
                        onChange={setNoticeDays}
                        type="number"
                        min="0"
                      />
                    </div>
                    <label className="flex items-center gap-3 rounded-md border bg-card p-4 text-sm">
                      <input
                        type="checkbox"
                        checked={autoRenewal}
                        onChange={(event) => setAutoRenewal(event.target.checked)}
                      />
                      <span>
                        <strong>Renovação automática</strong>
                        <span className="mt-0.5 block text-muted-foreground">
                          A regra será registrada na versão e refletida no documento.
                        </span>
                      </span>
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextAreaField
                        label="Base de cálculo"
                        value={calculationBasis}
                        onChange={setCalculationBasis}
                      />
                      <TextAreaField
                        label="Componentes incluídos"
                        value={includedComponents}
                        onChange={setIncludedComponents}
                      />
                      <TextAreaField
                        label="Componentes excluídos"
                        value={excludedComponents}
                        onChange={setExcludedComponents}
                      />
                      <TextAreaField
                        label="Regra para prejuízos"
                        value={lossRule}
                        onChange={setLossRule}
                      />
                      <TextAreaField
                        label="Regra para investimentos"
                        value={investmentRule}
                        onChange={setInvestmentRule}
                      />
                      <TextAreaField label="Observações" value={notes} onChange={setNotes} />
                    </div>
                  </WizardSection>
                )}

                {step === 4 && selectedTemplate && (
                  <WizardSection
                    title="Signatários"
                    description="Os papéis foram identificados no template. Configure nome, e-mail, ordem e plataforma de assinatura."
                  >
                    <div className="space-y-4">
                      {effectiveSigners
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((signer) => (
                          <SignerCard
                            key={signer.id}
                            signer={signer}
                            onPatch={(values) =>
                              setSigners((current) =>
                                current.map((item) =>
                                  item.id === signer.id ? { ...item, ...values } : item,
                                ),
                              )
                            }
                            onDelete={() =>
                              setSigners((current) =>
                                current.filter((item) => item.id !== signer.id),
                              )
                            }
                          />
                        ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setSigners((current) => [
                            ...current,
                            {
                              id: crypto.randomUUID(),
                              role: `SIGNATARIO_${current.length + 1}`,
                              name: "",
                              email: "",
                              required: false,
                              order: current.length + 1,
                              provider: "internal",
                            },
                          ])
                        }
                      >
                        <Plus className="h-4 w-4" /> Adicionar signatário
                      </Button>
                    </div>
                  </WizardSection>
                )}

                {step === 5 && selectedTemplate && (
                  <WizardSection
                    title="Revisão final"
                    description="Confira o template, as partes, os campos, o documento renderizado e a ordem de assinatura."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <ReviewCard label="Template" value={selectedTemplate.name} />
                      <ReviewCard label="Contrato" value={`${code || "—"} — ${title || "—"}`} />
                      <ReviewCard label="Unidade" value={selectedUnit?.name ?? "—"} />
                      <ReviewCard
                        label="Vigência"
                        value={`${formatDate(startsOn)} → ${formatDate(endsOn)}`}
                      />
                      <ReviewCard
                        label="Partes"
                        value={parties
                          .map((party) => `${roleLabel(party.role)}: ${party.name}`)
                          .join(" · ")}
                      />
                      <ReviewCard
                        label="Signatários"
                        value={effectiveSigners
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((signer) => `${signer.order}. ${signer.name}`)
                          .join(" · ")}
                      />
                    </div>
                    {renderResult.unresolved.length > 0 && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                        Variáveis pendentes: {renderResult.unresolved.join(", ")}
                      </div>
                    )}
                  </WizardSection>
                )}
              </div>
            </main>

            <div className="flex shrink-0 items-center justify-between border-t bg-background px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => (step > 0 ? setStep((current) => current - 1) : onClose())}
                disabled={submitting}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {step === 0 ? "Cancelar" : "Voltar"}
              </Button>

              {step < steps.length - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={next}
                  disabled={!selectedTemplate && step === 0}
                >
                  Avançar <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={submitting}>
                  {submitting && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  {record ? "Salvar contrato" : "Criar contrato"}
                </Button>
              )}
            </div>
          </div>

          <aside className="hidden w-[45%] flex-col overflow-hidden border-l bg-muted/10 lg:flex">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Pré-visualização</p>
                  <p className="text-xs text-muted-foreground">
                    Atualização em tempo real pelo template selecionado.
                  </p>
                </div>
                <span className="rounded-full border px-2 py-1 text-[11px] text-muted-foreground">
                  {renderResult.unresolved.length} pendência(s)
                </span>
              </div>
              <ContractPreview
                template={selectedTemplate}
                title={title}
                code={code}
                text={renderResult.text}
                unresolved={renderResult.unresolved}
              />
            </div>
          </aside>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PartyCard({
  party,
  options,
  legalEntityName,
  legalEntityTaxId,
  onPatch,
  onSelect,
}: {
  party: PartyDraft;
  options: PartyOption[];
  legalEntityName: string;
  legalEntityTaxId: string;
  onPatch: (values: Partial<PartyDraft>) => void;
  onSelect: (partyId: string) => void;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h4 className="font-semibold">{roleLabel(party.role)}</h4>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Origem dos dados"
          value={party.source}
          onChange={(value) => {
            const source = value as PartySource;
            if (source === "lander") {
              onPatch({ source, partyId: "", name: legalEntityName, taxId: legalEntityTaxId });
            } else if (source === "manual") {
              onPatch({ source, partyId: "", name: "", taxId: "", address: "", email: "" });
            } else {
              onPatch({ source, partyId: "", name: "", taxId: "", address: "", email: "" });
            }
          }}
          options={[
            ["lander", "Entidade legal LANDER SOLUTIONS"],
            ["crm", "Contato cadastrado no CRM"],
            ["manual", "Preenchimento manual"],
          ]}
        />
        {party.source === "crm" ? (
          <SelectField
            label="Contato do CRM"
            value={party.partyId}
            onChange={onSelect}
            options={[
              ["", "Selecione um contato"],
              ...options.map((option): [string, string] => [
                option.id,
                option.trade_name?.trim() || option.legal_name,
              ]),
            ]}
          />
        ) : (
          <TextField
            label="Nome / Razão social"
            value={party.name}
            onChange={(value) => onPatch({ name: value })}
            required
          />
        )}
        {party.source === "crm" && (
          <TextField
            label="Nome / Razão social"
            value={party.name}
            onChange={(value) => onPatch({ name: value })}
            required
          />
        )}
        <TextField
          label="CPF/CNPJ"
          value={party.taxId}
          onChange={(value) => onPatch({ taxId: value })}
        />
        <TextField
          label="E-mail"
          value={party.email}
          onChange={(value) => onPatch({ email: value })}
          type="email"
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="Endereço completo"
            value={party.address}
            onChange={(value) => onPatch({ address: value })}
          />
        </div>
      </div>
    </section>
  );
}

function SignerCard({
  signer,
  onPatch,
  onDelete,
}: {
  signer: SignerDraft;
  onPatch: (values: Partial<SignerDraft>) => void;
  onDelete: () => void;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h4 className="font-semibold">{roleLabel(signer.role)}</h4>
        {!signer.required && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onDelete}
            aria-label="Remover signatário"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TextField
          label="Nome"
          value={signer.name}
          onChange={(value) => onPatch({ name: value })}
          required={signer.required}
        />
        <TextField
          label="E-mail"
          value={signer.email}
          onChange={(value) => onPatch({ email: value })}
          type="email"
          required={signer.required}
        />
        <TextField
          label="Ordem"
          value={String(signer.order)}
          onChange={(value) => onPatch({ order: Math.max(1, Number(value || 1)) })}
          type="number"
          min="1"
        />
        <SelectField
          label="Plataforma"
          value={signer.provider}
          onChange={(value) => onPatch({ provider: value as SignerDraft["provider"] })}
          options={[
            ["internal", "Assinatura interna"],
            ["autentique", "Autentique"],
            ["clicksign", "Clicksign"],
            ["docusign", "DocuSign"],
          ]}
        />
      </div>
    </section>
  );
}

function VariableField({
  field,
  value,
  onChange,
}: {
  field: ContractTemplateVariable;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <TextAreaField
        label={`${field.label}${field.required ? " *" : ""}`}
        value={value}
        onChange={onChange}
      />
    );
  }
  if (field.options?.length) {
    return (
      <SelectField
        label={`${field.label}${field.required ? " *" : ""}`}
        value={value}
        onChange={onChange}
        options={[
          ["", "Selecione"],
          ...field.options.map((option): [string, string] => [option, option]),
        ]}
      />
    );
  }
  return (
    <TextField
      label={`${field.label}${field.required ? " *" : ""}`}
      value={value}
      onChange={onChange}
      type={
        field.type === "date"
          ? "date"
          : field.type === "number" || field.type === "currency" || field.type === "percentage"
            ? "number"
            : "text"
      }
      step={field.type === "currency" || field.type === "percentage" ? "0.01" : undefined}
      required={field.required}
    />
  );
}

function ContractPreview({
  template,
  title,
  code,
  text,
  unresolved,
}: {
  template: ContractTemplate | null;
  title: string;
  code: string;
  text: string;
  unresolved: string[];
}) {
  return (
    <article className="mx-auto min-h-[720px] w-full max-w-[520px] rounded-sm border bg-white p-8 text-slate-900 shadow-sm">
      <header className="border-b pb-4 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {template?.header_text || "LANDER SOLUTIONS"}
        </p>
        <h3 className="mt-3 text-base font-bold">{title || template?.name || "Contrato"}</h3>
        <p className="mt-1 font-mono text-[10px] text-slate-500">{code || "CÓDIGO PENDENTE"}</p>
      </header>
      {!template ? (
        <div className="flex min-h-[520px] items-center justify-center text-center text-sm text-slate-400">
          Selecione um template para visualizar o documento.
        </div>
      ) : (
        <div className="whitespace-pre-wrap py-6 text-[11px] leading-5">
          {highlightUnresolved(text)}
        </div>
      )}
      <footer className="mt-auto border-t pt-4 text-center text-[9px] text-slate-400">
        {template?.footer_text || "Documento contratual versionado"}
        {unresolved.length > 0 && (
          <p className="mt-2 font-semibold text-red-600">
            {unresolved.length} variável(is) pendente(s)
          </p>
        )}
      </footer>
    </article>
  );
}

function highlightUnresolved(text: string) {
  const parts = text.split(/({{[^{}]+}})/g);
  return parts.map((part, index) =>
    /^{{[^{}]+}}$/.test(part) ? (
      <mark key={`${part}-${index}`} className="rounded bg-red-100 px-1 text-red-700">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function WizardSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-lg border bg-card p-5 md:p-6">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        min={min}
        step={step}
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
  options: Array<[string, string]>;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={`${label}-${optionValue}`} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function ReviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      {error instanceof Error ? error.message : "Falha ao carregar dados."}
    </div>
  );
}

function emptyParty(role: string): PartyDraft {
  return { role, source: "crm", partyId: "", name: "", taxId: "", address: "", email: "" };
}

function readPartySnapshot(version: ContractVersion | null): PartyDraft[] {
  if (!Array.isArray(version?.party_snapshot)) return [];
  return version.party_snapshot.filter(isRecord).map((item) => ({
    role: String(item.role ?? "PARTE"),
    source: ["lander", "crm", "manual"].includes(String(item.source))
      ? (String(item.source) as PartySource)
      : "manual",
    partyId: String(item.partyId ?? ""),
    name: String(item.name ?? ""),
    taxId: String(item.taxId ?? ""),
    address: String(item.address ?? ""),
    email: String(item.email ?? ""),
  }));
}

function readSigners(version: ContractVersion | null): SignerDraft[] {
  if (!Array.isArray(version?.signers_snapshot)) return [];
  return version.signers_snapshot.filter(isRecord).map((item, index) => ({
    id: crypto.randomUUID(),
    role: String(item.role ?? `SIGNATARIO_${index + 1}`),
    name: String(item.name ?? ""),
    email: String(item.email ?? ""),
    required: Boolean(item.required),
    order: Number(item.order ?? index + 1),
    provider: ["internal", "autentique", "clicksign", "docusign"].includes(String(item.provider))
      ? (String(item.provider) as SignerDraft["provider"])
      : "internal",
  }));
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item ?? "")]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function manifestFor(template: ContractTemplate | null): ContractTemplateVariable[] {
  if (!template) return [];
  if (Array.isArray(template.variables_manifest) && template.variables_manifest.length > 0) {
    return template.variables_manifest
      .filter(isRecord)
      .map((item) => ({
        key: String(item.key ?? ""),
        label: String(item.label ?? item.key ?? "Campo"),
        type: normalizeFieldType(item.type),
        required: Boolean(item.required),
        group: String(item.group ?? "Contrato"),
        source: String(item.source ?? "manual"),
        description: String(item.description ?? ""),
        active: item.active !== false,
        options: Array.isArray(item.options) ? item.options.map(String) : undefined,
      }))
      .filter((item) => Boolean(item.key) && item.active);
  }
  const partyPrefixes = new Set(partyRolesFor(template));
  return extractPlaceholders(template.body_text)
    .filter((key) => {
      const prefix = key.split(".")[0];
      return !partyPrefixes.has(prefix) && !["SIGNATURE", "SIGN_DATE", "INITIALS"].includes(prefix);
    })
    .map((key) => ({
      key,
      label: humanizeKey(key),
      type: "text",
      required: true,
      group: humanizeKey(key.split(".")[0]),
    }));
}

function normalizeFieldType(value: unknown): ContractTemplateVariable["type"] {
  const type = String(value ?? "text");
  return ["text", "textarea", "date", "number", "currency", "percentage", "select"].includes(type)
    ? (type as ContractTemplateVariable["type"])
    : "text";
}

function partyRolesFor(template: ContractTemplate | null): string[] {
  if (!template) return [];
  if (template.party_roles?.length) return [...new Set(template.party_roles.map(normalizeRole))];
  const ignored = new Set(["CONTRATO", "PARTICIPACAO", "SIGNATURE", "SIGN_DATE", "INITIALS"]);
  return [
    ...new Set(
      extractPlaceholders(template.body_text)
        .map((key) => key.split(".")[0])
        .filter((role) => !ignored.has(role)),
    ),
  ];
}

function signatureRolesFor(template: ContractTemplate | null): string[] {
  if (!template) return [];
  if (template.signature_roles?.length)
    return [...new Set(template.signature_roles.map(normalizeRole))];
  return [
    ...new Set(
      extractPlaceholders(template.body_text)
        .filter((key) => /^(SIGNATURE|SIGN_DATE|INITIALS)\./.test(key))
        .map((key) => key.split(".")[1])
        .filter(Boolean),
    ),
  ];
}

function isInternalRole(template: ContractTemplate, role: string, index: number) {
  if (template.code === "TPL_CLIENTE_SAAS") return role === "CONTRATADA";
  if (template.code === "TPL_PARTICIPACAO") return role === "CONTRATANTE";
  return index === 0;
}

function extractPlaceholders(text: string): string[] {
  return [...text.matchAll(/{{\s*([A-Z0-9_.-]+)\s*}}/gi)].map((match) => match[1].toUpperCase());
}

function buildResolvedValues({
  parties,
  variables,
  signers,
}: {
  parties: PartyDraft[];
  variables: Record<string, string>;
  signers: SignerDraft[];
}) {
  const result: Record<string, string> = { ...variables };
  for (const party of parties) {
    const role = normalizeRole(party.role);
    result[`${role}.RAZAO_SOCIAL`] = party.name;
    result[`${role}.NOME_RAZAO_SOCIAL`] = party.name;
    result[`${role}.NOME`] = party.name;
    result[`${role}.CPF_CNPJ`] = party.taxId;
    result[`${role}.ENDERECO_COMPLETO`] = party.address;
    result[`${role}.EMAIL`] = party.email;
  }
  for (const signer of signers) {
    const role = normalizeRole(signer.role);
    result[`SIGNATURE.${role}`] = signer.name
      ? `\n________________________________________\n${signer.name}\n${roleLabel(role)}`
      : "";
    result[`SIGN_DATE.${role}`] = "Data: ____/____/________";
    result[`INITIALS.${role}`] = `[RUBRICA — ${signer.name || roleLabel(role)}]`;
  }
  return result;
}

function renderTemplate(text: string, values: Record<string, string>) {
  const unresolved = new Set<string>();
  const rendered = text.replace(/{{\s*([A-Z0-9_.-]+)\s*}}/gi, (_match, rawKey: string) => {
    const key = rawKey.toUpperCase();
    const value = values[key]?.trim();
    if (!value) {
      unresolved.add(key);
      return `{{${key}}}`;
    }
    return value;
  });
  return { text: rendered, unresolved: [...unresolved] };
}

function defaultVariableValues(input: {
  template: ContractTemplate;
  record: Contract | null;
  title: string;
  unitName: string;
  productName: string;
  serviceName: string;
  startsOn: string;
  endsOn: string;
  autoRenewal: boolean;
  noticeDays: string;
  baseAmount: string;
  currency: string;
  billing: string;
  paymentTermDays: string;
  calculationBasis: string;
  includedComponents: string;
  excludedComponents: string;
  lossRule: string;
  investmentRule: string;
  notes: string;
}) {
  return {
    "CONTRATO.TITULO": input.title.trim() || input.record?.title || "A definir",
    "CONTRATO.PRODUTO_SERVICO": input.productName || input.serviceName || input.unitName,
    "CONTRATO.PLANO": input.title.trim() || input.record?.title || "A definir",
    "CONTRATO.DATA_INICIO": formatDate(input.startsOn),
    "CONTRATO.DATA_FIM": formatDate(input.endsOn),
    "CONTRATO.RENOVACAO": input.autoRenewal
      ? `automática, com aviso de ${input.noticeDays || 0} dias`
      : "não automática",
    "CONTRATO.VALOR": input.baseAmount
      ? formatMoney(Number(input.baseAmount), input.currency)
      : "Não se aplica",
    "CONTRATO.FATURAMENTO": billingLabel(input.billing),
    "CONTRATO.PRAZO_PAGAMENTO_DIAS": input.paymentTermDays,
    "CONTRATO.OBSERVACOES": input.notes.trim() || "Sem observações específicas",
    "UNIDADE_NEGOCIO.NOME": input.unitName,
    "PARTICIPACAO.BASE_CALCULO": input.calculationBasis || input.template.default_calculation_basis,
    "PARTICIPACAO.COMPONENTES_INCLUIDOS":
      input.includedComponents || input.template.default_included_components.join(", "),
    "PARTICIPACAO.COMPONENTES_EXCLUIDOS":
      input.excludedComponents || input.template.default_excluded_components.join(", "),
    "PARTICIPACAO.REGRA_PREJUIZO": input.lossRule || input.template.default_loss_rule,
    "PARTICIPACAO.REGRA_INVESTIMENTO":
      input.investmentRule || input.template.default_investment_rule,
    "PARTICIPACAO.REGRA_RESERVA": "Sem reserva específica",
    "PARTICIPACAO.PRAZO_PAGAMENTO_DIAS": input.paymentTermDays,
  };
}

function groupManifest(manifest: ContractTemplateVariable[]) {
  const grouped = new Map<string, ContractTemplateVariable[]>();
  for (const field of manifest) {
    const current = grouped.get(field.group) ?? [];
    current.push(field);
    grouped.set(field.group, current);
  }
  return [...grouped.entries()];
}

function roleLabel(value: string) {
  return humanizeKey(value)
    .replace(/^Contratada$/, "Contratada")
    .replace(/^Contratante$/, "Contratante");
}

function humanizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[_.-]+/g, " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function normalizeRole(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeCode(value: string) {
  return normalizeRole(value).slice(0, 80);
}

function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(
    value || 0,
  );
}

function billingLabel(value: string) {
  return Object.fromEntries(billingOptions)[value] ?? value;
}

const billingOptions: Array<[string, string]> = [
  ["none", "Sem faturamento recorrente"],
  ["one_time", "Pagamento único"],
  ["monthly", "Mensal"],
  ["quarterly", "Trimestral"],
  ["semiannual", "Semestral"],
  ["annual", "Anual"],
];
