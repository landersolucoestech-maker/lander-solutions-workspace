import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
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
import { listTransactionReferenceData, type TransactionReferenceData } from "./reference-data";
import {
  createFinanceRecord,
  deleteFinanceRecord,
  listFinancialDirectory,
  updateFinanceRecord,
} from "./api";
import { FinancialDocumentDetailsDialog } from "./financial-document-details-dialog";
import type {
  FinancialDirectory,
  FinancialDocument,
  FinancialDocumentNature,
  FinancialDocumentStatus,
} from "./types";

type ModalState =
  { action: "create" } | { action: "view" | "edit" | "destroy"; record: FinancialDocument } | null;

export type FinancePermissionSet = {
  read: boolean;
  createDocument: boolean;
  manageDraft: boolean;
  approveDocument: boolean;
  createSettlement: boolean;
  postSettlement: boolean;
  cashManage: boolean;
  ledgerRead: boolean;
  ledgerCreate: boolean;
  ledgerPost: boolean;
  ledgerReverse: boolean;
};

export function FinancialDocumentsPage({ nature }: { nature: FinancialDocumentNature }) {
  const { unit } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<ModalState>(null);

  const directoryQuery = useQuery({
    queryKey: ["financial-directory"],
    queryFn: listFinancialDirectory,
  });
  const structureQuery = useQuery({
    queryKey: ["transaction-reference-data"],
    queryFn: listTransactionReferenceData,
  });
  const permissionsQuery = useQuery({
    queryKey: ["finance-permissions"],
    queryFn: loadFinancePermissions,
  });

  const directory = directoryQuery.data;
  const structure = structureQuery.data;
  const permissions = permissionsQuery.data;
  const normalizedSearch = search.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!directory || !structure) return [];
    return directory.documents.filter((document) => {
      const unitCode = unitCodeFor(structure, document.business_unit_id);
      const party = partyName(directory, document.party_id);
      return (
        document.document_nature === nature &&
        (unit === "TODAS" || unit === unitCode) &&
        (statusFilter === "all" || document.status === statusFilter) &&
        (!normalizedSearch ||
          `${document.document_number} ${document.description} ${party}`
            .toLowerCase()
            .includes(normalizedSearch))
      );
    });
  }, [directory, nature, normalizedSearch, statusFilter, structure, unit]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["financial-directory"] });
  }

  if (directoryQuery.isLoading || structureQuery.isLoading || permissionsQuery.isLoading) {
    return <LoadingState nature={nature} />;
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
        nature={nature}
        error={directoryQuery.error ?? structureQuery.error ?? permissionsQuery.error}
        retry={() => {
          void directoryQuery.refetch();
          void structureQuery.refetch();
          void permissionsQuery.refetch();
        }}
      />
    );
  }

  const openStatuses = new Set([
    "pending_approval",
    "approved",
    "issued",
    "partially_settled",
    "overdue",
    "in_dispute",
  ]);
  const openRows = rows.filter((item) => openStatuses.has(item.status));
  const overdueRows = openRows.filter((item) => item.due_date < todayIso());
  const totalOpen = openRows.reduce((sum, item) => sum + Number(item.functional_amount), 0);
  const pendingApproval = rows.filter((item) => item.status === "pending_approval").length;
  const title = nature === "payable" ? "Contas a pagar" : "Contas a receber";

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={
          nature === "payable"
            ? "Obrigações da LANDER SOLUTIONS com competência, unidade, contraparte, moeda original e reconhecimento por partidas dobradas."
            : "Direitos da LANDER SOLUTIONS com competência, unidade, cliente, moeda original e reconhecimento por partidas dobradas."
        }
        actions={
          permissions.createDocument ? (
            <Button onClick={() => setModal({ action: "create" })}>
              <Plus /> {nature === "payable" ? "Nova conta" : "Nova cobrança"}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Valor aberto em BRL" value={formatMoney(totalOpen, "BRL")} />
        <Kpi label="Documentos abertos" value={String(openRows.length)} />
        <Kpi
          label="Vencidos"
          value={String(overdueRows.length)}
          tone={overdueRows.length > 0 ? "negative" : "neutral"}
        />
        <Kpi
          label="Aguardando aprovação"
          value={String(pendingApproval)}
          tone={pendingApproval > 0 ? "warning" : "neutral"}
        />
      </div>

      <Panel
        title={nature === "payable" ? "Obrigações financeiras" : "Recebíveis"}
        description="O valor funcional é calculado pelo banco a partir do valor original e da taxa de câmbio registrada."
        actions={
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar número, descrição ou contraparte"
              className="h-9 min-w-72 rounded-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-sm border bg-background px-3 text-sm"
            >
              <option value="all">Todas as situações</option>
              {documentStatusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                <th className="px-4 py-2 text-left font-semibold">Documento</th>
                <th className="px-4 py-2 text-left font-semibold">Contraparte</th>
                <th className="px-4 py-2 text-left font-semibold">Unidade</th>
                <th className="px-4 py-2 text-left font-semibold">Competência</th>
                <th className="px-4 py-2 text-left font-semibold">Vencimento</th>
                <th className="px-4 py-2 text-right font-semibold">Original</th>
                <th className="px-4 py-2 text-right font-semibold">BRL</th>
                <th className="px-4 py-2 text-left font-semibold">Situação</th>
                <th className="px-4 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={9} label="Nenhum documento encontrado." />}
              {rows.map((document) => {
                const editable =
                  permissions.manageDraft &&
                  ["draft", "pending_approval"].includes(document.status) &&
                  !document.journal_entry_id;
                const overdue = openStatuses.has(document.status) && document.due_date < todayIso();
                return (
                  <tr key={document.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{document.description}</p>
                      <p className="num mt-0.5 text-xs text-muted-foreground">
                        {document.document_number}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sourceTypeLabel(document.source_type)}
                      </p>
                    </td>
                    <td className="px-4 py-3">{partyName(directory, document.party_id)}</td>
                    <td className="px-4 py-3">
                      <UnitTag>{unitCodeFor(structure, document.business_unit_id)}</UnitTag>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {scopeName(structure, document)}
                      </p>
                    </td>
                    <td className="num px-4 py-3 text-xs">
                      {formatDate(document.competence_date)}
                    </td>
                    <td
                      className={`num px-4 py-3 text-xs ${overdue ? "font-semibold text-destructive" : ""}`}
                    >
                      {formatDate(document.due_date)}
                    </td>
                    <td className="num px-4 py-3 text-right">
                      {formatMoney(
                        Number(document.original_amount),
                        document.original_currency_code,
                      )}
                      {document.original_currency_code !== document.functional_currency_code && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          câmbio {Number(document.fx_rate).toFixed(6)}
                        </p>
                      )}
                    </td>
                    <td className="num px-4 py-3 text-right font-medium">
                      {formatMoney(
                        Number(document.functional_amount),
                        document.functional_currency_code,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={documentStatusLabel(document.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setModal({ action: "view", record: document })}
                        >
                          <Eye /> Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!editable}
                          onClick={() => setModal({ action: "edit", record: document })}
                        >
                          <Pencil /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!editable}
                          onClick={() => setModal({ action: "destroy", record: document })}
                        >
                          <Trash2 /> Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <FinancialDocumentFormDialog
        state={
          modal?.action === "create"
            ? modal
            : modal?.action === "edit"
              ? { action: "edit", record: modal.record }
              : null
        }
        nature={nature}
        directory={directory}
        structure={structure}
        userId={user?.id ?? null}
        onClose={() => setModal(null)}
        onChanged={refresh}
      />
      <FinancialDocumentDetailsDialog
        document={modal?.action === "view" ? modal.record : null}
        directory={directory}
        structure={structure}
        permissions={permissions}
        userId={user?.id ?? null}
        onClose={() => setModal(null)}
        onChanged={refresh}
      />
      <FinancialDocumentDestroyDialog
        document={modal?.action === "destroy" ? modal.record : null}
        directory={directory}
        onClose={() => setModal(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function FinancialDocumentFormDialog({
  state,
  nature,
  directory,
  structure,
  userId,
  onClose,
  onChanged,
}: {
  state: { action: "create" } | { action: "edit"; record: FinancialDocument } | null;
  nature: FinancialDocumentNature;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  if (!state) return null;
  return (
    <FinancialDocumentForm
      key={
        state.action === "create" ? `${nature}-new` : `${state.record.id}-${state.record.version}`
      }
      record={state.action === "edit" ? state.record : null}
      nature={nature}
      directory={directory}
      structure={structure}
      userId={userId}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function FinancialDocumentForm({
  record,
  nature,
  directory,
  structure,
  userId,
  onClose,
  onChanged,
}: {
  record: FinancialDocument | null;
  nature: FinancialDocumentNature;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const entity = structure.legalEntities[0];
  const initialUnit =
    structure.businessUnits.find((item) => item.code !== "CORPORATIVO") ??
    structure.businessUnits[0];
  const defaultCounterparty = directory.accounts.find(
    (item) => item.code === (nature === "payable" ? "2100" : "1200"),
  );
  const [unitId, setUnitId] = useState(record?.business_unit_id ?? initialUnit?.id ?? "");
  const [productId, setProductId] = useState(record?.product_id ?? "");
  const [serviceLineId, setServiceLineId] = useState(record?.service_line_id ?? "");
  const [projectId, setProjectId] = useState(record?.project_id ?? "");
  const [contractId, setContractId] = useState(record?.contract_id ?? "");
  const [partyId, setPartyId] = useState(record?.party_id ?? directory.parties[0]?.id ?? "");
  const [centerId, setCenterId] = useState(
    record?.cost_center_id ?? record?.revenue_center_id ?? "",
  );
  const [categoryId, setCategoryId] = useState(record?.category_id ?? "");
  const [sourceType, setSourceType] = useState(
    record?.source_type ?? (nature === "payable" ? "bill" : "invoice"),
  );
  const [number, setNumber] = useState(record?.document_number ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [issueDate, setIssueDate] = useState(record?.issue_date ?? todayIso());
  const [competenceDate, setCompetenceDate] = useState(record?.competence_date ?? todayIso());
  const [dueDate, setDueDate] = useState(record?.due_date ?? todayIso());
  const [currency, setCurrency] = useState(record?.original_currency_code ?? "BRL");
  const [amount, setAmount] = useState(record?.original_amount?.toString() ?? "");
  const [fxRate, setFxRate] = useState(record?.fx_rate?.toString() ?? "1");
  const [fxDate, setFxDate] = useState(record?.fx_date ?? todayIso());
  const [fxSource, setFxSource] = useState(record?.fx_source ?? "functional_currency");
  const [taxAmount, setTaxAmount] = useState(record?.tax_amount_functional?.toString() ?? "0");
  const [feeAmount, setFeeAmount] = useState(record?.fee_amount_functional?.toString() ?? "0");
  const [classificationStatus, setClassificationStatus] = useState(
    record?.classification_status ?? "classified",
  );
  const [counterpartyAccountId, setCounterpartyAccountId] = useState(
    record?.counterparty_account_id ?? defaultCounterparty?.id ?? "",
  );
  const [externalReference, setExternalReference] = useState(record?.external_reference ?? "");
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const products = structure.products.filter((item) => item.business_unit_id === unitId);
  const services = structure.serviceLines.filter((item) => item.business_unit_id === unitId);
  const projects = structure.projects.filter((item) => item.business_unit_id === unitId);
  const contracts = directory.contracts.filter(
    (item) =>
      item.business_unit_id === unitId && !["cancelled", "terminated"].includes(item.status),
  );
  const centers =
    nature === "payable"
      ? structure.costCenters.filter((item) => item.business_unit_id === unitId)
      : structure.revenueCenters.filter((item) => item.business_unit_id === unitId);
  const accounts = directory.accounts.filter(
    (item) =>
      item.posting_allowed &&
      item.status === "active" &&
      item.account_type === (nature === "payable" ? "liability" : "asset"),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (!entity) throw new Error("Pessoa jurídica não encontrada.");
      if (!partyId) throw new Error("Selecione a contraparte.");
      if (!counterpartyAccountId) throw new Error("Conta de contrapartida não encontrada.");
      if (productId && serviceLineId) throw new Error("Selecione produto ou serviço, nunca ambos.");
      if (currency === "BRL" && Number(fxRate) !== 1)
        throw new Error("Documentos em BRL devem usar taxa de câmbio 1.");
      const pendingClassification = classificationStatus === "pending_classification";
      const values = {
        legal_entity_id: record?.legal_entity_id ?? entity.id,
        business_unit_id: unitId,
        product_id: productId || null,
        service_line_id: serviceLineId || null,
        project_id: projectId || null,
        contract_id: contractId || null,
        party_id: partyId,
        cost_center_id: nature === "payable" ? centerId || null : null,
        revenue_center_id: nature === "receivable" ? centerId || null : null,
        category_id: categoryId || null,
        document_nature: nature,
        source_type: sourceType,
        document_number: number.trim(),
        description: description.trim(),
        issue_date: issueDate,
        competence_date: competenceDate,
        due_date: dueDate,
        original_currency_code: currency,
        original_amount: Number(amount),
        fx_rate: Number(fxRate),
        fx_date: fxDate,
        fx_source: fxSource.trim(),
        functional_currency_code: "BRL",
        tax_amount_functional: Number(taxAmount),
        fee_amount_functional: Number(feeAmount),
        classification_status: classificationStatus,
        classification_due_at: pendingClassification
          ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
          : null,
        classification_responsible_user_id: pendingClassification ? userId : null,
        counterparty_account_id: counterpartyAccountId,
        status: record?.status ?? "draft",
        external_reference: externalReference.trim() || null,
        notes: notes.trim() || null,
        created_by: record?.created_by ?? userId,
      };
      if (record) {
        await updateFinanceRecord<FinancialDocument>(
          "financial_documents",
          record.id,
          record.version,
          values,
        );
      } else {
        await createFinanceRecord<FinancialDocument>("financial_documents", values);
      }
      await onChanged();
      toast.success(record ? "Documento atualizado." : "Documento criado em rascunho.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto">
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {record ? "Editar" : "Criar"}{" "}
              {nature === "payable" ? "conta a pagar" : "conta a receber"}
            </DialogTitle>
            <DialogDescription>
              Valores são preservados na moeda original e convertidos para BRL com taxa, data e
              fonte registradas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Número do documento" value={number} onChange={setNumber} required />
            <TextField label="Descrição" value={description} onChange={setDescription} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Unidade"
              value={unitId}
              onChange={(value) => {
                setUnitId(value);
                setProductId("");
                setServiceLineId("");
                setProjectId("");
                setContractId("");
                setCenterId("");
              }}
              options={structure.businessUnits.map((item) => [
                item.id,
                `${item.code} — ${item.name}`,
              ])}
            />
            <SelectField
              label="Contraparte"
              value={partyId}
              onChange={setPartyId}
              options={directory.parties.map((item) => [
                item.id,
                item.trade_name || item.legal_name,
              ])}
            />
            <SelectField
              label="Origem"
              value={sourceType}
              onChange={setSourceType}
              options={sourceTypeOptions}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Produto"
              value={productId}
              onChange={(value) => {
                setProductId(value);
                if (value) setServiceLineId("");
              }}
              options={[
                ["", "Sem produto"],
                ...products.map((item) => [item.id, item.name] as const),
              ]}
            />
            <SelectField
              label="Serviço"
              value={serviceLineId}
              onChange={(value) => {
                setServiceLineId(value);
                if (value) setProductId("");
              }}
              options={[
                ["", "Sem serviço"],
                ...services.map((item) => [item.id, item.name] as const),
              ]}
            />
            <SelectField
              label="Projeto"
              value={projectId}
              onChange={setProjectId}
              options={[
                ["", "Sem projeto"],
                ...projects.map((item) => [item.id, item.name] as const),
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Contrato"
              value={contractId}
              onChange={setContractId}
              options={[
                ["", "Sem contrato"],
                ...contracts.map((item) => [item.id, `${item.code} — ${item.title}`] as const),
              ]}
            />
            <SelectField
              label={nature === "payable" ? "Centro de custo" : "Centro de receita"}
              value={centerId}
              onChange={setCenterId}
              options={[
                ["", "Sem centro"],
                ...centers.map((item) => [item.id, `${item.code} — ${item.name}`] as const),
              ]}
            />
            <SelectField
              label="Categoria"
              value={categoryId}
              onChange={setCategoryId}
              options={[
                ["", "Sem categoria"],
                ...structure.categories.map(
                  (item) => [item.id, `${item.code} — ${item.name}`] as const,
                ),
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Emissão"
              type="date"
              value={issueDate}
              onChange={setIssueDate}
              required
            />
            <TextField
              label="Competência"
              type="date"
              value={competenceDate}
              onChange={setCompetenceDate}
              required
            />
            <TextField
              label="Vencimento"
              type="date"
              value={dueDate}
              onChange={setDueDate}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <SelectField
              label="Moeda original"
              value={currency}
              onChange={(value) => {
                setCurrency(value);
                if (value === "BRL") {
                  setFxRate("1");
                  setFxSource("functional_currency");
                }
              }}
              options={structure.currencies.map((item) => [
                item.code,
                `${item.code} — ${item.name}`,
              ])}
            />
            <TextField
              label="Valor original"
              type="number"
              min="0.000001"
              step="0.000001"
              value={amount}
              onChange={setAmount}
              required
            />
            <TextField
              label="Taxa para BRL"
              type="number"
              min="0.0000000001"
              step="0.0000000001"
              value={fxRate}
              onChange={setFxRate}
              required
            />
            <TextField
              label="Data do câmbio"
              type="date"
              value={fxDate}
              onChange={setFxDate}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Fonte do câmbio" value={fxSource} onChange={setFxSource} required />
            <TextField
              label="Impostos em BRL"
              type="number"
              min="0"
              step="0.01"
              value={taxAmount}
              onChange={setTaxAmount}
              required
            />
            <TextField
              label="Taxas em BRL"
              type="number"
              min="0"
              step="0.01"
              value={feeAmount}
              onChange={setFeeAmount}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Classificação"
              value={classificationStatus}
              onChange={(value) =>
                setClassificationStatus(value as "classified" | "pending_classification")
              }
              options={classificationOptions}
            />
            <SelectField
              label="Conta de contrapartida"
              value={counterpartyAccountId}
              onChange={setCounterpartyAccountId}
              options={accounts.map((item) => [item.id, `${item.code} — ${item.name}`])}
            />
          </div>
          <TextField
            label="Referência externa"
            value={externalReference}
            onChange={setExternalReference}
          />
          <TextAreaField label="Observações" value={notes} onChange={setNotes} />

          <div className="rounded-sm border bg-muted/20 p-3 text-sm">
            <span className="label-caps">Valor funcional estimado</span>
            <p className="num mt-1 text-base font-semibold">
              {formatMoney((Number(amount) || 0) * (Number(fxRate) || 0), "BRL")}
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FinancialDocumentDestroyDialog({
  document,
  directory,
  onClose,
  onChanged,
}: {
  document: FinancialDocument | null;
  directory: FinancialDirectory;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!document) return null;
  const currentDocument = document;
  const lines = directory.documentLines.filter(
    (item) => item.financial_document_id === document.id,
  ).length;
  const allowed = document.status === "draft" && !document.journal_entry_id && lines === 0;

  async function destroy() {
    setSubmitting(true);
    try {
      if (!allowed)
        throw new Error(
          "Remova as linhas do rascunho ou preserve o documento por cancelamento/estorno.",
        );
      await deleteFinanceRecord("financial_documents", currentDocument.id);
      await onChanged();
      toast.success("Rascunho excluído definitivamente.");
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
          <DialogTitle>Excluir documento</DialogTitle>
          <DialogDescription>
            Somente rascunhos sem linhas e sem lançamento podem ser removidos fisicamente.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">{document.description}</p>
          <p className="num mt-1 text-xs text-muted-foreground">{document.document_number}</p>
          <p className="mt-2 text-xs text-muted-foreground">Linhas vinculadas: {lines}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="financial-document-delete">
            Digite {document.document_number} para confirmar
          </Label>
          <Input
            id="financial-document-delete"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!allowed || submitting || confirmation !== document.document_number}
            onClick={() => void destroy()}
          >
            {submitting && <LoaderCircle className="animate-spin" />} Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function loadFinancePermissions(): Promise<FinancePermissionSet> {
  const [
    read,
    createDocument,
    manageDraft,
    approveDocument,
    createSettlement,
    postSettlement,
    cashManage,
    ledgerRead,
    ledgerCreate,
    ledgerPost,
    ledgerReverse,
  ] = await Promise.all([
    hasPermission("finance.read"),
    hasPermission("finance.documents.create"),
    hasPermission("finance.documents.manage_draft"),
    hasPermission("finance.documents.approve"),
    hasPermission("finance.settlements.create"),
    hasPermission("finance.settlements.post"),
    hasPermission("finance.cash.manage"),
    hasPermission("ledger.read"),
    hasPermission("ledger.create"),
    hasPermission("ledger.post"),
    hasPermission("ledger.reverse"),
  ]);
  return {
    read,
    createDocument,
    manageDraft,
    approveDocument,
    createSettlement,
    postSettlement,
    cashManage,
    ledgerRead,
    ledgerCreate,
    ledgerPost,
    ledgerReverse,
  };
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

function LoadingState({ nature }: { nature: FinancialDocumentNature }) {
  return (
    <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="animate-spin" /> Carregando{" "}
      {nature === "payable" ? "contas a pagar" : "contas a receber"}…
    </div>
  );
}

function ErrorState({
  nature,
  error,
  retry,
}: {
  nature: FinancialDocumentNature;
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={nature === "payable" ? "Contas a pagar" : "Contas a receber"}
        description="A consulta protegida falhou."
      />
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

const documentStatusOptions: Array<readonly [FinancialDocumentStatus, string]> = [
  ["draft", "Rascunho"],
  ["pending_approval", "Aguardando aprovação"],
  ["approved", "Aprovado"],
  ["issued", "Emitido"],
  ["partially_settled", "Parcialmente liquidado"],
  ["settled", "Liquidado"],
  ["overdue", "Vencido"],
  ["in_dispute", "Em disputa"],
  ["cancelled", "Cancelado"],
  ["reversed", "Estornado"],
];
const sourceTypeOptions: Array<readonly [string, string]> = [
  ["bill", "Conta ou cobrança"],
  ["invoice", "Invoice"],
  ["fiscal_document", "Documento fiscal"],
  ["refund", "Reembolso"],
  ["chargeback", "Chargeback"],
  ["investment", "Investimento"],
  ["reimbursement", "Ressarcimento"],
  ["other", "Outro"],
];
const classificationOptions: Array<readonly [string, string]> = [
  ["classified", "Classificado"],
  ["pending_classification", "Classificação pendente"],
];

export function unitCodeFor(structure: TransactionReferenceData, unitId: string): string {
  return structure.businessUnits.find((item) => item.id === unitId)?.code ?? "UNIDADE_REMOVIDA";
}

export function partyName(directory: FinancialDirectory, partyId: string): string {
  const party = directory.parties.find((item) => item.id === partyId);
  return party?.trade_name || party?.legal_name || "Cadastro indisponível";
}

export function accountName(directory: FinancialDirectory, accountId: string): string {
  const account = directory.accounts.find((item) => item.id === accountId);
  return account ? `${account.code} — ${account.name}` : "Conta indisponível";
}

export function scopeName(
  structure: TransactionReferenceData,
  document: FinancialDocument,
): string {
  if (document.product_id)
    return (
      structure.products.find((item) => item.id === document.product_id)?.name ?? "Produto removido"
    );
  if (document.service_line_id)
    return (
      structure.serviceLines.find((item) => item.id === document.service_line_id)?.name ??
      "Serviço removido"
    );
  if (document.project_id)
    return (
      structure.projects.find((item) => item.id === document.project_id)?.name ?? "Projeto removido"
    );
  return "Escopo geral da unidade";
}

export function documentStatusLabel(value: string): string {
  return documentStatusOptions.find(([key]) => key === value)?.[1].toLowerCase() ?? value;
}

export function sourceTypeLabel(value: string): string {
  return sourceTypeOptions.find(([key]) => key === value)?.[1] ?? value;
}

export function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error)
    return String((error as { message: unknown }).message);
  return "A operação não pôde ser concluída.";
}

export { loadFinancePermissions };
