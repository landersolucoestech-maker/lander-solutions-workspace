import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, LoaderCircle, Pencil, Plus, Send, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { EmptyRow, StatusPill, UnitTag } from "@/shared/components/ui-kit";
import type { TransactionReferenceData } from "./reference-data";
import {
  approveFinancialDocument,
  createFinanceRecord,
  deleteFinanceRecord,
  postFinancialSettlement,
  submitFinancialDocument,
  submitFinancialSettlement,
  updateFinanceRecord,
} from "./api";
import {
  accountName,
  documentStatusLabel,
  errorMessage,
  formatDate,
  formatMoney,
  formatTimestamp,
  partyName,
  scopeName,
  todayIso,
  unitCodeFor,
  type FinancePermissionSet,
} from "./documents-page";
import type {
  FinancialDirectory,
  FinancialDocument,
  FinancialDocumentLine,
  FinancialSettlement,
} from "./types";

type DetailEntity = "line" | "settlement";
type DetailRecord = FinancialDocumentLine | FinancialSettlement;

type ModalState =
  | { entity: DetailEntity; action: "create" }
  | { entity: DetailEntity; action: "view" | "edit" | "destroy"; record: DetailRecord }
  | null;

export function FinancialDocumentDetailsDialog({
  document,
  directory,
  structure,
  permissions,
  userId,
  onClose,
  onChanged,
}: {
  document: FinancialDocument | null;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  permissions: FinancePermissionSet;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  if (!document) return null;
  return (
    <FinancialDocumentDetailsContent
      key={`${document.id}-${document.version}`}
      document={document}
      directory={directory}
      structure={structure}
      permissions={permissions}
      userId={userId}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function FinancialDocumentDetailsContent({
  document,
  directory,
  structure,
  permissions,
  userId,
  onClose,
  onChanged,
}: {
  document: FinancialDocument;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  permissions: FinancePermissionSet;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);

  const lines = useMemo(
    () =>
      directory.documentLines
        .filter((item) => item.financial_document_id === document.id)
        .sort((a, b) => a.sequence_no - b.sequence_no),
    [directory.documentLines, document.id],
  );
  const settlements = useMemo(
    () =>
      directory.settlements
        .filter((item) => item.financial_document_id === document.id)
        .sort((a, b) => b.settlement_date.localeCompare(a.settlement_date)),
    [directory.settlements, document.id],
  );
  const approvals = directory.approvals.filter(
    (item) => item.object_type === "document" && item.object_id === document.id,
  );
  const journalEntry = document.journal_entry_id
    ? (directory.journalEntries.find((item) => item.id === document.journal_entry_id) ?? null)
    : null;
  const journalLines = journalEntry
    ? directory.journalLines
        .filter((item) => item.journal_entry_id === journalEntry.id)
        .sort((a, b) => a.line_no - b.line_no)
    : [];

  const lineTotal = lines.reduce((sum, item) => sum + Number(item.functional_amount), 0);
  const settledTotal = settlements
    .filter((item) => item.status === "posted")
    .reduce((sum, item) => sum + Number(item.functional_amount), 0);
  const remaining = Math.max(0, Number(document.functional_amount) - settledTotal);
  const draftEditable =
    permissions.manageDraft && document.status === "draft" && document.journal_entry_id === null;
  const recognized = ["approved", "issued", "partially_settled"].includes(document.status);

  async function refresh() {
    await onChanged();
    await queryClient.invalidateQueries({ queryKey: ["financial-directory"] });
  }

  async function submitDocument() {
    setBusy(true);
    try {
      await submitFinancialDocument({
        documentId: document.id,
        expectedVersion: document.version,
      });
      await refresh();
      toast.success("Documento enviado para aprovação.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function approveDocument() {
    setBusy(true);
    try {
      await approveFinancialDocument({
        documentId: document.id,
        expectedVersion: document.version,
      });
      await refresh();
      toast.success("Documento aprovado e reconhecido no ledger.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[95vh] max-w-[92vw] overflow-y-auto xl:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {document.description}
            <StatusPill status={documentStatusLabel(document.status)} />
          </DialogTitle>
          <DialogDescription>
            {document.document_number} ·{" "}
            {document.document_nature === "payable" ? "Conta a pagar" : "Conta a receber"} · valores
            originais e funcionais preservados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <InfoCard label="Contraparte" value={partyName(directory, document.party_id)} />
          <InfoCard label="Unidade" value={unitCodeFor(structure, document.business_unit_id)} />
          <InfoCard label="Escopo" value={scopeName(structure, document)} />
          <InfoCard
            label="Valor original"
            value={formatMoney(Number(document.original_amount), document.original_currency_code)}
          />
          <InfoCard
            label="Valor funcional"
            value={formatMoney(
              Number(document.functional_amount),
              document.functional_currency_code,
            )}
          />
          <InfoCard
            label="Saldo aberto"
            value={formatMoney(remaining, document.functional_currency_code)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <InfoCard label="Emissão" value={formatDate(document.issue_date)} />
          <InfoCard label="Competência" value={formatDate(document.competence_date)} />
          <InfoCard label="Vencimento" value={formatDate(document.due_date)} />
          <InfoCard
            label="Câmbio"
            value={`${Number(document.fx_rate).toFixed(10)} · ${formatDate(document.fx_date)}`}
          />
          <InfoCard label="Fonte do câmbio" value={document.fx_source} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-muted/20 p-3">
          <div className="text-sm text-muted-foreground">
            Linhas classificadas: <strong>{formatMoney(lineTotal, "BRL")}</strong> de{" "}
            <strong>{formatMoney(Number(document.functional_amount), "BRL")}</strong>
          </div>
          <div className="flex flex-wrap gap-2">
            {document.status === "draft" && permissions.manageDraft && (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  busy ||
                  lines.length === 0 ||
                  Math.abs(lineTotal - Number(document.functional_amount)) > 0.000001
                }
                onClick={() => void submitDocument()}
              >
                <Send /> Enviar para aprovação
              </Button>
            )}
            {document.status === "pending_approval" &&
              permissions.approveDocument &&
              document.submitted_by !== userId &&
              document.created_by !== userId && (
                <Button size="sm" disabled={busy} onClick={() => void approveDocument()}>
                  <CheckCircle2 /> Aprovar e reconhecer
                </Button>
              )}
          </div>
        </div>

        <Tabs defaultValue="lines" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="lines">Linhas ({lines.length})</TabsTrigger>
            <TabsTrigger value="settlements">Liquidações ({settlements.length})</TabsTrigger>
            <TabsTrigger value="journal">Ledger ({journalLines.length})</TabsTrigger>
            <TabsTrigger value="approvals">Aprovações ({approvals.length})</TabsTrigger>
            <TabsTrigger value="metadata">Metadados</TabsTrigger>
          </TabsList>

          <TabsContent value="lines">
            <Section
              title="Classificação do documento"
              description="As linhas devem totalizar exatamente o valor funcional antes da aprovação."
              canCreate={draftEditable}
              onCreate={() => setModal({ entity: "line", action: "create" })}
            >
              <LinesTable
                lines={lines}
                directory={directory}
                canEdit={draftEditable}
                onAction={setModal}
              />
            </Section>
          </TabsContent>

          <TabsContent value="settlements">
            <Section
              title="Pagamentos e recebimentos"
              description="Liquidações exigem submissão e postagem por usuário distinto."
              canCreate={permissions.createSettlement && recognized && remaining > 0}
              onCreate={() => setModal({ entity: "settlement", action: "create" })}
            >
              <SettlementsTable
                settlements={settlements}
                directory={directory}
                permissions={permissions}
                userId={userId}
                onAction={setModal}
                onChanged={refresh}
              />
              <div className="grid gap-2 border-t p-3 text-sm sm:grid-cols-3">
                <p>
                  Liquidado: <strong>{formatMoney(settledTotal, "BRL")}</strong>
                </p>
                <p>
                  Em aberto: <strong>{formatMoney(remaining, "BRL")}</strong>
                </p>
                <p className="text-muted-foreground">Taxas são contabilizadas separadamente.</p>
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="journal">
            <Section
              title="Lançamento de reconhecimento"
              description="Uma postagem consolidada é imutável; correções exigem estorno integral."
              canCreate={false}
            >
              {journalEntry ? (
                <>
                  <div className="grid gap-3 border-b p-3 sm:grid-cols-4">
                    <InfoCard label="Número" value={`#${journalEntry.entry_number}`} />
                    <InfoCard label="Situação" value={journalEntry.status} />
                    <InfoCard
                      label="Débitos"
                      value={formatMoney(Number(journalEntry.total_debit), "BRL")}
                    />
                    <InfoCard
                      label="Créditos"
                      value={formatMoney(Number(journalEntry.total_credit), "BRL")}
                    />
                  </div>
                  <JournalLinesTable
                    lines={journalLines}
                    directory={directory}
                    structure={structure}
                  />
                </>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  O lançamento será criado quando o documento for aprovado.
                </div>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="approvals">
            <Section
              title="Trilha de aprovação"
              description="Solicitante e aprovador devem ser usuários diferentes."
              canCreate={false}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr className="label-caps">
                      <th className="px-4 py-2 text-left">Decisão</th>
                      <th className="px-4 py-2 text-left">Solicitante</th>
                      <th className="px-4 py-2 text-left">Aprovador</th>
                      <th className="px-4 py-2 text-left">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvals.length === 0 && (
                      <EmptyRow colSpan={4} label="Nenhuma aprovação registrada." />
                    )}
                    {approvals.map((approval) => (
                      <tr key={approval.id} className="border-t">
                        <td className="px-4 py-3">
                          <StatusPill status={approval.decision} />
                        </td>
                        <td className="num px-4 py-3 text-xs">{approval.requested_by}</td>
                        <td className="num px-4 py-3 text-xs">
                          {approval.approver_user_id ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {formatTimestamp(approval.decided_at ?? approval.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="metadata">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard
                label="Conta de contrapartida"
                value={accountName(directory, document.counterparty_account_id)}
              />
              <InfoCard label="Classificação" value={document.classification_status} />
              <InfoCard
                label="Impostos em BRL"
                value={formatMoney(Number(document.tax_amount_functional), "BRL")}
              />
              <InfoCard
                label="Taxas em BRL"
                value={formatMoney(Number(document.fee_amount_functional), "BRL")}
              />
              <InfoCard label="Referência externa" value={document.external_reference ?? "—"} />
              <InfoCard label="Criado em" value={formatTimestamp(document.created_at)} />
              <InfoCard label="Aprovado em" value={formatTimestamp(document.approved_at)} />
              <InfoCard label="Versão" value={String(document.version)} />
            </div>
          </TabsContent>
        </Tabs>

        <DetailRecordDialog
          state={modal}
          document={document}
          directory={directory}
          structure={structure}
          remaining={remaining}
          userId={userId}
          onClose={() => setModal(null)}
          onChanged={async () => {
            await refresh();
            setModal(null);
          }}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinesTable({
  lines,
  directory,
  canEdit,
  onAction,
}: {
  lines: FinancialDocumentLine[];
  directory: FinancialDirectory;
  canEdit: boolean;
  onAction: (state: Exclude<ModalState, null>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Seq.</th>
            <th className="px-4 py-2 text-left">Descrição</th>
            <th className="px-4 py-2 text-left">Conta</th>
            <th className="px-4 py-2 text-left">Rateio</th>
            <th className="px-4 py-2 text-right">Original</th>
            <th className="px-4 py-2 text-right">BRL</th>
            <th className="px-4 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && <EmptyRow colSpan={7} label="Nenhuma linha de classificação." />}
          {lines.map((line) => (
            <tr key={line.id} className="border-t">
              <td className="num px-4 py-3">{line.sequence_no}</td>
              <td className="px-4 py-3">{line.description}</td>
              <td className="px-4 py-3">{accountName(directory, line.managerial_account_id)}</td>
              <td className="px-4 py-3">
                <StatusPill status={line.allocation_status} />
              </td>
              <td className="num px-4 py-3 text-right">
                {Number(line.original_amount).toFixed(6)}
              </td>
              <td className="num px-4 py-3 text-right">
                {formatMoney(Number(line.functional_amount), "BRL")}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAction({ entity: "line", action: "view", record: line })}
                  >
                    <Eye /> Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => onAction({ entity: "line", action: "edit", record: line })}
                  >
                    <Pencil /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!canEdit}
                    onClick={() => onAction({ entity: "line", action: "destroy", record: line })}
                  >
                    <Trash2 /> Excluir
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettlementsTable({
  settlements,
  directory,
  permissions,
  userId,
  onAction,
  onChanged,
}: {
  settlements: FinancialSettlement[];
  directory: FinancialDirectory;
  permissions: FinancePermissionSet;
  userId: string | null;
  onAction: (state: Exclude<ModalState, null>) => void;
  onChanged: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function submit(item: FinancialSettlement) {
    setBusyId(item.id);
    try {
      await submitFinancialSettlement({ settlementId: item.id, expectedVersion: item.version });
      await onChanged();
      toast.success("Liquidação enviada para aprovação.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function post(item: FinancialSettlement) {
    setBusyId(item.id);
    try {
      await postFinancialSettlement({ settlementId: item.id, expectedVersion: item.version });
      await onChanged();
      toast.success("Liquidação postada no ledger.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Data</th>
            <th className="px-4 py-2 text-left">Conta</th>
            <th className="px-4 py-2 text-right">Original</th>
            <th className="px-4 py-2 text-right">BRL</th>
            <th className="px-4 py-2 text-right">Taxa</th>
            <th className="px-4 py-2 text-left">Situação</th>
            <th className="px-4 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {settlements.length === 0 && (
            <EmptyRow colSpan={7} label="Nenhuma liquidação registrada." />
          )}
          {settlements.map((item) => {
            const editable = permissions.createSettlement && item.status === "draft";
            return (
              <tr key={item.id} className="border-t">
                <td className="num px-4 py-3 text-xs">{formatDate(item.settlement_date)}</td>
                <td className="px-4 py-3">{cashAccountName(directory, item.cash_account_id)}</td>
                <td className="num px-4 py-3 text-right">
                  {formatMoney(Number(item.original_amount), item.original_currency_code)}
                </td>
                <td className="num px-4 py-3 text-right">
                  {formatMoney(Number(item.functional_amount), "BRL")}
                </td>
                <td className="num px-4 py-3 text-right">
                  {formatMoney(Number(item.bank_fee_functional), "BRL")}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onAction({ entity: "settlement", action: "view", record: item })
                      }
                    >
                      <Eye /> Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!editable}
                      onClick={() =>
                        onAction({ entity: "settlement", action: "edit", record: item })
                      }
                    >
                      <Pencil /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!editable}
                      onClick={() =>
                        onAction({ entity: "settlement", action: "destroy", record: item })
                      }
                    >
                      <Trash2 /> Excluir
                    </Button>
                    {item.status === "draft" && permissions.createSettlement && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === item.id}
                        onClick={() => void submit(item)}
                      >
                        <Send /> Submeter
                      </Button>
                    )}
                    {item.status === "pending_approval" &&
                      permissions.postSettlement &&
                      item.requested_by !== userId && (
                        <Button
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => void post(item)}
                        >
                          <CheckCircle2 /> Postar
                        </Button>
                      )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function JournalLinesTable({
  lines,
  directory,
  structure,
}: {
  lines: FinancialDirectory["journalLines"];
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Linha</th>
            <th className="px-4 py-2 text-left">Conta</th>
            <th className="px-4 py-2 text-left">Unidade</th>
            <th className="px-4 py-2 text-right">Débito</th>
            <th className="px-4 py-2 text-right">Crédito</th>
            <th className="px-4 py-2 text-left">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-t">
              <td className="num px-4 py-3">{line.line_no}</td>
              <td className="px-4 py-3">{accountName(directory, line.managerial_account_id)}</td>
              <td className="px-4 py-3">
                <UnitTag>{unitCodeFor(structure, line.business_unit_id)}</UnitTag>
              </td>
              <td className="num px-4 py-3 text-right">
                {formatMoney(Number(line.debit_amount), "BRL")}
              </td>
              <td className="num px-4 py-3 text-right">
                {formatMoney(Number(line.credit_amount), "BRL")}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{line.description ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailRecordDialog({
  state,
  document,
  directory,
  structure,
  remaining,
  userId,
  onClose,
  onChanged,
}: {
  state: ModalState;
  document: FinancialDocument;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  remaining: number;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  if (!state) return null;
  if (state.action === "view") {
    return (
      <ViewDetailRecordDialog
        state={state as { entity: DetailEntity; action: "view"; record: DetailRecord }}
        directory={directory}
        onClose={onClose}
      />
    );
  }
  if (state.action === "destroy") {
    return (
      <DestroyDetailRecordDialog
        key={`${state.entity}-${state.record.id}`}
        state={state as { entity: DetailEntity; action: "destroy"; record: DetailRecord }}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  }
  return (
    <DetailRecordForm
      key={
        state.action === "create"
          ? `${state.entity}-new`
          : `${state.entity}-${state.record.id}-${state.record.version}`
      }
      entity={state.entity}
      record={state.action === "edit" ? state.record : null}
      document={document}
      directory={directory}
      structure={structure}
      remaining={remaining}
      userId={userId}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function DetailRecordForm({
  entity,
  record,
  document,
  directory,
  structure,
  remaining,
  userId,
  onClose,
  onChanged,
}: {
  entity: DetailEntity;
  record: DetailRecord | null;
  document: FinancialDocument;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  remaining: number;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const lineRecord = entity === "line" ? (record as FinancialDocumentLine | null) : null;
  const settlementRecord = entity === "settlement" ? (record as FinancialSettlement | null) : null;
  const defaultLineAccount = directory.accounts.find(
    (item) =>
      item.posting_allowed &&
      item.status === "active" &&
      (document.document_nature === "payable"
        ? ["expense", "investment", "asset", "deduction"].includes(item.account_type)
        : ["revenue", "deduction", "liability"].includes(item.account_type)),
  );
  const compatibleCash = directory.cashAccounts.filter(
    (item) => item.status === "active" && item.currency_code === document.original_currency_code,
  );
  const defaultFeeAccount = directory.accounts.find((item) => item.code === "7100");

  const [sequence, setSequence] = useState(
    String(lineRecord?.sequence_no ?? nextLineSequence(directory, document.id)),
  );
  const [accountId, setAccountId] = useState(
    lineRecord?.managerial_account_id ?? defaultLineAccount?.id ?? "",
  );
  const [description, setDescription] = useState(lineRecord?.description ?? "");
  const [originalAmount, setOriginalAmount] = useState(
    lineRecord?.original_amount?.toString() ??
      (entity === "line"
        ? document.original_amount.toString()
        : (settlementRecord?.original_amount?.toString() ?? "")),
  );
  const [functionalAmount, setFunctionalAmount] = useState(
    lineRecord?.functional_amount?.toString() ??
      (entity === "line" ? document.functional_amount.toString() : ""),
  );
  const [allocationStatus, setAllocationStatus] = useState(
    lineRecord?.allocation_status ?? "direct",
  );
  const [categoryId, setCategoryId] = useState(
    lineRecord?.category_id ?? document.category_id ?? "",
  );
  const [centerId, setCenterId] = useState(
    lineRecord?.cost_center_id ??
      lineRecord?.revenue_center_id ??
      document.cost_center_id ??
      document.revenue_center_id ??
      "",
  );
  const [projectId, setProjectId] = useState(lineRecord?.project_id ?? document.project_id ?? "");
  const [productId, setProductId] = useState(lineRecord?.product_id ?? document.product_id ?? "");
  const [serviceLineId, setServiceLineId] = useState(
    lineRecord?.service_line_id ?? document.service_line_id ?? "",
  );

  const [cashAccountId, setCashAccountId] = useState(
    settlementRecord?.cash_account_id ?? compatibleCash[0]?.id ?? "",
  );
  const [settlementDate, setSettlementDate] = useState(
    settlementRecord?.settlement_date ?? todayIso(),
  );
  const [settlementOriginalAmount, setSettlementOriginalAmount] = useState(
    settlementRecord?.original_amount?.toString() ?? "",
  );
  const [settlementFxRate, setSettlementFxRate] = useState(
    settlementRecord?.fx_rate?.toString() ?? document.fx_rate.toString(),
  );
  const [bankFee, setBankFee] = useState(settlementRecord?.bank_fee_functional?.toString() ?? "0");
  const [feeAccountId, setFeeAccountId] = useState(
    settlementRecord?.fee_account_id ?? defaultFeeAccount?.id ?? "",
  );
  const [externalReference, setExternalReference] = useState(
    settlementRecord?.external_reference ?? "",
  );
  const [notes, setNotes] = useState(settlementRecord?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const products = structure.products.filter(
    (item) => item.business_unit_id === document.business_unit_id,
  );
  const services = structure.serviceLines.filter(
    (item) => item.business_unit_id === document.business_unit_id,
  );
  const projects = structure.projects.filter(
    (item) => item.business_unit_id === document.business_unit_id,
  );
  const centers =
    document.document_nature === "payable"
      ? structure.costCenters.filter((item) => item.business_unit_id === document.business_unit_id)
      : structure.revenueCenters.filter(
          (item) => item.business_unit_id === document.business_unit_id,
        );
  const lineAccounts = directory.accounts.filter(
    (item) => item.posting_allowed && item.status === "active",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (entity === "line") {
        if (!accountId) throw new Error("Selecione a conta gerencial da linha.");
        if (productId && serviceLineId)
          throw new Error("Selecione produto ou serviço, nunca ambos.");
        const values = {
          financial_document_id: document.id,
          sequence_no: Number(sequence),
          managerial_account_id: accountId,
          category_id: categoryId || null,
          cost_center_id: document.document_nature === "payable" ? centerId || null : null,
          revenue_center_id: document.document_nature === "receivable" ? centerId || null : null,
          project_id: projectId || null,
          product_id: productId || null,
          service_line_id: serviceLineId || null,
          description: description.trim(),
          original_amount: Number(originalAmount),
          functional_amount: Number(functionalAmount),
          tax_amount_functional: lineRecord?.tax_amount_functional ?? 0,
          allocation_status: allocationStatus,
        };
        if (lineRecord) {
          await updateFinanceRecord<FinancialDocumentLine>(
            "financial_document_lines",
            lineRecord.id,
            lineRecord.version,
            values,
          );
        } else {
          await createFinanceRecord<FinancialDocumentLine>("financial_document_lines", values);
        }
      } else {
        if (!cashAccountId)
          throw new Error("Cadastre ou selecione uma conta de caixa na moeda original.");
        const functional = Number(settlementOriginalAmount) * Number(settlementFxRate);
        if (functional > remaining + 0.000001 && !settlementRecord) {
          throw new Error("A liquidação excede o saldo aberto do documento.");
        }
        const fee = Number(bankFee);
        const values = {
          financial_document_id: document.id,
          cash_account_id: cashAccountId,
          settlement_date: settlementDate,
          original_currency_code: document.original_currency_code,
          original_amount: Number(settlementOriginalAmount),
          fx_rate: Number(settlementFxRate),
          bank_fee_functional: fee,
          fee_account_id: fee > 0 ? feeAccountId || null : null,
          status: settlementRecord?.status ?? "draft",
          requested_by: settlementRecord?.requested_by ?? userId,
          requested_at: settlementRecord?.requested_at ?? null,
          posted_by: settlementRecord?.posted_by ?? null,
          posted_at: settlementRecord?.posted_at ?? null,
          journal_entry_id: settlementRecord?.journal_entry_id ?? null,
          external_reference: externalReference.trim() || null,
          notes: notes.trim() || null,
        };
        if (settlementRecord) {
          await updateFinanceRecord<FinancialSettlement>(
            "financial_settlements",
            settlementRecord.id,
            settlementRecord.version,
            values,
          );
        } else {
          await createFinanceRecord<FinancialSettlement>("financial_settlements", values);
        }
      }
      await onChanged();
      toast.success(record ? "Registro atualizado." : "Registro criado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {record ? "Editar" : "Criar"} {entity === "line" ? "linha" : "liquidação"}
            </DialogTitle>
            <DialogDescription>
              {entity === "line"
                ? "Classifique o valor em uma conta gerencial e nas dimensões da unidade."
                : "Registre o pagamento ou recebimento preservando moeda, câmbio e taxa bancária."}
            </DialogDescription>
          </DialogHeader>

          {entity === "line" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Sequência"
                  type="number"
                  min="1"
                  value={sequence}
                  onChange={setSequence}
                  required
                />
                <SelectField
                  label="Conta gerencial"
                  value={accountId}
                  onChange={setAccountId}
                  options={lineAccounts.map((item) => [item.id, `${item.code} — ${item.name}`])}
                />
              </div>
              <TextField label="Descrição" value={description} onChange={setDescription} required />
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="Valor original"
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={originalAmount}
                  onChange={setOriginalAmount}
                  required
                />
                <TextField
                  label="Valor funcional BRL"
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={functionalAmount}
                  onChange={setFunctionalAmount}
                  required
                />
                <SelectField
                  label="Rateio"
                  value={allocationStatus}
                  onChange={(value) =>
                    setAllocationStatus(value as "direct" | "pending_allocation" | "allocated")
                  }
                  options={allocationStatusOptions}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label={
                    document.document_nature === "payable" ? "Centro de custo" : "Centro de receita"
                  }
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
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Conta de caixa"
                  value={cashAccountId}
                  onChange={setCashAccountId}
                  options={compatibleCash.map((item) => [item.id, `${item.code} — ${item.name}`])}
                />
                <TextField
                  label="Data"
                  type="date"
                  value={settlementDate}
                  onChange={setSettlementDate}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label={`Valor ${document.original_currency_code}`}
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={settlementOriginalAmount}
                  onChange={setSettlementOriginalAmount}
                  required
                />
                <TextField
                  label="Taxa para BRL"
                  type="number"
                  min="0.0000000001"
                  step="0.0000000001"
                  value={settlementFxRate}
                  onChange={setSettlementFxRate}
                  required
                />
                <TextField
                  label="Taxa bancária BRL"
                  type="number"
                  min="0"
                  step="0.01"
                  value={bankFee}
                  onChange={setBankFee}
                  required
                />
              </div>
              {Number(bankFee) > 0 && (
                <SelectField
                  label="Conta da taxa"
                  value={feeAccountId}
                  onChange={setFeeAccountId}
                  options={directory.accounts
                    .filter((item) => item.posting_allowed && item.status === "active")
                    .map((item) => [item.id, `${item.code} — ${item.name}`])}
                />
              )}
              <TextField
                label="Referência externa"
                value={externalReference}
                onChange={setExternalReference}
              />
              <TextAreaField label="Observações" value={notes} onChange={setNotes} />
              <div className="rounded-sm border bg-muted/20 p-3 text-sm">
                Valor funcional estimado:{" "}
                <strong>
                  {formatMoney(
                    (Number(settlementOriginalAmount) || 0) * (Number(settlementFxRate) || 0),
                    "BRL",
                  )}
                </strong>
              </div>
            </>
          )}

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

function ViewDetailRecordDialog({
  state,
  directory,
  onClose,
}: {
  state: { entity: DetailEntity; action: "view"; record: DetailRecord };
  directory: FinancialDirectory;
  onClose: () => void;
}) {
  const fields =
    state.entity === "line"
      ? lineViewFields(state.record as FinancialDocumentLine, directory)
      : settlementViewFields(state.record as FinancialSettlement, directory);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ver {state.entity === "line" ? "linha" : "liquidação"}</DialogTitle>
          <DialogDescription>Registro persistido e auditável.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <InfoCard key={label} label={label} value={value} />
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DestroyDetailRecordDialog({
  state,
  onClose,
  onChanged,
}: {
  state: { entity: DetailEntity; action: "destroy"; record: DetailRecord };
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const expected = state.record.id.slice(0, 8);
  const allowed =
    state.entity === "line" || (state.record as FinancialSettlement).status === "draft";

  async function destroy() {
    setSubmitting(true);
    try {
      if (!allowed) throw new Error("Somente liquidações em rascunho podem ser excluídas.");
      await deleteFinanceRecord(
        state.entity === "line" ? "financial_document_lines" : "financial_settlements",
        state.record.id,
      );
      await onChanged();
      toast.success("Registro excluído.");
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
          <DialogTitle>Excluir {state.entity === "line" ? "linha" : "liquidação"}</DialogTitle>
          <DialogDescription>
            A exclusão física só é permitida enquanto o registro permanece em rascunho.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="finance-detail-delete">Digite {expected} para confirmar</Label>
          <Input
            id="finance-detail-delete"
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
            disabled={!allowed || submitting || confirmation !== expected}
            onClick={() => void destroy()}
          >
            {submitting && <LoaderCircle className="animate-spin" />} Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  description,
  canCreate,
  onCreate,
  children,
}: {
  title: string;
  description: string;
  canCreate: boolean;
  onCreate?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-sm border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {canCreate && onCreate && (
          <Button size="sm" variant="outline" onClick={onCreate}>
            <Plus /> Criar
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border bg-muted/20 p-3">
      <p className="label-caps">{label}</p>
      <p className="mt-1 break-words text-sm">{value}</p>
    </div>
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
    <div className="space-y-2">
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

function lineViewFields(
  line: FinancialDocumentLine,
  directory: FinancialDirectory,
): Array<[string, string]> {
  return [
    ["Sequência", String(line.sequence_no)],
    ["Descrição", line.description],
    ["Conta", accountName(directory, line.managerial_account_id)],
    ["Original", Number(line.original_amount).toFixed(6)],
    ["BRL", formatMoney(Number(line.functional_amount), "BRL")],
    ["Rateio", line.allocation_status],
    ["Versão", String(line.version)],
    ["ID", line.id],
  ];
}

function settlementViewFields(
  item: FinancialSettlement,
  directory: FinancialDirectory,
): Array<[string, string]> {
  return [
    ["Conta", cashAccountName(directory, item.cash_account_id)],
    ["Data", formatDate(item.settlement_date)],
    ["Original", formatMoney(Number(item.original_amount), item.original_currency_code)],
    ["BRL", formatMoney(Number(item.functional_amount), "BRL")],
    ["Taxa", formatMoney(Number(item.bank_fee_functional), "BRL")],
    ["Situação", item.status],
    ["Referência", item.external_reference ?? "—"],
    ["Versão", String(item.version)],
  ];
}

function cashAccountName(directory: FinancialDirectory, id: string): string {
  const account = directory.cashAccounts.find((item) => item.id === id);
  return account ? `${account.code} — ${account.name}` : "Conta indisponível";
}

function nextLineSequence(directory: FinancialDirectory, documentId: string): number {
  return (
    Math.max(
      0,
      ...directory.documentLines
        .filter((item) => item.financial_document_id === documentId)
        .map((item) => item.sequence_no),
    ) + 1
  );
}

const allocationStatusOptions: Array<readonly [string, string]> = [
  ["direct", "Direto"],
  ["pending_allocation", "Aguardando rateio"],
  ["allocated", "Rateado"],
];
