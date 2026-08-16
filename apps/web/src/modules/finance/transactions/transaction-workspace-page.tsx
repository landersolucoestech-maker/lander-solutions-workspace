import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Edit3,
  Eye,
  Landmark,
  Link2,
  LoaderCircle,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/button";
import { SortableTableHeader } from "@/shared/components/sortable-table-header";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { EmptyRow, PageHeader, StatusPill, UnitTag } from "@/shared/components/ui-kit";
import { useWorkspace } from "@/app/providers/workspace-context";
import type { BusinessUnit } from "@/modules/company/organizational-structure/business-units";
import type { FinancialCategory } from "@/modules/finance/accounting";
import {
  listBankOperations,
  updateBankStatementLine as updateStatementLine,
} from "./bank-operations-api";
import type { BankOperationsDirectory, BankStatementLine } from "./bank-operations-types";
import {
  approveFinancialDocument,
  listFinancialDirectory,
  submitFinancialDocument,
  updateFinanceRecord,
} from "./api";
import { OfxImportDialog } from "./ofx-import-dialog";
import { BankConnectionDialog } from "./bank-connection-dialog";
import { TransactionEditorDialog } from "./transaction-editor-dialog";
import { settlementSummary, transactionKind } from "./transaction-view-model";
import type {
  CashAccount,
  FinancialDirectory,
  FinancialDocument,
  FinancialDocumentNature,
} from "./types";
import { listTransactionReferenceData, type TransactionReferenceData } from "./reference-data";

type TransactionTab = "pending" | "posted" | "deleted";
type TransactionNature = "all" | "receivable" | "payable" | "transfer";
type SortKey =
  "date" | "description" | "expense" | "revenue" | "unit" | "account" | "category" | "status";

type EditorState = {
  nature: FinancialDocumentNature;
  document: FinancialDocument | null;
} | null;

type TextAction = {
  title: string;
  description: string;
  label: string;
  destructive?: boolean;
  minimumLength?: number;
  action: (value: string) => Promise<void>;
} | null;

interface TransactionRow {
  id: string;
  sourceKind: "document" | "bank";
  tab: TransactionTab;
  date: string;
  description: string;
  documentNumber: string;
  expense: number;
  revenue: number;
  amount: number;
  attachmentReference: string | null;
  notes: string | null;
  originDestination: string;
  businessUnitId: string;
  unitCode: string;
  unitName: string;
  cashAccountId: string | null;
  accountName: string;
  categoryId: string | null;
  categoryName: string;
  partyId: string | null;
  contactName: string;
  statusKey: string;
  statusLabel: string;
  reconciled: boolean;
  updatedAt: string;
  canEdit: boolean;
  canConfirm: boolean;
  canDelete: boolean;
  canRestore: boolean;
  document: FinancialDocument | null;
  bankLine: BankStatementLine | null;
}

