import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { RowActionsMenu } from "@/shared/components/row-actions-menu";
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
import { EmptyRow, Kpi, PageHeader, Panel, StatusPill, UnitTag } from "@/shared/components/ui-kit";
import { useWorkspace } from "@/app/providers/workspace-context";
import { hasPermission } from "@/modules/access-control/api";
import {
  listContractReferenceData,
  type ContractReferenceData,
} from "@/modules/contracts/reference-data-api";
import {
  createContractRecord,
  deleteContractRecord,
  listContractDirectory,
  terminateContract,
  updateContractRecord,
} from "@/modules/contracts/api";
import { ContractDetailsDialog } from "@/modules/contracts/dialogs/contract-details-dialog";
import { ContractWizardDialog } from "@/modules/contracts/dialogs/contract-wizard-dialog";
import type { Contract, ContractDirectory, ContractStatus } from "@/modules/contracts/types";

type ModalState =
  { action: "create" } | { action: "view" | "edit" | "destroy"; record: Contract } | null;

type PermissionSet = {
  read: boolean;
  create: boolean;
  updateDraft: boolean;
  approve: boolean;
  terminate: boolean;
  documentsManage: boolean;
  auditRead: boolean;
};

export function ContractsPage() {
  const { unit } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const directoryQuery = useQuery({
    queryKey: ["contract-directory"],
    queryFn: listContractDirectory,
  });
  const structureQuery = useQuery({
    queryKey: ["contract-reference-data"],
    queryFn: listContractReferenceData,
  });
  const permissionsQuery = useQuery({
    queryKey: ["contract-permissions"],
    queryFn: async (): Promise<PermissionSet> => {
      const [read, create, updateDraft, approve, terminate, documentsManage, auditRead] =
        await Promise.all([
          hasPermission("contracts.read"),
          hasPermission("contracts.create"),
          hasPermission("contracts.update_draft"),
          hasPermission("contracts.approve"),
          hasPermission("contracts.terminate"),
          hasPermission("contracts.documents.manage"),
          hasPermission("audit.read"),
        ]);
      return { read, create, updateDraft, approve, terminate, documentsManage, auditRead };
    },
  });

  const directory = directoryQuery.data;
  const structure = structureQuery.data;
  const permissions = permissionsQuery.data;
  const normalizedSearch = search.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!directory || !structure) return [];
    return directory.contracts.filter((contract) => {
      const unitCode = unitCodeFor(structure, contract.business_unit_id);
      const matchesWorkspace = unit === "TODAS" || unit === unitCode;
      const matchesType = typeFilter === "all" || contract.contract_type === typeFilter;
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      const platform = contractSigningPlatform(directory, contract.id);
      const matchesPlatform = platformFilter === "all" || platform === platformFilter;
      const matchesSearch =
        !normalizedSearch ||
        `${contract.code} ${contract.title} ${contract.contract_type} ${platform}`
          .toLowerCase()
          .includes(normalizedSearch) ||
        primaryPartyName(directory, contract.id).toLowerCase().includes(normalizedSearch);
      return matchesWorkspace && matchesType && matchesStatus && matchesPlatform && matchesSearch;
    });
  }, [directory, normalizedSearch, platformFilter, statusFilter, structure, typeFilter, unit]);

  const exportContracts = useCallback(() => {
    if (!directory) return;
    const headers = [
      "Código",
      "Título",
      "Contraparte",
      "Tipo",
      "Plataforma",
      "Status",
      "Início",
      "Fim",
      "Moeda",
      "Valor",
    ];
    const lines = rows.map((contract) =>
      [
        contract.code,
        contract.title,
        primaryPartyName(directory, contract.id),
        contractTypeLabel(contract.contract_type),
        contractSigningPlatform(directory, contract.id),
        contractStatusLabel(contract.status),
        contract.starts_on ?? "",
        contract.ends_on ?? "",
        contract.currency_code,
        contract.base_amount ?? "",
      ]
        .map(escapeCsv)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `contratos-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [directory, rows]);

  useEffect(() => {
    const createContract = () => setModal({ action: "create" });
    const importContractsFromTopbar = () => importInputRef.current?.click();
    window.addEventListener("contracts:create", createContract);
    window.addEventListener("contracts:import", importContractsFromTopbar);
    window.addEventListener("contracts:export", exportContracts);
    return () => {
      window.removeEventListener("contracts:create", createContract);
      window.removeEventListener("contracts:import", importContractsFromTopbar);
      window.removeEventListener("contracts:export", exportContracts);
    };
  }, [exportContracts]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["contract-directory"] });
  }

  if (directoryQuery.isLoading || structureQuery.isLoading || permissionsQuery.isLoading) {
    return <LoadingState />;
  }

  if (
    directoryQuery.isError ||
    structureQuery.isError ||
    permissionsQuery.isError ||
    !directory ||
    !structure ||
    !permissions
  ) {
    return (
      <ErrorState
        error={directoryQuery.error ?? structureQuery.error ?? permissionsQuery.error}
        retry={() => {
          void directoryQuery.refetch();
          void structureQuery.refetch();
          void permissionsQuery.refetch();
        }}
      />
    );
  }

  const loadedDirectory = directory;
  const loadedStructure = structure;

  const totalContracts = rows.length;
  const active = rows.filter((contract) => contract.status === "active").length;
  const signed = rows.filter(
    (contract) =>
      contract.status !== "active" &&
      directory.versions.some(
        (version) => version.contract_id === contract.id && version.status === "approved",
      ),
  ).length;
  const awaitingSignature = rows.filter(
    (contract) => contract.status === "pending_signature",
  ).length;
  const underAnalysis = rows.filter((contract) =>
    ["draft", "in_review", "renewal"].includes(contract.status),
  ).length;
  const closed = rows.filter((contract) =>
    ["expired", "terminated", "cancelled"].includes(contract.status),
  ).length;
  const effectiveValue = rows
    .filter(
      (contract) =>
        contract.status === "active" ||
        directory.versions.some(
          (version) => version.contract_id === contract.id && version.status === "approved",
        ),
    )
    .reduce((sum, contract) => sum + Number(contract.base_amount ?? 0), 0);
  const typeOptions = [
    ...new Set(directory.contracts.map((contract) => contract.contract_type)),
  ].sort((a, b) => contractTypeLabel(a).localeCompare(contractTypeLabel(b), "pt-BR"));
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const hasActiveFilters =
    Boolean(search.trim()) ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    platformFilter !== "all";

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPlatformFilter("all");
    setPage(1);
  }

  async function importContracts(file: File) {
    try {
      const legalEntity = loadedStructure.legalEntities[0];
      const fallbackUnit =
        loadedStructure.businessUnits.find(
          (item) => item.code !== "CORPORATIVO" && item.status === "active",
        ) ?? loadedStructure.businessUnits.find((item) => item.status === "active");
      if (!legalEntity || !fallbackUnit) throw new Error("Estrutura corporativa incompleta.");
      const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error("O CSV não possui registros para importação.");
      const headers = parseCsvLine(lines[0]).map((item) => item.trim().toLowerCase());
      let imported = 0;
      for (const line of lines.slice(1)) {
        const values = parseCsvLine(line);
        const row = new Map(headers.map((header, index) => [header, values[index] ?? ""]));
        const title = row.get("título") || row.get("titulo") || "";
        if (!title.trim()) continue;
        const code = normalizeCode(row.get("código") || row.get("codigo") || title);
        const amountText =
          row
            .get("valor")
            ?.replace(/[^0-9,.-]/g, "")
            .replace(",", ".") ?? "";
        await createContractRecord<Contract>("contracts", {
          legal_entity_id: legalEntity.id,
          business_unit_id: fallbackUnit.id,
          product_id: null,
          service_line_id: null,
          code,
          title: title.trim(),
          contract_type: row.get("tipo")?.trim() || "service",
          currency_code: row.get("moeda")?.trim().toUpperCase() || "BRL",
          billing_frequency: "none",
          base_amount: amountText ? Number(amountText) : null,
          recognition_regime: "COMPETENCIA",
          starts_on: row.get("início") || row.get("inicio") || null,
          ends_on: row.get("fim") || null,
          auto_renewal: false,
          renewal_notice_days: 30,
          responsible_user_id: user?.id ?? null,
          status: "draft",
          notes: "Importado por CSV.",
          created_by: user?.id ?? null,
        });
        imported += 1;
      }
      await refresh();
      toast.success(`${imported} contrato(s) importado(s).`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importContracts(file);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Total de contratos" value={String(totalContracts)} hint="na carteira" />
        <Kpi label="Vigentes" value={String(active)} hint="em vigor" tone="positive" />
        <Kpi label="Assinados" value={String(signed)} hint="versão aprovada" />
        <Kpi
          label="Aguardando assinatura"
          value={String(awaitingSignature)}
          hint="pendentes de assinatura"
          tone={awaitingSignature > 0 ? "warning" : "neutral"}
        />
        <Kpi
          label="Em análise"
          value={String(underAnalysis)}
          hint="rascunho, revisão ou renovação"
        />
        <Kpi label="Encerrados" value={String(closed)} hint="expirados, encerrados ou cancelados" />
        <Kpi
          label="Valor total"
          value={formatMoney(
            effectiveValue,
            rows.find((item) => item.base_amount)?.currency_code ?? "BRL",
          )}
          hint="vigentes e aprovados"
        />
      </div>

      <Panel
        title="Lista de contratos"
        description="Acompanhe contratos, contrapartes, assinatura, vigência, valores e documentação legal."
      >
        <div className="grid gap-2 border-b px-4 py-3 md:grid-cols-2 xl:grid-cols-[minmax(320px,1fr)_repeat(3,minmax(150px,auto))_auto]">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar título, código ou contraparte"
            className="h-9 min-w-0 w-full rounded-sm"
          />
          <div className="contents">
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
              className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
            >
              <option value="all">Todos os tipos</option>
              {typeOptions.map((value) => (
                <option key={value} value={value}>
                  {contractTypeLabel(value)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
            >
              <option value="all">Todos os status</option>
              {contractStatusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={platformFilter}
              onChange={(event) => {
                setPlatformFilter(event.target.value);
                setPage(1);
              }}
              className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
            >
              <option value="all">Todas as plataformas</option>
              <option value="Autentique">Autentique</option>
              <option value="Clicksign">Clicksign</option>
              <option value="DocuSign">DocuSign</option>
              <option value="Interna">Interna</option>
              <option value="Sem plataforma">Sem plataforma</option>
            </select>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="h-9" onClick={clearFilters}>
                <X className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
        </div>
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">
          {rows.length} de {directory.contracts.length} contratos
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                <th className="px-4 py-3 text-left">Título</th>
                <th className="px-4 py-3 text-left">Contraparte</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Plataforma</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="w-44 px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <EmptyRow colSpan={8} label="Nenhum contrato encontrado." />
              )}
              {visibleRows.map((contract) => {
                const canEdit =
                  permissions.updateDraft && editableContractStatuses.has(contract.status);
                return (
                  <tr key={contract.id} className="border-t align-top hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{contract.title}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {contract.code}
                      </p>
                    </td>
                    <td className="px-4 py-3">{primaryPartyName(directory, contract.id)}</td>
                    <td className="px-4 py-3">{contractTypeLabel(contract.contract_type)}</td>
                    <td className="px-4 py-3">{contractSigningPlatform(directory, contract.id)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={contractStatusLabel(contract.status)} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {formatDate(contract.starts_on)} → {formatDate(contract.ends_on)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {contract.base_amount === null
                        ? "—"
                        : formatMoney(Number(contract.base_amount), contract.currency_code)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActionsMenu
                        onView={() => setModal({ action: "view", record: contract })}
                        onEdit={() => setModal({ action: "edit", record: contract })}
                        editDisabled={!canEdit}
                        onDelete={() => setModal({ action: "destroy", record: contract })}
                        deleteDisabled={!permissions.updateDraft && !permissions.terminate}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Itens por página</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-8 rounded-sm border bg-background px-2"
            >
              {[10, 20, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <span className="text-muted-foreground">
              Página {safePage} de {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Panel>

      <ContractWizardDialog
        state={
          modal?.action === "create"
            ? modal
            : modal?.action === "edit"
              ? { action: "edit", record: modal.record }
              : null
        }
        directory={directory}
        structure={structure}
        userId={user?.id ?? null}
        onClose={() => setModal(null)}
        onChanged={refresh}
      />
      <ContractDetailsDialog
        contract={modal?.action === "view" ? modal.record : null}
        directory={directory}
        structure={structure}
        permissions={permissions}
        userId={user?.id ?? null}
        onClose={() => setModal(null)}
        onChanged={refresh}
      />
      <ContractDestroyDialog
        contract={modal?.action === "destroy" ? modal.record : null}
        directory={directory}
        permissions={permissions}
        onClose={() => setModal(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function ContractDestroyDialog({
  contract,
  directory,
  permissions,
  onClose,
  onChanged,
}: {
  contract: Contract | null;
  directory: ContractDirectory;
  permissions: PermissionSet;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!contract) return null;
  const target: Contract = contract;

  const dependencyCount =
    directory.parties.filter((item) => item.contract_id === target.id).length +
    directory.versions.filter((item) => item.contract_id === target.id).length;
  const physicalDelete = target.status === "draft" && dependencyCount === 0;
  const canTerminate =
    permissions.terminate &&
    ["draft", "in_review", "pending_signature", "active", "renewal"].includes(target.status);
  const expected = target.code;

  async function destroy() {
    setSubmitting(true);
    try {
      if (physicalDelete) {
        await deleteContractRecord("contracts", target.id);
        toast.success("Contrato em rascunho excluído definitivamente.");
      } else {
        if (!canTerminate) throw new Error("O contrato não pode ser encerrado na situação atual.");
        await terminateContract({
          contractId: target.id,
          expectedVersion: target.version,
          reason: reason.trim(),
        });
        toast.success("Contrato cancelado ou encerrado com histórico preservado.");
      }
      await onChanged();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{physicalDelete ? "Excluir contrato" : "Encerrar contrato"}</DialogTitle>
          <DialogDescription>
            {physicalDelete
              ? "O rascunho não possui vínculos e poderá ser removido fisicamente."
              : "O contrato possui histórico ou vínculos. A operação preservará versões, partes e documentos."}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">{target.title}</p>
          <p className="num mt-1 text-xs text-muted-foreground">{target.code}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Dependências diretas: {dependencyCount}
          </p>
        </div>
        {!physicalDelete && (
          <TextAreaField label="Motivo obrigatório" value={reason} onChange={setReason} />
        )}
        <div className="space-y-2">
          <Label htmlFor="contract-delete-confirmation">Digite {expected} para confirmar</Label>
          <Input
            id="contract-delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={
              submitting ||
              confirmation !== expected ||
              (!physicalDelete && (!canTerminate || reason.trim().length < 5))
            }
            onClick={() => void destroy()}
          >
            {submitting && <LoaderCircle className="animate-spin" />}
            {physicalDelete ? "Excluir definitivamente" : "Encerrar com histórico"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        min={min}
        max={max}
        step={step}
      />
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
    <div className="space-y-2">
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={4000}
        className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm"
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
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-sm border bg-background px-3 text-sm"
        required
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="animate-spin" /> Carregando contratos…
    </div>
  );
}

function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="space-y-4">
      <PageHeader title="Contratos" description="A consulta protegida falhou." />
      <Panel title="Erro">
        <div className="space-y-3 p-4">
          <p className="text-sm text-destructive">{errorMessage(error)}</p>
          <Button variant="outline" onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      </Panel>
    </div>
  );
}

const editableContractStatuses = new Set<ContractStatus>([
  "draft",
  "in_review",
  "pending_signature",
]);

export const contractStatusOptions: Array<readonly [ContractStatus, string]> = [
  ["draft", "Rascunho"],
  ["in_review", "Em revisão"],
  ["pending_signature", "Em assinatura"],
  ["active", "Ativo"],
  ["renewal", "Renovação"],
  ["expired", "Expirado"],
  ["terminated", "Encerrado"],
  ["cancelled", "Cancelado"],
];

const contractTypeOptions: Array<readonly [string, string]> = [
  ["client", "Cliente"],
  ["supplier", "Fornecedor"],
  ["service", "Prestação de serviço"],
  ["participation", "Participação econômica"],
  ["investment", "Investimento"],
  ["partnership", "Parceria"],
  ["nda", "Confidencialidade"],
  ["employment", "Trabalho"],
  ["other", "Outro"],
];

const billingOptions: Array<readonly [string, string]> = [
  ["none", "Sem faturamento"],
  ["one_time", "Pagamento único"],
  ["weekly", "Semanal"],
  ["monthly", "Mensal"],
  ["quarterly", "Trimestral"],
  ["semiannual", "Semestral"],
  ["annual", "Anual"],
  ["milestone", "Por marco"],
  ["usage_based", "Por uso"],
];

const regimeOptions: Array<readonly [string, string]> = [
  ["COMPETENCIA", "Competência"],
  ["CAIXA", "Caixa"],
  ["HIBRIDO_CONTRATUAL", "Híbrido contratual"],
];

function currentContractVersion(directory: ContractDirectory, contractId: string) {
  return directory.versions
    .filter((version) => version.contract_id === contractId)
    .sort((a, b) => b.version_number - a.version_number)[0];
}

function primaryPartyName(directory: ContractDirectory, contractId: string): string {
  const relation =
    directory.parties.find(
      (item) => item.contract_id === contractId && item.status === "active" && item.is_primary,
    ) ??
    directory.parties.find((item) => item.contract_id === contractId && item.status === "active");
  if (!relation) return "Sem contraparte";
  const party = directory.partyOptions.find((item) => item.id === relation.party_id);
  return party?.trade_name || party?.legal_name || "Cadastro indisponível";
}

function unitCodeFor(structure: ContractReferenceData, unitId: string): string {
  return structure.businessUnits.find((item) => item.id === unitId)?.code ?? "UNIDADE_REMOVIDA";
}

function scopeName(structure: ContractReferenceData, contract: Contract): string {
  if (contract.product_id)
    return (
      structure.products.find((item) => item.id === contract.product_id)?.name ?? "Produto removido"
    );
  if (contract.service_line_id)
    return (
      structure.serviceLines.find((item) => item.id === contract.service_line_id)?.name ??
      "Serviço removido"
    );
  return "Escopo geral da unidade";
}

function normalizeCode(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+/, "")
    .slice(0, 40);
}

function contractTypeLabel(value: string): string {
  return contractTypeOptions.find(([key]) => key === value)?.[1] ?? value;
}

function billingFrequencyLabel(value: string): string {
  return billingOptions.find(([key]) => key === value)?.[1] ?? value;
}

function contractStatusLabel(value: ContractStatus): string {
  return contractStatusOptions.find(([key]) => key === value)?.[1].toLowerCase() ?? value;
}

function versionStatusLabel(value: string): string {
  return (
    {
      draft: "rascunho",
      in_review: "em revisão",
      approved: "aprovada",
      superseded: "substituída",
      rejected: "rejeitada",
    }[value] ?? value
  );
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "A operação não pôde ser concluída.";
}

export type { PermissionSet };
export { errorMessage, formatDate, formatMoney, unitCodeFor };

function contractSigningPlatform(directory: ContractDirectory, contractId: string) {
  const references = directory.documents
    .filter((document) =>
      directory.versions.some(
        (version) =>
          version.id === document.contract_version_id && version.contract_id === contractId,
      ),
    )
    .flatMap((document) => [
      document.external_reference ?? "",
      document.storage_provider ?? "",
      document.label ?? "",
    ])
    .join(" ")
    .toLowerCase();
  if (references.includes("autentique")) return "Autentique";
  if (references.includes("clicksign")) return "Clicksign";
  if (references.includes("docusign")) return "DocuSign";
  if (references.trim()) return "Interna";
  return "Sem plataforma";
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}
