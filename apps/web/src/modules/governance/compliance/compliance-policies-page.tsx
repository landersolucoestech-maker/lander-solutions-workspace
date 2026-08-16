import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  FilePlus2,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  completeComplianceOccurrence,
  createComplianceObligation,
  createComplianceOccurrence,
  createPolicy,
  createPolicyVersion,
  decidePolicyVersion,
  deleteComplianceObligation,
  deleteComplianceOccurrence,
  deletePolicy,
  deletePolicyVersion,
  listComplianceDirectory,
  publishPolicyVersion,
  submitPolicyVersion,
  updateComplianceObligation,
  updateComplianceOccurrence,
  updatePolicy,
  updatePolicyVersion,
  waiveComplianceOccurrence,
} from "./api";
import type {
  ComplianceObligation,
  ComplianceOccurrence,
  CorporatePolicy,
  CorporatePolicyVersion,
  DirectoryOption,
} from "./types";

const pageSize = 8;
const fieldClass = "h-9 w-full rounded-sm border bg-background px-3 text-sm";

const obligationCategories = [
  ["corporate", "Societária e corporativa"],
  ["regulatory", "Regulatória"],
  ["tax", "Fiscal"],
  ["accounting", "Contábil"],
  ["labor", "Trabalhista"],
  ["contractual", "Contratual recorrente"],
  ["privacy", "Privacidade"],
  ["information_security", "Segurança da informação"],
  ["license", "Licença"],
  ["insurance", "Seguro"],
  ["intellectual_property", "Propriedade intelectual"],
  ["other", "Outra"],
] as const;

const frequencies = [
  ["one_time", "Única"],
  ["monthly", "Mensal"],
  ["quarterly", "Trimestral"],
  ["semiannual", "Semestral"],
  ["annual", "Anual"],
  ["biennial", "Bienal"],
  ["custom", "Personalizada"],
] as const;

const obligationStatuses = [
  ["draft", "Rascunho"],
  ["active", "Ativa"],
  ["inactive", "Inativa"],
  ["archived", "Arquivada"],
] as const;

const riskLevels = [
  ["low", "Baixo"],
  ["medium", "Médio"],
  ["high", "Alto"],
  ["critical", "Crítico"],
] as const;

interface ObligationForm {
  legal_entity_id: string;
  business_unit_id: string;
  product_id: string;
  service_line_id: string;
  project_id: string;
  contract_id: string;
  intellectual_property_asset_id: string;
  responsible_user_id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  authority: string;
  legal_basis: string;
  frequency: string;
  due_rule: string;
  first_due_date: string;
  next_due_date: string;
  risk_level: string;
  evidence_required: boolean;
  remediation_plan: string;
  notes: string;
  status: string;
}

interface OccurrenceForm {
  compliance_obligation_id: string;
  reference_start: string;
  reference_end: string;
  due_date: string;
  responsible_user_id: string;
  evidence_reference: string;
  notes: string;
}

interface PolicyForm {
  legal_entity_id: string;
  business_unit_id: string;
  owner_user_id: string;
  code: string;
  title: string;
  policy_type: string;
  description: string;
  status: string;
}

interface PolicyVersionForm {
  policy_id: string;
  version_number: string;
  effective_from: string;
  effective_to: string;
  change_summary: string;
  storage_provider: string;
  storage_bucket: string;
  storage_object_key: string;
  checksum_sha256: string;
}

const today = new Date().toISOString().slice(0, 10);

const emptyObligation: ObligationForm = {
  legal_entity_id: "",
  business_unit_id: "",
  product_id: "",
  service_line_id: "",
  project_id: "",
  contract_id: "",
  intellectual_property_asset_id: "",
  responsible_user_id: "",
  code: "",
  title: "",
  description: "",
  category: "regulatory",
  authority: "",
  legal_basis: "",
  frequency: "annual",
  due_rule: "",
  first_due_date: "",
  next_due_date: "",
  risk_level: "medium",
  evidence_required: true,
  remediation_plan: "",
  notes: "",
  status: "draft",
};

const emptyOccurrence: OccurrenceForm = {
  compliance_obligation_id: "",
  reference_start: "",
  reference_end: "",
  due_date: today,
  responsible_user_id: "",
  evidence_reference: "",
  notes: "",
};

const emptyPolicy: PolicyForm = {
  legal_entity_id: "",
  business_unit_id: "",
  owner_user_id: "",
  code: "",
  title: "",
  policy_type: "internal",
  description: "",
  status: "draft",
};

const emptyPolicyVersion: PolicyVersionForm = {
  policy_id: "",
  version_number: "1",
  effective_from: today,
  effective_to: "",
  change_summary: "",
  storage_provider: "external",
  storage_bucket: "",
  storage_object_key: "",
  checksum_sha256: "",
};

function nullable(value: string) {
  return value.trim() || null;
}

function localDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function CompliancePoliciesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["compliance-policies-directory"],
    queryFn: listComplianceDirectory,
  });
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["compliance-policies-directory"] });
      toast.success("Operação concluída.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao executar a operação."),
  });

  const [search, setSearch] = useState("");
  const [pages, setPages] = useState({ obligations: 1, occurrences: 1, policies: 1, versions: 1 });
  const [obligationOpen, setObligationOpen] = useState(false);
  const [editingObligation, setEditingObligation] = useState<ComplianceObligation | null>(null);
  const [obligationForm, setObligationForm] = useState<ObligationForm>(emptyObligation);
  const [occurrenceOpen, setOccurrenceOpen] = useState(false);
  const [editingOccurrence, setEditingOccurrence] = useState<ComplianceOccurrence | null>(null);
  const [occurrenceForm, setOccurrenceForm] = useState<OccurrenceForm>(emptyOccurrence);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<CorporatePolicy | null>(null);
  const [policyForm, setPolicyForm] = useState<PolicyForm>(emptyPolicy);
  const [versionOpen, setVersionOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<CorporatePolicyVersion | null>(null);
  const [versionForm, setVersionForm] = useState<PolicyVersionForm>(emptyPolicyVersion);
  const [occurrenceAction, setOccurrenceAction] = useState<{
    mode: "complete" | "waive";
    row: ComplianceOccurrence;
  } | null>(null);
  const [actionText, setActionText] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [policyDecision, setPolicyDecision] = useState<{
    approve: boolean;
    row: CorporatePolicyVersion;
  } | null>(null);

  const data = query.data;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!data) return { obligations: [], occurrences: [], policies: [], versions: [] };
    return {
      obligations: data.obligations.filter((row) =>
        [row.code, row.title, row.description, row.category, row.authority, row.legal_basis]
          .join(" ")
          .toLowerCase()
          .includes(term),
      ),
      occurrences: data.occurrences.filter((row) =>
        [row.status, row.due_date, row.evidence_reference, row.notes, row.waiver_reason]
          .join(" ")
          .toLowerCase()
          .includes(term),
      ),
      policies: data.policies.filter((row) =>
        [row.code, row.title, row.policy_type, row.description, row.status]
          .join(" ")
          .toLowerCase()
          .includes(term),
      ),
      versions: data.policyVersions.filter((row) =>
        [row.version_number, row.change_summary, row.status, row.storage_object_key]
          .join(" ")
          .toLowerCase()
          .includes(term),
      ),
    };
  }, [data, search]);

  if (query.error) {
    return <p className="p-6 text-sm text-destructive">{query.error.message}</p>;
  }
  if (query.isLoading || !data) {
    return (
      <p className="p-6 text-sm text-muted-foreground">Carregando compliance e políticas...</p>
    );
  }

  const optionName = (items: DirectoryOption[], id: string | null) =>
    id ? (items.find((item) => item.id === id)?.name ?? id.slice(0, 8)) : "—";
  const obligationName = (id: string) =>
    data.obligations.find((item) => item.id === id)?.title ?? id.slice(0, 8);
  const policyName = (id: string) =>
    data.policies.find((item) => item.id === id)?.title ?? id.slice(0, 8);
  const pendingOccurrences = data.occurrences.filter((row) =>
    ["pending", "in_progress", "overdue"].includes(row.status),
  );
  const overdueOccurrences = pendingOccurrences.filter((row) => row.due_date < today);
  const activeObligations = data.obligations.filter((row) => row.status === "active");
  const publishedPolicies = data.policyVersions.filter((row) => row.status === "published");

  const paginate = <T,>(rows: T[], page: number) =>
    rows.slice((page - 1) * pageSize, page * pageSize);

  const openObligationEditor = (row?: ComplianceObligation) => {
    setEditingObligation(row ?? null);
    setObligationForm(
      row
        ? {
            legal_entity_id: row.legal_entity_id,
            business_unit_id: row.business_unit_id ?? "",
            product_id: row.product_id ?? "",
            service_line_id: row.service_line_id ?? "",
            project_id: row.project_id ?? "",
            contract_id: row.contract_id ?? "",
            intellectual_property_asset_id: row.intellectual_property_asset_id ?? "",
            responsible_user_id: row.responsible_user_id ?? "",
            code: row.code,
            title: row.title,
            description: row.description,
            category: row.category,
            authority: row.authority ?? "",
            legal_basis: row.legal_basis ?? "",
            frequency: row.frequency,
            due_rule: row.due_rule ?? "",
            first_due_date: row.first_due_date ?? "",
            next_due_date: row.next_due_date ?? "",
            risk_level: row.risk_level,
            evidence_required: row.evidence_required,
            remediation_plan: row.remediation_plan ?? "",
            notes: row.notes ?? "",
            status: row.status,
          }
        : { ...emptyObligation, legal_entity_id: data.legalEntities[0]?.id ?? "" },
    );
    setObligationOpen(true);
  };

  const saveObligation = async () => {
    const values = {
      legal_entity_id: obligationForm.legal_entity_id,
      business_unit_id: nullable(obligationForm.business_unit_id),
      product_id: nullable(obligationForm.product_id),
      service_line_id: nullable(obligationForm.service_line_id),
      project_id: nullable(obligationForm.project_id),
      contract_id: nullable(obligationForm.contract_id),
      intellectual_property_asset_id: nullable(obligationForm.intellectual_property_asset_id),
      responsible_user_id: nullable(obligationForm.responsible_user_id),
      code: obligationForm.code.trim().toUpperCase(),
      title: obligationForm.title.trim(),
      description: obligationForm.description.trim(),
      category: obligationForm.category,
      authority: nullable(obligationForm.authority),
      legal_basis: nullable(obligationForm.legal_basis),
      frequency: obligationForm.frequency,
      due_rule: nullable(obligationForm.due_rule),
      first_due_date: nullable(obligationForm.first_due_date),
      next_due_date: nullable(obligationForm.next_due_date),
      risk_level: obligationForm.risk_level,
      evidence_required: obligationForm.evidence_required,
      remediation_plan: nullable(obligationForm.remediation_plan),
      notes: nullable(obligationForm.notes),
      status: obligationForm.status,
    };
    await mutation.mutateAsync(() =>
      editingObligation
        ? updateComplianceObligation(editingObligation.id, editingObligation.version, values)
        : createComplianceObligation(values),
    );
    setObligationOpen(false);
  };

  const openOccurrenceEditor = (row?: ComplianceOccurrence, obligationId?: string) => {
    setEditingOccurrence(row ?? null);
    setOccurrenceForm(
      row
        ? {
            compliance_obligation_id: row.compliance_obligation_id,
            reference_start: row.reference_start ?? "",
            reference_end: row.reference_end ?? "",
            due_date: row.due_date,
            responsible_user_id: row.responsible_user_id ?? "",
            evidence_reference: row.evidence_reference ?? "",
            notes: row.notes ?? "",
          }
        : {
            ...emptyOccurrence,
            compliance_obligation_id: obligationId ?? data.obligations[0]?.id ?? "",
          },
    );
    setOccurrenceOpen(true);
  };

  const saveOccurrence = async () => {
    const values = {
      compliance_obligation_id: occurrenceForm.compliance_obligation_id,
      reference_start: nullable(occurrenceForm.reference_start),
      reference_end: nullable(occurrenceForm.reference_end),
      due_date: occurrenceForm.due_date,
      responsible_user_id: nullable(occurrenceForm.responsible_user_id),
      evidence_reference: nullable(occurrenceForm.evidence_reference),
      notes: nullable(occurrenceForm.notes),
      ...(editingOccurrence ? {} : { status: "pending" }),
    };
    await mutation.mutateAsync(() =>
      editingOccurrence
        ? updateComplianceOccurrence(editingOccurrence.id, editingOccurrence.version, values)
        : createComplianceOccurrence(values),
    );
    setOccurrenceOpen(false);
  };

  const openPolicyEditor = (row?: CorporatePolicy) => {
    setEditingPolicy(row ?? null);
    setPolicyForm(
      row
        ? {
            legal_entity_id: row.legal_entity_id,
            business_unit_id: row.business_unit_id ?? "",
            owner_user_id: row.owner_user_id ?? "",
            code: row.code,
            title: row.title,
            policy_type: row.policy_type,
            description: row.description ?? "",
            status: row.status,
          }
        : { ...emptyPolicy, legal_entity_id: data.legalEntities[0]?.id ?? "" },
    );
    setPolicyOpen(true);
  };

  const savePolicy = async () => {
    const values = {
      legal_entity_id: policyForm.legal_entity_id,
      business_unit_id: nullable(policyForm.business_unit_id),
      owner_user_id: nullable(policyForm.owner_user_id),
      code: policyForm.code.trim().toUpperCase(),
      title: policyForm.title.trim(),
      policy_type: policyForm.policy_type.trim(),
      description: nullable(policyForm.description),
      status: policyForm.status,
    };
    await mutation.mutateAsync(() =>
      editingPolicy
        ? updatePolicy(editingPolicy.id, editingPolicy.version, values)
        : createPolicy(values),
    );
    setPolicyOpen(false);
  };

  const openVersionEditor = (row?: CorporatePolicyVersion, policyId?: string) => {
    setEditingVersion(row ?? null);
    setVersionForm(
      row
        ? {
            policy_id: row.policy_id,
            version_number: String(row.version_number),
            effective_from: row.effective_from,
            effective_to: row.effective_to ?? "",
            change_summary: row.change_summary,
            storage_provider: row.storage_provider,
            storage_bucket: row.storage_bucket ?? "",
            storage_object_key: row.storage_object_key,
            checksum_sha256: row.checksum_sha256,
          }
        : {
            ...emptyPolicyVersion,
            policy_id: policyId ?? data.policies[0]?.id ?? "",
            version_number: String(
              Math.max(
                0,
                ...data.policyVersions
                  .filter((version) => version.policy_id === policyId)
                  .map((version) => version.version_number),
              ) + 1,
            ),
          },
    );
    setVersionOpen(true);
  };

  const saveVersion = async () => {
    const values = {
      policy_id: versionForm.policy_id,
      version_number: Number(versionForm.version_number),
      effective_from: versionForm.effective_from,
      effective_to: nullable(versionForm.effective_to),
      change_summary: versionForm.change_summary.trim(),
      storage_provider: versionForm.storage_provider,
      storage_bucket: nullable(versionForm.storage_bucket),
      storage_object_key: versionForm.storage_object_key.trim(),
      checksum_sha256: versionForm.checksum_sha256.trim().toLowerCase(),
      ...(editingVersion ? {} : { status: "draft" }),
    };
    await mutation.mutateAsync(() =>
      editingVersion
        ? updatePolicyVersion(editingVersion.id, editingVersion.version, values)
        : createPolicyVersion(values),
    );
    setVersionOpen(false);
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Compliance e Políticas"
        description="Controle requisitos permanentes, ocorrências por período, evidências, dispensas justificadas e versões de políticas internas. Renovações de marcas apenas referenciam o ativo cadastrado em Propriedade Intelectual."
      />

      <div className="rounded-sm border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
        <strong>Fonte única de propriedade intelectual:</strong> uma obrigação pode apontar para uma
        marca ou direito existente, mas não cria outro cadastro desse ativo.
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Obrigações ativas" value={String(activeObligations.length)} />
        <Kpi label="Ocorrências pendentes" value={String(pendingOccurrences.length)} />
        <Kpi label="Ocorrências vencidas" value={String(overdueOccurrences.length)} />
        <Kpi label="Políticas publicadas" value={String(publishedPolicies.length)} />
      </div>

      <Input
        className="max-w-xl"
        placeholder="Buscar obrigação, autoridade, ocorrência, política ou versão"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPages({ obligations: 1, occurrences: 1, policies: 1, versions: 1 });
        }}
      />

      <Tabs defaultValue="obligations" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="obligations">Obrigações</TabsTrigger>
          <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>
          <TabsTrigger value="policies">Políticas</TabsTrigger>
        </TabsList>

        <TabsContent value="obligations">
          <Section
            title="Obrigações"
            description="Regra legal, regulatória, fiscal, trabalhista, contratual ou interna permanente."
            action={
              <Button onClick={() => openObligationEditor()}>
                <Plus className="h-4 w-4" /> Nova obrigação
              </Button>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>Código / obrigação</Th>
                  <Th>Categoria</Th>
                  <Th>Responsável</Th>
                  <Th>Próximo prazo</Th>
                  <Th>Risco</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {paginate(filtered.obligations, pages.obligations).length === 0 && (
                  <EmptyRow colSpan={7} label="Nenhuma obrigação encontrada." />
                )}
                {paginate(filtered.obligations, pages.obligations).map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <Td>
                      <strong>{row.code}</strong>
                      <div>{row.title}</div>
                      {row.intellectual_property_asset_id && (
                        <div className="text-xs text-muted-foreground">
                          PI:{" "}
                          {optionName(
                            data.intellectualPropertyAssets,
                            row.intellectual_property_asset_id,
                          )}
                        </div>
                      )}
                    </Td>
                    <Td>
                      {obligationCategories.find(([value]) => value === row.category)?.[1] ??
                        row.category}
                    </Td>
                    <Td>{optionName(data.profiles, row.responsible_user_id)}</Td>
                    <Td>{localDate(row.next_due_date)}</Td>
                    <Td>
                      <StatusPill status={row.risk_level} />
                    </Td>
                    <Td>
                      <StatusPill status={row.status} />
                    </Td>
                    <Td>
                      <Actions>
                        <IconButton
                          label="Editar obrigação"
                          onClick={() => openObligationEditor(row)}
                        >
                          <Pencil />
                        </IconButton>
                        <IconButton
                          label="Gerar ocorrência"
                          onClick={() => openOccurrenceEditor(undefined, row.id)}
                        >
                          <FilePlus2 />
                        </IconButton>
                        {row.status === "draft" && (
                          <IconButton
                            label="Excluir obrigação"
                            destructive
                            onClick={() =>
                              confirmDelete(`Excluir ${row.code}?`, () =>
                                mutation.mutate(() => deleteComplianceObligation(row.id)),
                              )
                            }
                          >
                            <Trash2 />
                          </IconButton>
                        )}
                      </Actions>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager
              page={pages.obligations}
              total={filtered.obligations.length}
              onChange={(page) => setPages((value) => ({ ...value, obligations: page }))}
            />
          </Section>
        </TabsContent>
        <TabsContent value="occurrences">
          <Section
            title="Ocorrências"
            description="Execução concreta da obrigação em um período, com prazo, evidência, conclusão ou dispensa."
            action={
              <Button
                onClick={() => openOccurrenceEditor()}
                disabled={data.obligations.length === 0}
              >
                <Plus className="h-4 w-4" /> Nova ocorrência
              </Button>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>Obrigação</Th>
                  <Th>Período</Th>
                  <Th>Vencimento</Th>
                  <Th>Responsável</Th>
                  <Th>Evidência</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {paginate(filtered.occurrences, pages.occurrences).length === 0 && (
                  <EmptyRow colSpan={7} label="Nenhuma ocorrência encontrada." />
                )}
                {paginate(filtered.occurrences, pages.occurrences).map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <Td>{obligationName(row.compliance_obligation_id)}</Td>
                    <Td>
                      {localDate(row.reference_start)} — {localDate(row.reference_end)}
                    </Td>
                    <Td>{localDate(row.due_date)}</Td>
                    <Td>{optionName(data.profiles, row.responsible_user_id)}</Td>
                    <Td>{row.evidence_reference || "—"}</Td>
                    <Td>
                      <StatusPill status={row.status} />
                    </Td>
                    <Td>
                      <Actions>
                        {["pending", "in_progress", "overdue"].includes(row.status) && (
                          <>
                            <IconButton
                              label="Editar ocorrência"
                              onClick={() => openOccurrenceEditor(row)}
                            >
                              <Pencil />
                            </IconButton>
                            <IconButton
                              label="Concluir ocorrência"
                              onClick={() => {
                                setOccurrenceAction({ mode: "complete", row });
                                setActionText(row.evidence_reference ?? "");
                                setActionNotes("");
                              }}
                            >
                              <CheckCircle2 />
                            </IconButton>
                            <IconButton
                              label="Dispensar ocorrência"
                              onClick={() => {
                                setOccurrenceAction({ mode: "waive", row });
                                setActionText("");
                                setActionNotes("");
                              }}
                            >
                              <Ban />
                            </IconButton>
                            <IconButton
                              label="Excluir ocorrência"
                              destructive
                              onClick={() =>
                                confirmDelete("Excluir esta ocorrência?", () =>
                                  mutation.mutate(() => deleteComplianceOccurrence(row.id)),
                                )
                              }
                            >
                              <Trash2 />
                            </IconButton>
                          </>
                        )}
                      </Actions>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager
              page={pages.occurrences}
              total={filtered.occurrences.length}
              onChange={(page) => setPages((value) => ({ ...value, occurrences: page }))}
            />
          </Section>
        </TabsContent>
        <TabsContent value="policies" className="space-y-4">
          <Section
            title="Políticas internas"
            description="Cadastro da política. O conteúdo histórico permanece nas versões imutáveis."
            action={
              <Button onClick={() => openPolicyEditor()}>
                <Plus className="h-4 w-4" /> Nova política
              </Button>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>Código / política</Th>
                  <Th>Tipo</Th>
                  <Th>Responsável</Th>
                  <Th>Versão atual</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {paginate(filtered.policies, pages.policies).length === 0 && (
                  <EmptyRow colSpan={6} label="Nenhuma política encontrada." />
                )}
                {paginate(filtered.policies, pages.policies).map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <Td>
                      <strong>{row.code}</strong>
                      <div>{row.title}</div>
                    </Td>
                    <Td>{row.policy_type}</Td>
                    <Td>{optionName(data.profiles, row.owner_user_id)}</Td>
                    <Td>
                      {row.current_version_id
                        ? `v${data.policyVersions.find((version) => version.id === row.current_version_id)?.version_number ?? "—"}`
                        : "—"}
                    </Td>
                    <Td>
                      <StatusPill status={row.status} />
                    </Td>
                    <Td>
                      <Actions>
                        <IconButton label="Editar política" onClick={() => openPolicyEditor(row)}>
                          <Pencil />
                        </IconButton>
                        <IconButton
                          label="Criar versão"
                          onClick={() => openVersionEditor(undefined, row.id)}
                        >
                          <FilePlus2 />
                        </IconButton>
                        {row.status === "draft" && !row.current_version_id && (
                          <IconButton
                            label="Excluir política"
                            destructive
                            onClick={() =>
                              confirmDelete(`Excluir ${row.code}?`, () =>
                                mutation.mutate(() => deletePolicy(row.id)),
                              )
                            }
                          >
                            <Trash2 />
                          </IconButton>
                        )}
                      </Actions>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager
              page={pages.policies}
              total={filtered.policies.length}
              onChange={(page) => setPages((value) => ({ ...value, policies: page }))}
            />
          </Section>

          <Section
            title="Versões de políticas"
            description="Versões submetidas, aprovadas e publicadas são rastreáveis; conteúdo aprovado ou publicado não pode ser reescrito."
            action={
              <Button onClick={() => openVersionEditor()} disabled={data.policies.length === 0}>
                <Plus className="h-4 w-4" /> Nova versão
              </Button>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>Política</Th>
                  <Th>Versão</Th>
                  <Th>Vigência</Th>
                  <Th>Resumo</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {paginate(filtered.versions, pages.versions).length === 0 && (
                  <EmptyRow colSpan={6} label="Nenhuma versão encontrada." />
                )}
                {paginate(filtered.versions, pages.versions).map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <Td>{policyName(row.policy_id)}</Td>
                    <Td>v{row.version_number}</Td>
                    <Td>
                      {localDate(row.effective_from)} — {localDate(row.effective_to)}
                    </Td>
                    <Td>
                      <div className="max-w-xs truncate">{row.change_summary}</div>
                      {row.decision_reason && (
                        <div className="text-xs text-destructive">{row.decision_reason}</div>
                      )}
                    </Td>
                    <Td>
                      <StatusPill status={row.status} />
                    </Td>
                    <Td>
                      <Actions>
                        {["draft", "rejected"].includes(row.status) && (
                          <>
                            <IconButton
                              label="Editar versão"
                              onClick={() => openVersionEditor(row)}
                            >
                              <Pencil />
                            </IconButton>
                            <IconButton
                              label="Submeter versão"
                              onClick={() =>
                                mutation.mutate(() => submitPolicyVersion(row.id, row.version))
                              }
                            >
                              <Send />
                            </IconButton>
                            <IconButton
                              label="Excluir versão"
                              destructive
                              onClick={() =>
                                confirmDelete(`Excluir a versão ${row.version_number}?`, () =>
                                  mutation.mutate(() => deletePolicyVersion(row.id)),
                                )
                              }
                            >
                              <Trash2 />
                            </IconButton>
                          </>
                        )}
                        {row.status === "pending_approval" && (
                          <>
                            <IconButton
                              label="Aprovar versão"
                              onClick={() => {
                                setPolicyDecision({ approve: true, row });
                                setActionText("");
                              }}
                            >
                              <BadgeCheck />
                            </IconButton>
                            <IconButton
                              label="Rejeitar versão"
                              onClick={() => {
                                setPolicyDecision({ approve: false, row });
                                setActionText("");
                              }}
                            >
                              <Ban />
                            </IconButton>
                          </>
                        )}
                        {row.status === "approved" && (
                          <IconButton
                            label="Publicar versão"
                            onClick={() =>
                              mutation.mutate(() => publishPolicyVersion(row.id, row.version))
                            }
                          >
                            <Upload />
                          </IconButton>
                        )}
                      </Actions>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager
              page={pages.versions}
              total={filtered.versions.length}
              onChange={(page) => setPages((value) => ({ ...value, versions: page }))}
            />
          </Section>
        </TabsContent>
      </Tabs>

      <Dialog open={obligationOpen} onOpenChange={setObligationOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingObligation ? "Editar obrigação" : "Nova obrigação"}</DialogTitle>
            <DialogDescription>
              Cadastre a regra permanente. Evidência e conclusão pertencem às ocorrências.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Entidade jurídica">
              <Select
                required
                value={obligationForm.legal_entity_id}
                options={data.legalEntities}
                onChange={(value) =>
                  setObligationForm((form) => ({ ...form, legal_entity_id: value }))
                }
              />
            </Field>
            <Field label="Unidade de negócio">
              <Select
                allowEmpty
                value={obligationForm.business_unit_id}
                options={data.businessUnits}
                onChange={(value) =>
                  setObligationForm((form) => ({ ...form, business_unit_id: value }))
                }
              />
            </Field>
            <Field label="Código">
              <Input
                value={obligationForm.code}
                onChange={(event) =>
                  setObligationForm((form) => ({ ...form, code: event.target.value }))
                }
              />
            </Field>
            <Field label="Título">
              <Input
                value={obligationForm.title}
                onChange={(event) =>
                  setObligationForm((form) => ({ ...form, title: event.target.value }))
                }
              />
            </Field>
            <Field label="Categoria">
              <NativeSelect
                value={obligationForm.category}
                options={obligationCategories}
                onChange={(value) => setObligationForm((form) => ({ ...form, category: value }))}
              />
            </Field>
            <Field label="Frequência">
              <NativeSelect
                value={obligationForm.frequency}
                options={frequencies}
                onChange={(value) => setObligationForm((form) => ({ ...form, frequency: value }))}
              />
            </Field>
            <Field label="Risco">
              <NativeSelect
                value={obligationForm.risk_level}
                options={riskLevels}
                onChange={(value) => setObligationForm((form) => ({ ...form, risk_level: value }))}
              />
            </Field>
            <Field label="Status">
              <NativeSelect
                value={obligationForm.status}
                options={obligationStatuses}
                onChange={(value) => setObligationForm((form) => ({ ...form, status: value }))}
              />
            </Field>
            <Field label="Autoridade">
              <Input
                value={obligationForm.authority}
                onChange={(event) =>
                  setObligationForm((form) => ({ ...form, authority: event.target.value }))
                }
              />
            </Field>
            <Field label="Base legal">
              <Input
                value={obligationForm.legal_basis}
                onChange={(event) =>
                  setObligationForm((form) => ({ ...form, legal_basis: event.target.value }))
                }
              />
            </Field>
            <Field label="Primeiro vencimento">
              <Input
                type="date"
                value={obligationForm.first_due_date}
                onChange={(event) =>
                  setObligationForm((form) => ({ ...form, first_due_date: event.target.value }))
                }
              />
            </Field>
            <Field label="Próximo vencimento">
              <Input
                type="date"
                value={obligationForm.next_due_date}
                onChange={(event) =>
                  setObligationForm((form) => ({ ...form, next_due_date: event.target.value }))
                }
              />
            </Field>
            <Field label="Responsável">
              <Select
                allowEmpty
                value={obligationForm.responsible_user_id}
                options={data.profiles}
                onChange={(value) =>
                  setObligationForm((form) => ({ ...form, responsible_user_id: value }))
                }
              />
            </Field>
            <Field label="Ativo de propriedade intelectual">
              <Select
                allowEmpty
                value={obligationForm.intellectual_property_asset_id}
                options={data.intellectualPropertyAssets}
                onChange={(value) =>
                  setObligationForm((form) => ({ ...form, intellectual_property_asset_id: value }))
                }
              />
            </Field>
            <Field label="Produto">
              <Select
                allowEmpty
                value={obligationForm.product_id}
                options={data.products}
                onChange={(value) => setObligationForm((form) => ({ ...form, product_id: value }))}
              />
            </Field>
            <Field label="Projeto">
              <Select
                allowEmpty
                value={obligationForm.project_id}
                options={data.projects}
                onChange={(value) => setObligationForm((form) => ({ ...form, project_id: value }))}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Descrição">
                <Textarea
                  value={obligationForm.description}
                  onChange={(event) =>
                    setObligationForm((form) => ({ ...form, description: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Regra de vencimento">
                <Textarea
                  value={obligationForm.due_rule}
                  onChange={(event) =>
                    setObligationForm((form) => ({ ...form, due_rule: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Plano de remediação">
                <Textarea
                  value={obligationForm.remediation_plan}
                  onChange={(event) =>
                    setObligationForm((form) => ({ ...form, remediation_plan: event.target.value }))
                  }
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={obligationForm.evidence_required}
                onChange={(event) =>
                  setObligationForm((form) => ({
                    ...form,
                    evidence_required: event.target.checked,
                  }))
                }
              />{" "}
              Evidência obrigatória para conclusão
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObligationOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                !obligationForm.legal_entity_id ||
                !obligationForm.code.trim() ||
                !obligationForm.title.trim() ||
                !obligationForm.description.trim()
              }
              onClick={saveObligation}
            >
              Salvar obrigação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={occurrenceOpen} onOpenChange={setOccurrenceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOccurrence ? "Editar ocorrência" : "Nova ocorrência"}</DialogTitle>
            <DialogDescription>
              Registre a execução concreta de uma obrigação em um período.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Obrigação">
              <Select
                required
                value={occurrenceForm.compliance_obligation_id}
                options={data.obligations.map((row) => ({
                  id: row.id,
                  name: `${row.code} — ${row.title}`,
                }))}
                onChange={(value) =>
                  setOccurrenceForm((form) => ({ ...form, compliance_obligation_id: value }))
                }
              />
            </Field>
            <Field label="Responsável">
              <Select
                allowEmpty
                value={occurrenceForm.responsible_user_id}
                options={data.profiles}
                onChange={(value) =>
                  setOccurrenceForm((form) => ({ ...form, responsible_user_id: value }))
                }
              />
            </Field>
            <Field label="Início do período">
              <Input
                type="date"
                value={occurrenceForm.reference_start}
                onChange={(event) =>
                  setOccurrenceForm((form) => ({ ...form, reference_start: event.target.value }))
                }
              />
            </Field>
            <Field label="Fim do período">
              <Input
                type="date"
                value={occurrenceForm.reference_end}
                onChange={(event) =>
                  setOccurrenceForm((form) => ({ ...form, reference_end: event.target.value }))
                }
              />
            </Field>
            <Field label="Vencimento">
              <Input
                type="date"
                value={occurrenceForm.due_date}
                onChange={(event) =>
                  setOccurrenceForm((form) => ({ ...form, due_date: event.target.value }))
                }
              />
            </Field>
            <Field label="Evidência já disponível">
              <Input
                value={occurrenceForm.evidence_reference}
                onChange={(event) =>
                  setOccurrenceForm((form) => ({ ...form, evidence_reference: event.target.value }))
                }
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notas">
                <Textarea
                  value={occurrenceForm.notes}
                  onChange={(event) =>
                    setOccurrenceForm((form) => ({ ...form, notes: event.target.value }))
                  }
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOccurrenceOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                !occurrenceForm.compliance_obligation_id ||
                !occurrenceForm.due_date
              }
              onClick={saveOccurrence}
            >
              Salvar ocorrência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Editar política" : "Nova política"}</DialogTitle>
            <DialogDescription>
              Cadastre o documento institucional; o conteúdo histórico ficará nas versões.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Entidade jurídica">
              <Select
                required
                value={policyForm.legal_entity_id}
                options={data.legalEntities}
                onChange={(value) => setPolicyForm((form) => ({ ...form, legal_entity_id: value }))}
              />
            </Field>
            <Field label="Unidade de negócio">
              <Select
                allowEmpty
                value={policyForm.business_unit_id}
                options={data.businessUnits}
                onChange={(value) =>
                  setPolicyForm((form) => ({ ...form, business_unit_id: value }))
                }
              />
            </Field>
            <Field label="Código">
              <Input
                value={policyForm.code}
                onChange={(event) =>
                  setPolicyForm((form) => ({ ...form, code: event.target.value }))
                }
              />
            </Field>
            <Field label="Título">
              <Input
                value={policyForm.title}
                onChange={(event) =>
                  setPolicyForm((form) => ({ ...form, title: event.target.value }))
                }
              />
            </Field>
            <Field label="Tipo">
              <Input
                value={policyForm.policy_type}
                onChange={(event) =>
                  setPolicyForm((form) => ({ ...form, policy_type: event.target.value }))
                }
              />
            </Field>
            <Field label="Responsável">
              <Select
                allowEmpty
                value={policyForm.owner_user_id}
                options={data.profiles}
                onChange={(value) => setPolicyForm((form) => ({ ...form, owner_user_id: value }))}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Descrição">
                <Textarea
                  value={policyForm.description}
                  onChange={(event) =>
                    setPolicyForm((form) => ({ ...form, description: event.target.value }))
                  }
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                !policyForm.legal_entity_id ||
                !policyForm.code.trim() ||
                !policyForm.title.trim()
              }
              onClick={savePolicy}
            >
              Salvar política
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingVersion ? "Editar versão" : "Nova versão"}</DialogTitle>
            <DialogDescription>
              Informe referência documental e checksum SHA-256 para reprodução histórica.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Política">
              <Select
                required
                value={versionForm.policy_id}
                options={data.policies.map((row) => ({
                  id: row.id,
                  name: `${row.code} — ${row.title}`,
                }))}
                onChange={(value) => setVersionForm((form) => ({ ...form, policy_id: value }))}
              />
            </Field>
            <Field label="Número da versão">
              <Input
                type="number"
                min="1"
                value={versionForm.version_number}
                onChange={(event) =>
                  setVersionForm((form) => ({ ...form, version_number: event.target.value }))
                }
              />
            </Field>
            <Field label="Início da vigência">
              <Input
                type="date"
                value={versionForm.effective_from}
                onChange={(event) =>
                  setVersionForm((form) => ({ ...form, effective_from: event.target.value }))
                }
              />
            </Field>
            <Field label="Fim da vigência">
              <Input
                type="date"
                value={versionForm.effective_to}
                onChange={(event) =>
                  setVersionForm((form) => ({ ...form, effective_to: event.target.value }))
                }
              />
            </Field>
            <Field label="Referência do documento">
              <Input
                value={versionForm.storage_object_key}
                onChange={(event) =>
                  setVersionForm((form) => ({ ...form, storage_object_key: event.target.value }))
                }
              />
            </Field>
            <Field label="Checksum SHA-256">
              <Input
                value={versionForm.checksum_sha256}
                onChange={(event) =>
                  setVersionForm((form) => ({ ...form, checksum_sha256: event.target.value }))
                }
                placeholder="64 caracteres hexadecimais"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Resumo das alterações">
                <Textarea
                  value={versionForm.change_summary}
                  onChange={(event) =>
                    setVersionForm((form) => ({ ...form, change_summary: event.target.value }))
                  }
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                !versionForm.policy_id ||
                !versionForm.effective_from ||
                !versionForm.change_summary.trim() ||
                !versionForm.storage_object_key.trim() ||
                !/^[a-fA-F0-9]{64}$/.test(versionForm.checksum_sha256)
              }
              onClick={saveVersion}
            >
              Salvar versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(occurrenceAction)}
        onOpenChange={(open) => !open && setOccurrenceAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {occurrenceAction?.mode === "complete"
                ? "Concluir ocorrência"
                : "Dispensar ocorrência"}
            </DialogTitle>
            <DialogDescription>
              {occurrenceAction?.mode === "complete"
                ? "Informe a evidência do cumprimento. A operação exige MFA e permissão de conclusão."
                : "A dispensa exige justificativa rastreável e permissão específica."}
            </DialogDescription>
          </DialogHeader>
          <Field
            label={
              occurrenceAction?.mode === "complete"
                ? "Referência da evidência"
                : "Motivo da dispensa"
            }
          >
            <Textarea value={actionText} onChange={(event) => setActionText(event.target.value)} />
          </Field>
          {occurrenceAction?.mode === "complete" && (
            <Field label="Notas">
              <Textarea
                value={actionNotes}
                onChange={(event) => setActionNotes(event.target.value)}
              />
            </Field>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOccurrenceAction(null)}>
              Cancelar
            </Button>
            <Button
              disabled={mutation.isPending || actionText.trim().length < 3}
              onClick={async () => {
                if (!occurrenceAction) return;
                await mutation.mutateAsync(() =>
                  occurrenceAction.mode === "complete"
                    ? completeComplianceOccurrence(
                        occurrenceAction.row.id,
                        occurrenceAction.row.version,
                        actionText,
                        actionNotes,
                      )
                    : waiveComplianceOccurrence(
                        occurrenceAction.row.id,
                        occurrenceAction.row.version,
                        actionText,
                      ),
                );
                setOccurrenceAction(null);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(policyDecision)}
        onOpenChange={(open) => !open && setPolicyDecision(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {policyDecision?.approve ? "Aprovar versão" : "Rejeitar versão"}
            </DialogTitle>
            <DialogDescription>
              A decisão exige MFA e não permite autoaprovação pelo criador ou solicitante.
            </DialogDescription>
          </DialogHeader>
          {!policyDecision?.approve && (
            <Field label="Motivo da rejeição">
              <Textarea
                value={actionText}
                onChange={(event) => setActionText(event.target.value)}
              />
            </Field>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyDecision(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                mutation.isPending || (!policyDecision?.approve && actionText.trim().length < 3)
              }
              onClick={async () => {
                if (!policyDecision) return;
                await mutation.mutateAsync(() =>
                  decidePolicyVersion(
                    policyDecision.row.id,
                    policyDecision.row.version,
                    policyDecision.approve,
                    actionText,
                  ),
                );
                setPolicyDecision(null);
              }}
            >
              Confirmar decisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-sm border">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="sm:ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}
function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap border-b px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
function Actions({ children }: { children: ReactNode }) {
  return <div className="flex gap-1">{children}</div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Select({
  value,
  options,
  onChange,
  allowEmpty,
  required,
}: {
  value: string;
  options: DirectoryOption[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  required?: boolean;
}) {
  return (
    <select
      className={fieldClass}
      value={value}
      required={required}
      onChange={(event) => onChange(event.target.value)}
    >
      {allowEmpty && <option value="">Não vinculado</option>}
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
function NativeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([itemValue, label]) => (
        <option key={itemValue} value={itemValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
function IconButton({
  label,
  children,
  onClick,
  destructive,
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
      variant="ghost"
      title={label}
      aria-label={label}
      className={destructive ? "text-destructive" : undefined}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t p-3 text-sm">
      <span>{total} registro(s)</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </Button>
        <span>
          Página {page} de {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
function confirmDelete(message: string, action: () => void) {
  if (window.confirm(message)) action();
}