export function TransactionWorkspacePage() {
  const { user } = useAuth();
  const { unit, period } = useWorkspace();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(() => ({
    period,
    from: `${period}-01`,
    to: lastDayOfPeriod(period),
  }));
  const dateFrom = dateRange.period === period ? dateRange.from : `${period}-01`;
  const dateTo = dateRange.period === period ? dateRange.to : lastDayOfPeriod(period);
  const setDateFrom = (value: string) =>
    setDateRange((current) => ({
      period,
      from: value,
      to: current.period === period ? current.to : lastDayOfPeriod(period),
    }));
  const setDateTo = (value: string) =>
    setDateRange((current) => ({
      period,
      from: current.period === period ? current.from : `${period}-01`,
      to: value,
    }));
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [nature, setNature] = useState<TransactionNature>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryUpdatingId, setCategoryUpdatingId] = useState<string | null>(null);
  const [ofxOpen, setOfxOpen] = useState(false);
  const [bankConnectionOpen, setBankConnectionOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [details, setDetails] = useState<TransactionRow | null>(null);
  const [bankEditor, setBankEditor] = useState<TransactionRow | null>(null);
  const [reconciliation, setReconciliation] = useState<TransactionRow | null>(null);
  const [textAction, setTextAction] = useState<TextAction>(null);

  const refresh = useCallback(async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["financial-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["financial-operations"] }),
        queryClient.invalidateQueries({ queryKey: ["transaction-reference-data"] }),
        queryClient.invalidateQueries({ queryKey: ["financial-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["managerial-report-snapshot"] }),
      ]);
      toast.success("Transações atualizadas.");
    } catch (refreshError) {
      toast.error(
        refreshError instanceof Error ? refreshError.message : "Falha ao atualizar os dados.",
      );
    }
  }, [queryClient]);

  useEffect(() => {
    const importOfx = () => setOfxOpen(true);
    const connectAccount = () => setBankConnectionOpen(true);
    const refreshTransactions = () => void refresh();
    const newTransaction = () => setEditor({ nature: "receivable", document: null });

    window.addEventListener("transactions:import-ofx", importOfx);
    window.addEventListener("transactions:connect-account", connectAccount);
    window.addEventListener("transactions:refresh", refreshTransactions);
    window.addEventListener("transactions:new", newTransaction);
    return () => {
      window.removeEventListener("transactions:import-ofx", importOfx);
      window.removeEventListener("transactions:connect-account", connectAccount);
      window.removeEventListener("transactions:refresh", refreshTransactions);
      window.removeEventListener("transactions:new", newTransaction);
    };
  }, [refresh]);

  const financialQuery = useQuery({
    queryKey: ["financial-directory"],
    queryFn: listFinancialDirectory,
  });
  const structureQuery = useQuery({
    queryKey: ["transaction-reference-data"],
    queryFn: listTransactionReferenceData,
  });
  const operationsQuery = useQuery({
    queryKey: ["financial-operations"],
    queryFn: listBankOperations,
  });

  const financial = financialQuery.data;
  const structure = structureQuery.data;
  const operations = operationsQuery.data;

  const unitById = useMemo(
    () => new Map((structure?.businessUnits ?? []).map((item) => [item.id, item])),
    [structure?.businessUnits],
  );
  const categoryById = useMemo(
    () => new Map((structure?.categories ?? []).map((item) => [item.id, item])),
    [structure?.categories],
  );
  const partyById = useMemo(
    () =>
      new Map(
        (financial?.parties ?? []).map((item) => [
          item.id,
          item.trade_name?.trim() || item.legal_name,
        ]),
      ),
    [financial?.parties],
  );
  const accountById = useMemo(
    () => new Map((financial?.cashAccounts ?? []).map((item) => [item.id, item])),
    [financial?.cashAccounts],
  );
  const importById = useMemo(
    () => new Map((operations?.statementImports ?? []).map((item) => [item.id, item])),
    [operations?.statementImports],
  );
  const latestSettlementByDocument = useMemo(() => {
    const values = new Map<string, FinancialDirectory["settlements"][number]>();
    for (const settlement of financial?.settlements ?? []) {
      const current = values.get(settlement.financial_document_id);
      if (!current || current.settlement_date < settlement.settlement_date) {
        values.set(settlement.financial_document_id, settlement);
      }
    }
    return values;
  }, [financial?.settlements]);
  const matchedSettlementIds = useMemo(
    () =>
      new Set(
        (operations?.statementLines ?? [])
          .map((item) => item.matched_settlement_id)
          .filter((value): value is string => Boolean(value)),
      ),
    [operations?.statementLines],
  );

  const rows = useMemo<TransactionRow[]>(() => {
    if (!financial || !structure || !operations) return [];

    const documentRows = financial.documents.flatMap((document): TransactionRow[] => {
      const businessUnit = transactionUnitForRow(
        unitById.get(document.business_unit_id),
        document.business_unit_id,
      );
      const settlement = latestSettlementByDocument.get(document.id) ?? null;
      const account = settlement ? (accountById.get(settlement.cash_account_id) ?? null) : null;
      const category = document.category_id
        ? (categoryById.get(document.category_id) ?? null)
        : null;
      const contactName = partyById.get(document.party_id) ?? "—";
      const deleted =
        Boolean(document.deleted_at) || ["cancelled", "reversed"].includes(document.status);
      const posted = Boolean(document.journal_entry_id) || document.status === "settled";
      const tab: TransactionTab = deleted ? "deleted" : posted ? "posted" : "pending";
      const value = Number(document.functional_amount || document.original_amount || 0);
      const isReceivable = document.document_nature === "receivable";
      return [
        {
          id: `document:${document.id}`,
          sourceKind: "document",
          tab,
          date: document.competence_date || document.issue_date,
          description: document.description,
          documentNumber: document.document_number,
          expense: isReceivable ? 0 : value,
          revenue: isReceivable ? value : 0,
          amount: value,
          attachmentReference: document.attachment_reference,
          notes: document.notes,
          originDestination: contactName,
          businessUnitId: businessUnit.id,
          unitCode: businessUnit.code,
          unitName: businessUnit.name,
          cashAccountId: account?.id ?? null,
          accountName: account ? accountLabel(account) : "—",
          categoryId: document.category_id,
          categoryName: category?.name ?? "Não categorizada",
          partyId: document.party_id,
          contactName,
          statusKey: document.status,
          statusLabel: documentStatusLabel(document.status, document.deleted_at),
          reconciled: Boolean(settlement?.id && matchedSettlementIds.has(settlement.id)),
          updatedAt: document.updated_at,
          canEdit: !deleted && document.status === "draft" && !document.journal_entry_id,
          canConfirm:
            !deleted &&
            ["draft", "pending_approval"].includes(document.status) &&
            !document.journal_entry_id,
          canDelete: !deleted && document.status === "draft" && !document.journal_entry_id,
          canRestore:
            Boolean(document.deleted_at) &&
            document.status === "draft" &&
            !document.journal_entry_id,
          document,
          bankLine: null,
        },
      ];
    });

    const bankRows = operations.statementLines.flatMap((line): TransactionRow[] => {
      const statementImport = importById.get(line.statement_import_id);
      const account = statementImport
        ? (accountById.get(statementImport.cash_account_id) ?? null)
        : null;
      const businessUnit = unitById.get(line.business_unit_id);
      if (!statementImport || !account) return [];
      const transactionUnit = transactionUnitForRow(businessUnit, line.business_unit_id);
      const category = line.category_id ? (categoryById.get(line.category_id) ?? null) : null;
      const contactName = line.party_id
        ? (partyById.get(line.party_id) ?? line.counterparty_name ?? "—")
        : (line.counterparty_name ?? "—");
      const deleted = Boolean(line.deleted_at) || line.match_status === "ignored";
      const posted = Boolean(line.confirmed_at) || line.match_status === "matched";
      const tab: TransactionTab = deleted ? "deleted" : posted ? "posted" : "pending";
      const value = Number(line.amount || 0);
      const isCredit = line.transaction_type === "credit";
      return [
        {
          id: `bank:${line.id}`,
          sourceKind: "bank",
          tab,
          date: line.transaction_date,
          description:
            line.memo?.trim() || line.counterparty_name?.trim() || "Movimentação bancária",
          documentNumber: line.bank_reference || `OFX-${line.sequence_no}`,
          expense: isCredit ? 0 : value,
          revenue: isCredit ? value : 0,
          amount: value,
          attachmentReference: line.attachment_reference,
          notes: line.notes,
          originDestination: line.counterparty_name ?? "—",
          businessUnitId: transactionUnit.id,
          unitCode: transactionUnit.code,
          unitName: transactionUnit.name,
          cashAccountId: account.id,
          accountName: accountLabel(account),
          categoryId: line.category_id,
          categoryName: category?.name ?? "Não categorizada",
          partyId: line.party_id,
          contactName,
          statusKey: line.deleted_at
            ? "deleted"
            : line.match_status === "matched"
              ? "reconciled"
              : line.confirmed_at
                ? "posted"
                : "pending",
          statusLabel: line.deleted_at
            ? "Excluída"
            : line.match_status === "matched"
              ? "Conciliada"
              : line.confirmed_at
                ? "Lançada"
                : "Pendente",
          reconciled: line.match_status === "matched",
          updatedAt: line.updated_at,
          canEdit: !deleted && line.match_status === "unmatched",
          canConfirm: !deleted && !line.confirmed_at && line.match_status === "unmatched",
          canDelete: !deleted && !line.confirmed_at && line.match_status === "unmatched",
          canRestore: Boolean(line.deleted_at) && line.match_status === "unmatched",
          document: null,
          bankLine: line,
        },
      ];
    });

    return [...documentRows, ...bankRows];
  }, [
    accountById,
    categoryById,
    financial,
    importById,
    latestSettlementByDocument,
    matchedSettlementIds,
    operations,
    partyById,
    structure,
    unitById,
  ]);

  const selectedAccount = selectedAccountId === "all" ? null : accountById.get(selectedAccountId);
  const effectiveAccountId =
    selectedAccountId !== "all" &&
    selectedAccount &&
    (unit === "TODAS" || selectedAccount.business_unit_id === unitByCode(structure, unit)?.id)
      ? selectedAccountId
      : "all";

  const nonScopeFilteredRows = useMemo(
    () =>
      rows.filter((row) =>
        matchesFilters(row, {
          search,
          dateFrom,
          dateTo,
          nature,
          categoryId,
          status,
        }),
      ),
    [categoryId, dateFrom, dateTo, nature, rows, search, status],
  );

  const scopeFilteredRows = useMemo(
    () =>
      nonScopeFilteredRows.filter(
        (row) =>
          (unit === "TODAS" || row.unitCode === unit) &&
          (effectiveAccountId === "all" || row.cashAccountId === effectiveAccountId),
      ),
    [effectiveAccountId, nonScopeFilteredRows, unit],
  );

  const displayedRows = useMemo(
    () => [...scopeFilteredRows].sort((a, b) => compareRows(a, b, sortKey, sortDirection)),
    [scopeFilteredRows, sortDirection, sortKey],
  );

  const visibleAccounts = useMemo(
    () =>
      (financial?.cashAccounts ?? [])
        .filter(
          (account) =>
            account.status === "active" &&
            (unit === "TODAS" || account.business_unit_id === unitByCode(structure, unit)?.id),
        )
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    [financial?.cashAccounts, structure, unit],
  );

  const accountScopedRows = useMemo(
    () => nonScopeFilteredRows.filter((row) => unit === "TODAS" || row.unitCode === unit),
    [nonScopeFilteredRows, unit],
  );

  const statusOptions = useMemo(
    () => uniqueOptions(rows.map((row) => [row.statusKey, row.statusLabel])),
    [rows],
  );

  if (financialQuery.isLoading || structureQuery.isLoading || operationsQuery.isLoading) {
    return <LoadingState />;
  }

  const error = financialQuery.error ?? structureQuery.error ?? operationsQuery.error;
  if (error || !financial || !structure || !operations) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <PageHeader title="Transações" />
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Não foi possível carregar as transações."}
        </div>
      </div>
    );
  }

  function clearFilters() {
    setSearch("");
    setDateFrom(`${period}-01`);
    setDateTo(lastDayOfPeriod(period));
    setSelectedAccountId("all");
    setNature("all");
    setCategoryId("all");
    setStatus("all");
    setSelectedIds(new Set());
  }

  async function showAllAccounts() {
    setSelectedAccountId("all");
    setSelectedIds(new Set());
    await refresh();
  }

  function toggleSort(next: SortKey) {
    if (sortKey === next) setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSortKey(next);
      setSortDirection("asc");
    }
  }

  async function updateCategory(row: TransactionRow, nextCategoryId: string) {
    setCategoryUpdatingId(row.id);
    try {
      if (row.document) {
        await updateFinanceRecord<FinancialDocument>(
          "financial_documents",
          row.document.id,
          row.document.version,
          { category_id: nextCategoryId || null },
        );
      } else if (row.bankLine) {
        await updateStatementLine(row.bankLine.id, row.bankLine.version, {
          category_id: nextCategoryId || null,
        });
      }
      await refreshSilently(queryClient);
      toast.success("Categoria atualizada.");
    } catch (categoryError) {
      toast.error(categoryError instanceof Error ? categoryError.message : "Falha ao categorizar.");
    } finally {
      setCategoryUpdatingId(null);
    }
  }

  async function confirmPosting(row: TransactionRow) {
    try {
      if (row.bankLine) {
        if (!user) throw new Error("Sessão inválida.");
        await updateStatementLine(row.bankLine.id, row.bankLine.version, {
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id,
        });
      } else if (row.document?.status === "draft") {
        await submitFinancialDocument({
          documentId: row.document.id,
          expectedVersion: row.document.version,
        });
      } else if (row.document?.status === "pending_approval") {
        await approveFinancialDocument({
          documentId: row.document.id,
          expectedVersion: row.document.version,
        });
      } else {
        throw new Error("A transação não está em uma situação confirmável.");
      }
      await refreshSilently(queryClient);
      toast.success("Lançamento confirmado.");
    } catch (confirmError) {
      toast.error(
        confirmError instanceof Error ? confirmError.message : "Falha ao confirmar o lançamento.",
      );
    }
  }

  function requestDelete(row: TransactionRow) {
    setTextAction({
      title: "Excluir transação",
      description:
        "Informe o motivo. O registro será preservado para auditoria e poderá ser restaurado.",
      label: "Motivo da exclusão",
      destructive: true,
      minimumLength: 3,
      action: async (reason) => {
        if (!user) throw new Error("Sessão inválida.");
        const values = {
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          deleted_reason: reason.trim(),
        };
        if (row.document) {
          await updateFinanceRecord<FinancialDocument>(
            "financial_documents",
            row.document.id,
            row.document.version,
            values,
          );
        } else if (row.bankLine) {
          await updateStatementLine(row.bankLine.id, row.bankLine.version, values);
        }
        await refreshSilently(queryClient);
        toast.success("Transação movida para Excluídas.");
      },
    });
  }

  async function restoreRow(row: TransactionRow) {
    try {
      const values = { deleted_at: null, deleted_by: null, deleted_reason: null };
      if (row.document) {
        await updateFinanceRecord<FinancialDocument>(
          "financial_documents",
          row.document.id,
          row.document.version,
          values,
        );
      } else if (row.bankLine) {
        await updateStatementLine(row.bankLine.id, row.bankLine.version, values);
      }
      await refreshSilently(queryClient);
      toast.success("Transação restaurada.");
    } catch (restoreError) {
      toast.error(restoreError instanceof Error ? restoreError.message : "Falha ao restaurar.");
    }
  }

  const allDisplayedSelected =
    displayedRows.length > 0 && displayedRows.every((row) => selectedIds.has(row.id));

  return (
    <div className="min-w-0 space-y-6">
      <section className="min-w-0 space-y-3">
        <div className="flex justify-start sm:justify-end">
          <Button
            type="button"
            variant={effectiveAccountId === "all" ? "default" : "outline"}
            aria-pressed={effectiveAccountId === "all"}
            onClick={() => void showAllAccounts()}
          >
            <Landmark className="h-4 w-4" /> Ver todas as contas
          </Button>
        </div>

        {visibleAccounts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            Nenhuma conta financeira vinculada ao escopo atual.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {visibleAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                unit={transactionUnitForDisplay(unitById.get(account.business_unit_id))}
                active={effectiveAccountId === account.id}
                transactionCount={
                  accountScopedRows.filter((row) => row.cashAccountId === account.id).length
                }
                onClick={() => {
                  setSelectedAccountId(account.id);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-[minmax(135px,0.8fr)_minmax(135px,0.8fr)_minmax(230px,1.6fr)_minmax(170px,1.15fr)_minmax(125px,0.8fr)_minmax(155px,1fr)_minmax(135px,0.85fr)_auto]">
            <FilterField label="Período inicial">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-9"
              />
            </FilterField>
            <FilterField label="Período final">
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-9"
              />
            </FilterField>
            <FilterField label="Pesquisar" className="sm:col-span-2 lg:col-span-2 xl:col-span-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Descrição, documento, contato, categoria ou valor"
                className="h-9"
              />
            </FilterField>
            <FilterField label="Conta">
              <select
                value={effectiveAccountId}
                onChange={(event) => {
                  const accountId = event.target.value;
                  setSelectedAccountId(accountId);
                }}
                className={selectClass}
              >
                <option value="all">Todas as contas</option>
                {visibleAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Tipo">
              <select
                value={nature}
                onChange={(event) => setNature(event.target.value as TransactionNature)}
                className={selectClass}
              >
                <option value="all">Todos</option>
                <option value="receivable">Receita</option>
                <option value="payable">Despesa</option>
                <option value="transfer">Transferência</option>
              </select>
            </FilterField>
            <FilterField label="Categoria">
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className={selectClass}
              >
                <option value="all">Todas</option>
                <option value="uncategorized">Não categorizadas</option>
                {structure.categories
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </FilterField>
            <FilterField label="Status">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={selectClass}
              >
                <option value="all">Todos</option>
                {statusOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FilterField>
            <div className="flex items-end">
              <Button variant="outline" className="h-9 w-full" onClick={clearFilters}>
                <X className="h-4 w-4" /> Limpar
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                <th className="w-12 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas as transações visíveis"
                    checked={allDisplayedSelected}
                    onChange={(event) => {
                      if (event.target.checked)
                        setSelectedIds(new Set(displayedRows.map((row) => row.id)));
                      else setSelectedIds(new Set());
                    }}
                  />
                </th>
                <SortableTableHeader
                  label="Data"
                  active={sortKey === "date"}
                  direction={sortDirection}
                  onSort={() => toggleSort("date")}
                />
                <SortableTableHeader
                  label="Descrição"
                  active={sortKey === "description"}
                  direction={sortDirection}
                  onSort={() => toggleSort("description")}
                />
                <SortableTableHeader
                  label="Despesa"
                  active={sortKey === "expense"}
                  direction={sortDirection}
                  align="right"
                  onSort={() => toggleSort("expense")}
                />
                <SortableTableHeader
                  label="Receita"
                  active={sortKey === "revenue"}
                  direction={sortDirection}
                  align="right"
                  onSort={() => toggleSort("revenue")}
                />
                <SortableTableHeader
                  label="Unidade de negócio"
                  active={sortKey === "unit"}
                  direction={sortDirection}
                  onSort={() => toggleSort("unit")}
                />
                <SortableTableHeader
                  label="Conta financeira"
                  active={sortKey === "account"}
                  direction={sortDirection}
                  onSort={() => toggleSort("account")}
                />
                <SortableTableHeader
                  label="Categoria"
                  active={sortKey === "category"}
                  direction={sortDirection}
                  onSort={() => toggleSort("category")}
                />
                <SortableTableHeader
                  label="Status"
                  active={sortKey === "status"}
                  direction={sortDirection}
                  onSort={() => toggleSort("status")}
                />
                <th className="w-14 px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length === 0 && (
                <EmptyRow colSpan={10} label="Nenhuma transação encontrada." />
              )}
              {displayedRows.map((row) => (
                <tr key={row.id} className="border-t align-top hover:bg-muted/20">
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${row.description}`}
                      checked={selectedIds.has(row.id)}
                      onChange={(event) => {
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(row.id);
                          else next.delete(row.id);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{localDate(row.date)}</td>
                  <td className="max-w-80 px-3 py-3">
                    <p className="font-medium">{row.description}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {row.documentNumber}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs">
                    {row.expense > 0 ? money(row.expense) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs">
                    {row.revenue > 0 ? money(row.revenue) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <UnitTag>{row.unitCode}</UnitTag>
                    <p className="mt-1 text-xs text-muted-foreground">{row.unitName}</p>
                  </td>
                  <td className="max-w-56 px-3 py-3">{row.accountName}</td>
                  <td className="min-w-56 px-3 py-2">
                    <select
                      value={row.categoryId ?? ""}
                      disabled={
                        categoryUpdatingId === row.id ||
                        row.tab === "deleted" ||
                        (row.sourceKind === "document" && !row.canEdit) ||
                        (row.sourceKind === "bank" && row.bankLine?.match_status !== "unmatched")
                      }
                      onChange={(event) => void updateCategory(row, event.target.value)}
                      className="h-9 w-full rounded-sm border bg-background px-2 text-xs disabled:opacity-60"
                    >
                      <option value="">Não categorizada</option>
                      {structure.categories
                        .filter((item) => item.status === "active")
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={row.statusLabel} />
                    {row.reconciled && <p className="mt-1 text-[11px] text-positive">Conciliada</p>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <TransactionActions
                      row={row}
                      onView={() => setDetails(row)}
                      onCategorize={() => setBankEditor(row)}
                      onConfirm={() => void confirmPosting(row)}
                      onEdit={() => {
                        if (row.document) {
                          setEditor({
                            nature: row.document.document_nature,
                            document: row.document,
                          });
                        } else {
                          setBankEditor(row);
                        }
                      }}
                      onLink={() => setBankEditor(row)}
                      onAttach={() => setBankEditor(row)}
                      onReconcile={() => setReconciliation(row)}
                      onDelete={() => requestDelete(row)}
                      onRestore={() => void restoreRow(row)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <TransactionDetailsDialog
        row={details}
        financial={financial}
        structure={structure}
        onClose={() => setDetails(null)}
        onEdit={(row) => {
          setDetails(null);
          if (row.document) {
            setEditor({ nature: row.document.document_nature, document: row.document });
          } else {
            setBankEditor(row);
          }
        }}
      />
      <TransactionEditorDialog
        open={Boolean(editor)}
        initialNature={editor?.nature ?? "receivable"}
        document={editor?.document ?? null}
        directory={financial}
        structure={structure}
        onClose={() => setEditor(null)}
        onChanged={() => refreshSilently(queryClient)}
      />
      <OfxImportDialog
        key={`ofx:${unit}:${ofxOpen}`}
        open={ofxOpen}
        cashAccounts={visibleAccounts}
        onClose={() => setOfxOpen(false)}
        onImported={() => refreshSilently(queryClient)}
      />
      <BankConnectionDialog
        open={bankConnectionOpen}
        onClose={() => setBankConnectionOpen(false)}
      />
      {bankEditor && (
        <BankLineEditorDialog
          row={bankEditor}
          structure={structure}
          financial={financial}
          onClose={() => setBankEditor(null)}
          onSaved={() => refreshSilently(queryClient)}
        />
      )}
      {reconciliation && (
        <ReconciliationDialog
          row={reconciliation}
          financial={financial}
          onClose={() => setReconciliation(null)}
          onSaved={() => refreshSilently(queryClient)}
        />
      )}
      {textAction && <TextActionDialog state={textAction} onClose={() => setTextAction(null)} />}
    </div>
  );
}

function AccountCard({
  account,
  unit,
  active,
  transactionCount,
  onClick,
}: {
  account: CashAccount;
  unit?: BusinessUnit;
  active: boolean;
  transactionCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-w-72 rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 ${
        active ? "border-primary ring-2 ring-primary/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{account.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {account.institution_name || "Conta manual"}
          </p>
        </div>
        <ConnectionBadge state={account.integration_status} />
      </div>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Saldo atual cadastrado
      </p>
      <p className="mt-1 font-mono text-lg font-semibold">
        {money(Number(account.current_balance || 0), account.currency_code)}
      </p>
      <div className="mt-4 space-y-1 border-t pt-3 text-xs text-muted-foreground">
        <p>{unit ? `${unit.code} — ${unit.name}` : "Unidade vinculada — detalhes protegidos"}</p>
        <p>{transactionCount} movimentação(ões) nos filtros atuais</p>
        <p>
          {account.last_synced_at
            ? localDateTime(account.last_synced_at)
            : `Atualizada em ${localDateTime(account.updated_at)}`}
        </p>
      </div>
    </button>
  );
}

function TransactionActions({
  row,
  onView,
  onCategorize,
  onConfirm,
  onEdit,
  onLink,
  onAttach,
  onReconcile,
  onDelete,
  onRestore,
}: {
  row: TransactionRow;
  onView: () => void;
  onCategorize: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  onLink: () => void;
  onAttach: () => void;
  onReconcile: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="Abrir ações da transação"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem onSelect={onView}>
          <Eye className="h-4 w-4" /> Ver detalhes
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!row.canEdit} onSelect={onCategorize}>
          <Tag className="h-4 w-4" /> Categorizar
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!row.canConfirm} onSelect={onConfirm}>
          <CheckCircle2 className="h-4 w-4" /> Confirmar lançamento
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!row.canEdit} onSelect={onEdit}>
          <Edit3 className="h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem disabled={row.sourceKind !== "bank" || !row.canEdit} onSelect={onLink}>
          <UserRound className="h-4 w-4" /> Vincular contato ou documento
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!row.canEdit} onSelect={onAttach}>
          <Paperclip className="h-4 w-4" /> Anexar comprovante
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={
            row.sourceKind !== "bank" ||
            row.tab === "deleted" ||
            row.bankLine?.match_status !== "unmatched" ||
            !row.bankLine?.confirmed_at
          }
          onSelect={onReconcile}
        >
          <Link2 className="h-4 w-4" /> Conciliar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {row.tab === "deleted" ? (
          <DropdownMenuItem disabled={!row.canRestore} onSelect={onRestore}>
            <RotateCcw className="h-4 w-4" /> Restaurar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={!row.canDelete}
            onSelect={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TransactionDetailsDialog({
  row,
  financial,
  structure,
  onClose,
  onEdit,
}: {
  row: TransactionRow | null;
  financial: FinancialDirectory;
  structure: TransactionReferenceData;
  onClose: () => void;
  onEdit: (row: TransactionRow) => void;
}) {
  if (!row) return null;
  const document = row.document;
  const settlements = financial.settlements
    .filter((settlement) =>
      document
        ? settlement.financial_document_id === document.id
        : settlement.id === row.bankLine?.matched_settlement_id,
    )
    .sort((left, right) => right.settlement_date.localeCompare(left.settlement_date));
  const payment = settlementSummary(row.amount, settlements);
  const project = document?.project_id
    ? structure.projects.find((item) => item.id === document.project_id)
    : null;
  const kind = transactionKind(row.expense, row.revenue);
  const unitLabel = row.unitCode === "—" ? row.unitName : `${row.unitCode} — ${row.unitName}`;
  const identification = [
    ["Unidade de negócio", unitLabel],
    ["Conta financeira", meaningfulValue(row.accountName)],
    ["Categoria", meaningfulValue(row.categoryName)],
    ["Projeto", project?.name ?? null],
    ["Contato", meaningfulValue(row.contactName)],
    [
      "Origem/Destino",
      row.originDestination !== row.contactName ? meaningfulValue(row.originDestination) : null,
    ],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const dates = document
    ? [
        ["Emissão", localDate(document.issue_date)],
        ["Competência", localDate(document.competence_date)],
        ["Vencimento", localDate(document.due_date)],
        ...(settlements[0]
          ? ([["Liquidação", localDate(settlements[0].settlement_date)]] as Array<[string, string]>)
          : []),
      ]
    : [
        ["Movimentação", localDate(row.bankLine?.transaction_date ?? row.date)],
        ...(row.bankLine?.value_date
          ? ([["Data de valor", localDate(row.bankLine.value_date)]] as Array<[string, string]>)
          : []),
      ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto">
        <DialogHeader className="pr-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-xl">{kind}</DialogTitle>
              <DialogDescription className="mt-1 break-words text-sm">
                {row.description}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
              <StatusPill status={row.statusLabel} />
              <p className="font-mono text-xl font-semibold">{money(row.amount)}</p>
            </div>
          </div>
        </DialogHeader>

        <section className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-3">
          <ViewField label="Valor" value={money(row.amount)} emphasis />
          <ViewField label="Tipo" value={kind} />
          <ViewField label="Situação" value={row.statusLabel} />
        </section>

        <ViewSection title="Identificação">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {identification.map(([label, value]) => (
              <ViewField key={label} label={label} value={value} />
            ))}
          </div>
        </ViewSection>

        <ViewSection title="Datas">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {dates.map(([label, value]) => (
              <ViewField key={label} label={label} value={value} />
            ))}
          </div>
        </ViewSection>

        <ViewSection title="Pagamento / liquidação">
          {payment.hasSettlements ? (
            <div className="space-y-3">
              {settlements.map((settlement) => {
                const account = financial.cashAccounts.find(
                  (item) => item.id === settlement.cash_account_id,
                );
                return (
                  <div
                    key={settlement.id}
                    className="grid gap-3 rounded-sm border bg-background p-3 sm:grid-cols-2"
                  >
                    <ViewField
                      label="Valor liquidado"
                      value={money(Number(settlement.functional_amount))}
                    />
                    <ViewField label="Data" value={localDate(settlement.settlement_date)} />
                    {account ? <ViewField label="Conta" value={accountLabel(account)} /> : null}
                    <ViewField label="Situação" value={settlementStatusLabel(settlement.status)} />
                  </div>
                );
              })}
              {document ? (
                <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm">
                  <span className="text-muted-foreground">Saldo restante</span>
                  <span className="font-mono font-semibold">{money(payment.remainingAmount)}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda não liquidada</p>
          )}
        </ViewSection>

        {row.notes?.trim() ? (
          <ViewSection title="Observações">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{row.notes}</p>
          </ViewSection>
        ) : null}

        <details className="rounded-lg border bg-muted/10 p-4 text-sm">
          <summary className="cursor-pointer font-medium">Origem técnica</summary>
          <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <ViewField label="Origem do registro" value={transactionOrigin(row)} />
            <ViewField
              label="Conciliação"
              value={row.reconciled ? "Conciliada" : "Não conciliada"}
            />
            <ViewField label="Atualizado em" value={localDateTime(row.updatedAt)} />
          </div>
        </details>

        <DialogFooter>
          {row.canEdit ? (
            <Button type="button" onClick={() => onEdit(row)}>
              <Edit3 className="h-4 w-4" /> Editar
            </Button>
          ) : null}
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function ViewField({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 break-words ${emphasis ? "font-mono text-base font-semibold" : "text-sm"}`}
      >
        {value}
      </p>
    </div>
  );
}

function meaningfulValue(value: string) {
  return value && value !== "—" ? value : null;
}

function transactionOrigin(row: TransactionRow) {
  if (row.sourceKind === "bank") return "Extrato bancário";
  return row.document?.document_number.startsWith("MANUAL-")
    ? "Lançamento manual"
    : "Documento financeiro";
}

function settlementStatusLabel(status: FinancialDirectory["settlements"][number]["status"]) {
  const labels = {
    draft: "Rascunho",
    pending_approval: "Aguardando aprovação",
    posted: "Liquidada",
    reversed: "Estornada",
    cancelled: "Cancelada",
  } satisfies Record<FinancialDirectory["settlements"][number]["status"], string>;
  return labels[status];
}

function BankLineEditorDialog({
  row,
  structure,
  financial,
  onClose,
  onSaved,
}: {
  row: TransactionRow | null;
  structure: TransactionReferenceData;
  financial: FinancialDirectory;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const line = row?.bankLine ?? null;
  const [memo, setMemo] = useState(line?.memo ?? "");
  const [counterparty, setCounterparty] = useState(line?.counterparty_name ?? "");
  const [categoryId, setCategoryId] = useState(line?.category_id ?? "");
  const [partyId, setPartyId] = useState(line?.party_id ?? "");
  const [documentId, setDocumentId] = useState(line?.financial_document_id ?? "");
  const [notes, setNotes] = useState(line?.notes ?? "");
  const [attachment, setAttachment] = useState(line?.attachment_reference ?? "");
  const [submitting, setSubmitting] = useState(false);

  if (!row || !line) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await updateStatementLine(line!.id, line!.version, {
        memo: memo.trim() || null,
        counterparty_name: counterparty.trim() || null,
        category_id: categoryId || null,
        party_id: partyId || null,
        financial_document_id: documentId || null,
        notes: notes.trim() || null,
        attachment_reference: attachment.trim() || null,
      });
      await onSaved();
      toast.success("Movimentação atualizada.");
      onClose();
    } catch (editError) {
      toast.error(
        editError instanceof Error ? editError.message : "Falha ao atualizar a movimentação.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Editar movimentação bancária</DialogTitle>
            <DialogDescription>
              {row.unitCode} — {row.unitName} · {row.accountName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Descrição">
              <Input value={memo} onChange={(event) => setMemo(event.target.value)} />
            </Field>
            <Field label="Origem/Destino">
              <Input
                value={counterparty}
                onChange={(event) => setCounterparty(event.target.value)}
              />
            </Field>
            <Field label="Categoria">
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className={selectClass}
              >
                <option value="">Não categorizada</option>
                {structure.categories
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Contato">
              <select
                value={partyId}
                onChange={(event) => setPartyId(event.target.value)}
                className={selectClass}
              >
                <option value="">Sem contato vinculado</option>
                {financial.parties
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.trade_name || item.legal_name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Documento financeiro">
              <select
                value={documentId}
                onChange={(event) => setDocumentId(event.target.value)}
                className={selectClass}
              >
                <option value="">Sem documento vinculado</option>
                {financial.documents
                  .filter(
                    (item) => item.business_unit_id === row.businessUnitId && !item.deleted_at,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.document_number} — {item.description}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Comprovante ou referência">
              <Input
                value={attachment}
                onChange={(event) => setAttachment(event.target.value)}
                placeholder="URL ou referência do arquivo"
              />
            </Field>
          </div>
          <Field label="Observações">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm"
              maxLength={4000}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReconciliationDialog({
  row,
  financial,
  onClose,
  onSaved,
}: {
  row: TransactionRow | null;
  financial: FinancialDirectory;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const line = row?.bankLine ?? null;
  const [targetType, setTargetType] = useState<"settlement" | "journal">("settlement");
  const [targetId, setTargetId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!row || !line) return null;

  const settlements = financial.settlements.filter(
    (item) => item.cash_account_id === row.cashAccountId && item.status === "posted",
  );
  const journals = financial.journalEntries.filter((item) => item.status === "posted");

  async function reconcile() {
    setSubmitting(true);
    try {
      if (!targetId) throw new Error("Selecione o lançamento de conciliação.");
      await updateStatementLine(line!.id, line!.version, {
        match_status: "matched",
        matched_settlement_id: targetType === "settlement" ? targetId : null,
        matched_journal_entry_id: targetType === "journal" ? targetId : null,
        ignored_reason: null,
      });
      await onSaved();
      toast.success("Transação conciliada.");
      onClose();
    } catch (reconcileError) {
      toast.error(reconcileError instanceof Error ? reconcileError.message : "Falha ao conciliar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conciliar transação</DialogTitle>
          <DialogDescription>
            Vincule a movimentação bancária a uma liquidação ou lançamento contábil já postado.
          </DialogDescription>
        </DialogHeader>
        <Field label="Tipo de vínculo">
          <select
            value={targetType}
            onChange={(event) => {
              setTargetType(event.target.value as typeof targetType);
              setTargetId("");
            }}
            className={selectClass}
          >
            <option value="settlement">Liquidação financeira</option>
            <option value="journal">Lançamento contábil</option>
          </select>
        </Field>
        <Field label="Registro">
          <select
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className={selectClass}
          >
            <option value="">Selecione</option>
            {targetType === "settlement"
              ? settlements.map((item) => (
                  <option key={item.id} value={item.id}>
                    {localDate(item.settlement_date)} — {money(Number(item.functional_amount))}
                  </option>
                ))
              : journals.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.entry_number} — {item.description}
                  </option>
                ))}
          </select>
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button disabled={submitting || !targetId} onClick={() => void reconcile()}>
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Conciliar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TextActionDialog({ state, onClose }: { state: TextAction; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!state) return null;
  const minimum = state.minimumLength ?? 1;
  async function submit() {
    setSubmitting(true);
    try {
      await state!.action(value);
      onClose();
    } catch (actionError) {
      toast.error(
        actionError instanceof Error ? actionError.message : "A operação não pôde ser concluída.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>
        <Field label={state.label}>
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant={state.destructive ? "destructive" : "default"}
            disabled={submitting || value.trim().length < minimum}
            onClick={() => void submit()}
          >
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const config = {
    connected: { label: "Conectada", icon: Cloud, className: "text-positive" },
    syncing: { label: "Sincronizando", icon: RefreshCw, className: "text-primary" },
    error: { label: "Erro", icon: AlertCircle, className: "text-destructive" },
    disconnected: { label: "Desconectada", icon: CloudOff, className: "text-muted-foreground" },
    manual: { label: "Manual", icon: Landmark, className: "text-muted-foreground" },
    none: { label: "Sem conta", icon: CloudOff, className: "text-muted-foreground" },
  }[state];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${config.className}`}>
      <Icon className={`h-3.5 w-3.5 ${state === "syncing" ? "animate-spin" : ""}`} /> {config.label}
    </span>
  );
}

type ConnectionState = CashAccount["integration_status"] | "none";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words font-medium text-foreground">{value}</p>
    </div>
  );
}

function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando transações…
    </div>
  );
}

function matchesFilters(
  row: TransactionRow,
  filters: {
    search: string;
    dateFrom: string;
    dateTo: string;
    nature: TransactionNature;
    categoryId: string;
    status: string;
  },
) {
  const normalized = filters.search.trim().toLowerCase();
  const searchValue =
    `${row.description} ${row.documentNumber} ${row.contactName} ${row.categoryName} ${row.amount} ${row.unitCode} ${row.accountName}`.toLowerCase();
  const natureMatches =
    filters.nature === "all" ||
    (filters.nature === "receivable" && row.revenue > 0) ||
    (filters.nature === "payable" && row.expense > 0) ||
    (filters.nature === "transfer" && row.categoryName.toLowerCase().includes("transfer"));
  const categoryMatches =
    filters.categoryId === "all" ||
    (filters.categoryId === "uncategorized"
      ? !row.categoryId
      : row.categoryId === filters.categoryId);
  return (
    (!normalized || searchValue.includes(normalized)) &&
    (!filters.dateFrom || row.date >= filters.dateFrom) &&
    (!filters.dateTo || row.date <= filters.dateTo) &&
    natureMatches &&
    categoryMatches &&
    (filters.status === "all" || row.statusKey === filters.status)
  );
}

function compareRows(
  a: TransactionRow,
  b: TransactionRow,
  key: SortKey,
  direction: "asc" | "desc",
) {
  const factor = direction === "asc" ? 1 : -1;
  const values: Record<SortKey, [string | number, string | number]> = {
    date: [a.date, b.date],
    description: [a.description, b.description],
    expense: [a.expense, b.expense],
    revenue: [a.revenue, b.revenue],
    unit: [a.unitName, b.unitName],
    account: [a.accountName, b.accountName],
    category: [a.categoryName, b.categoryName],
    status: [a.statusLabel, b.statusLabel],
  };
  const [left, right] = values[key];
  if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
  return String(left).localeCompare(String(right), "pt-BR") * factor;
}

function uniqueOptions(values: Array<[string, string]>): Array<[string, string]> {
  return [...new Map(values.filter(([value]) => Boolean(value))).entries()].sort((a, b) =>
    a[1].localeCompare(b[1], "pt-BR"),
  );
}

function transactionUnitForDisplay(unit: BusinessUnit | undefined): BusinessUnit | undefined {
  return unit;
}

function transactionUnitForRow(unit: BusinessUnit | undefined, businessUnitId: string) {
  return {
    id: businessUnitId,
    code: unit?.code ?? "—",
    name: unit?.name ?? "Unidade vinculada — detalhes protegidos",
  };
}

function unitByCode(structure: TransactionReferenceData | undefined, code: string) {
  return structure?.businessUnits.find((item) => item.code === code) ?? null;
}

function unitSort(a: BusinessUnit, b: BusinessUnit) {
  const order = [
    "CORPORATIVO",
    "MUSICOS360",
    "VIVENDOMUSICA",
    "LANDERSERVICES",
    "LANDERDISPATCH",
    "DJSTAY-EAD",
  ];
  const left = order.indexOf(a.code);
  const right = order.indexOf(b.code);
  return (left < 0 ? 99 : left) - (right < 0 ? 99 : right) || a.name.localeCompare(b.name, "pt-BR");
}

function accountLabel(account: CashAccount) {
  return account.institution_name ? `${account.name} · ${account.institution_name}` : account.name;
}

function documentStatusLabel(value: string, deletedAt: string | null) {
  if (deletedAt) return "Excluída";
  const labels: Record<string, string> = {
    draft: "Pendente",
    pending_approval: "Aguardando aprovação",
    approved: "Aprovada",
    issued: "Emitida",
    partially_settled: "Parcialmente liquidada",
    settled: "Lançada",
    overdue: "Vencida",
    in_dispute: "Em contestação",
    cancelled: "Cancelada",
    reversed: "Estornada",
  };
  return labels[value] ?? value;
}

function money(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value || 0));
}

function localDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00Z`),
  );
}

function localDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

function lastDayOfPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

async function refreshSilently(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["financial-directory"] }),
    queryClient.invalidateQueries({ queryKey: ["financial-operations"] }),
    queryClient.invalidateQueries({ queryKey: ["financial-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["managerial-report-snapshot"] }),
  ]);
}

const selectClass = "h-10 w-full rounded-sm border bg-background px-3 text-sm";
