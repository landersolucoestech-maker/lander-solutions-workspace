import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
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
  createFinanceRecord,
  deleteFinanceRecord,
  postManualJournal,
  reverseJournalEntry,
  submitManualJournal,
  updateFinanceRecord,
  updateJournalLine,
} from "./api";
import {
  accountName,
  errorMessage,
  formatDate,
  formatMoney,
  formatTimestamp,
  partyName,
  todayIso,
  unitCodeFor,
  type FinancePermissionSet,
} from "./documents-page";
import type { FinancialDirectory, JournalEntry, JournalLine } from "./types";

type LineModalState =
  { action: "create" } | { action: "view" | "edit" | "destroy"; record: JournalLine } | null;

export function JournalDetailsDialog({
  entry,
  directory,
  structure,
  permissions,
  userId,
  onClose,
  onChanged,
}: {
  entry: JournalEntry | null;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  permissions: FinancePermissionSet;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  if (!entry) return null;
  return (
    <JournalDetailsContent
      key={`${entry.id}-${entry.version}`}
      entry={entry}
      directory={directory}
      structure={structure}
      permissions={permissions}
      userId={userId}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function JournalDetailsContent({
  entry,
  directory,
  structure,
  permissions,
  userId,
  onClose,
  onChanged,
}: {
  entry: JournalEntry;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  permissions: FinancePermissionSet;
  userId: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [lineModal, setLineModal] = useState<LineModalState>(null);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const lines = useMemo(
    () =>
      directory.journalLines
        .filter((line) => line.journal_entry_id === entry.id)
        .sort((a, b) => a.line_no - b.line_no),
    [directory.journalLines, entry.id],
  );
  const approvals = directory.approvals.filter(
    (approval) => approval.object_type === "journal_entry" && approval.object_id === entry.id,
  );
  const editable =
    permissions.ledgerCreate && entry.source_type === "manual" && entry.status === "draft";
  const balanced =
    Number(entry.total_debit) > 0 &&
    Math.abs(Number(entry.total_debit) - Number(entry.total_credit)) <= 0.000001;

  async function refresh() {
    await onChanged();
    await queryClient.invalidateQueries({ queryKey: ["financial-directory"] });
  }

  async function submitEntry() {
    setBusy(true);
    try {
      await submitManualJournal({ entryId: entry.id, expectedVersion: entry.version });
      await refresh();
      toast.success("Lançamento validado e enviado para postagem.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function postEntry() {
    setBusy(true);
    try {
      await postManualJournal({ entryId: entry.id, expectedVersion: entry.version });
      await refresh();
      toast.success("Lançamento postado no ledger.");
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
            #{entry.entry_number} — {entry.description}
            <StatusPill status={journalStatusLabel(entry.status)} />
          </DialogTitle>
          <DialogDescription>
            {sourceLabel(entry.source_type)} · competência {formatDate(entry.competence_date)} ·
            partidas dobradas imutáveis após postagem.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <InfoCard label="Origem" value={sourceLabel(entry.source_type)} />
          <InfoCard label="Competência" value={formatDate(entry.competence_date)} />
          <InfoCard label="Postagem" value={formatDate(entry.posting_date)} />
          <InfoCard label="Débitos" value={formatMoney(Number(entry.total_debit), "BRL")} />
          <InfoCard label="Créditos" value={formatMoney(Number(entry.total_credit), "BRL")} />
          <InfoCard label="Balanceado" value={balanced ? "Sim" : "Não"} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-muted/20 p-3">
          <p className="text-sm text-muted-foreground">
            {lines.length} linha(s) · diferença:{" "}
            <strong>
              {formatMoney(Number(entry.total_debit) - Number(entry.total_credit), "BRL")}
            </strong>
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.source_type === "manual" &&
              entry.status === "draft" &&
              permissions.ledgerCreate && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !balanced || lines.length < 2}
                  onClick={() => void submitEntry()}
                >
                  <Send /> Submeter
                </Button>
              )}
            {entry.source_type === "manual" &&
              entry.status === "validated" &&
              permissions.ledgerPost &&
              entry.created_by !== userId &&
              entry.validated_by !== userId && (
                <Button size="sm" disabled={busy} onClick={() => void postEntry()}>
                  <CheckCircle2 /> Postar
                </Button>
              )}
            {entry.status === "posted" &&
              permissions.ledgerReverse &&
              entry.posted_by !== userId &&
              !entry.reversed_by_entry_id && (
                <Button size="sm" variant="destructive" onClick={() => setReverseOpen(true)}>
                  <RotateCcw /> Estornar
                </Button>
              )}
          </div>
        </div>

        <Tabs defaultValue="lines" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="lines">Partidas ({lines.length})</TabsTrigger>
            <TabsTrigger value="approvals">Aprovações ({approvals.length})</TabsTrigger>
            <TabsTrigger value="metadata">Metadados</TabsTrigger>
          </TabsList>

          <TabsContent value="lines">
            <Section
              title="Linhas do lançamento"
              description="Cada linha possui apenas débito ou crédito, nunca ambos."
              canCreate={editable}
              onCreate={() => setLineModal({ action: "create" })}
            >
              <JournalLinesTable
                lines={lines}
                directory={directory}
                structure={structure}
                canEdit={editable}
                onAction={setLineModal}
              />
            </Section>
          </TabsContent>

          <TabsContent value="approvals">
            <Section
              title="Trilha de validação e postagem"
              description="Criador, validador e responsável pela postagem são segregados."
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
              <InfoCard label="Período" value={periodName(structure, entry.financial_period_id)} />
              <InfoCard label="Criado por" value={entry.created_by ?? "—"} />
              <InfoCard label="Validado por" value={entry.validated_by ?? "—"} />
              <InfoCard label="Postado por" value={entry.posted_by ?? "—"} />
              <InfoCard label="Postado em" value={formatTimestamp(entry.posted_at)} />
              <InfoCard label="Estorno de" value={entry.reversal_of_entry_id ?? "—"} />
              <InfoCard label="Estornado por" value={entry.reversed_by_entry_id ?? "—"} />
              <InfoCard label="Versão" value={String(entry.version)} />
            </div>
          </TabsContent>
        </Tabs>

        <JournalLineDialog
          state={lineModal}
          entry={entry}
          directory={directory}
          structure={structure}
          onClose={() => setLineModal(null)}
          onChanged={async () => {
            await refresh();
            setLineModal(null);
          }}
        />
        <ReverseEntryDialog
          open={reverseOpen}
          entry={entry}
          onClose={() => setReverseOpen(false)}
          onChanged={async () => {
            await refresh();
            setReverseOpen(false);
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

function JournalLinesTable({
  lines,
  directory,
  structure,
  canEdit,
  onAction,
}: {
  lines: JournalLine[];
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  canEdit: boolean;
  onAction: (state: Exclude<LineModalState, null>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="label-caps">
            <th className="px-4 py-2 text-left">Linha</th>
            <th className="px-4 py-2 text-left">Conta</th>
            <th className="px-4 py-2 text-left">Unidade</th>
            <th className="px-4 py-2 text-left">Dimensão</th>
            <th className="px-4 py-2 text-right">Débito</th>
            <th className="px-4 py-2 text-right">Crédito</th>
            <th className="px-4 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && <EmptyRow colSpan={7} label="Nenhuma partida registrada." />}
          {lines.map((line) => (
            <tr key={line.id} className="border-t align-top">
              <td className="num px-4 py-3">{line.line_no}</td>
              <td className="px-4 py-3">
                <p>{accountName(directory, line.managerial_account_id)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{line.description ?? "—"}</p>
              </td>
              <td className="px-4 py-3">
                <UnitTag>{unitCodeFor(structure, line.business_unit_id)}</UnitTag>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {lineDimension(line, directory, structure)}
              </td>
              <td className="num px-4 py-3 text-right">
                {formatMoney(Number(line.debit_amount), "BRL")}
              </td>
              <td className="num px-4 py-3 text-right">
                {formatMoney(Number(line.credit_amount), "BRL")}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAction({ action: "view", record: line })}
                  >
                    <Eye /> Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => onAction({ action: "edit", record: line })}
                  >
                    <Pencil /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!canEdit}
                    onClick={() => onAction({ action: "destroy", record: line })}
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

function JournalLineDialog({
  state,
  entry,
  directory,
  structure,
  onClose,
  onChanged,
}: {
  state: LineModalState;
  entry: JournalEntry;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  if (!state) return null;
  if (state.action === "view") {
    return (
      <ViewLineDialog
        line={state.record}
        directory={directory}
        structure={structure}
        onClose={onClose}
      />
    );
  }
  if (state.action === "destroy") {
    return (
      <DestroyLineDialog
        key={state.record.id}
        line={state.record}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  }
  return (
    <JournalLineForm
      key={state.action === "create" ? "journal-line-new" : state.record.id}
      line={state.action === "edit" ? state.record : null}
      entry={entry}
      directory={directory}
      structure={structure}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function JournalLineForm({
  line,
  entry,
  directory,
  structure,
  onClose,
  onChanged,
}: {
  line: JournalLine | null;
  entry: JournalEntry;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const initialUnit =
    structure.businessUnits.find((item) => item.code !== "CORPORATIVO") ??
    structure.businessUnits[0];
  const [lineNo, setLineNo] = useState(
    String(line?.line_no ?? nextLineNumber(directory, entry.id)),
  );
  const [accountId, setAccountId] = useState(
    line?.managerial_account_id ??
      directory.accounts.find((item) => item.posting_allowed && item.status === "active")?.id ??
      "",
  );
  const [unitId, setUnitId] = useState(line?.business_unit_id ?? initialUnit?.id ?? "");
  const [productId, setProductId] = useState(line?.product_id ?? "");
  const [serviceLineId, setServiceLineId] = useState(line?.service_line_id ?? "");
  const [projectId, setProjectId] = useState(line?.project_id ?? "");
  const [contractId, setContractId] = useState(line?.contract_id ?? "");
  const [partyId, setPartyId] = useState(line?.party_id ?? "");
  const [costCenterId, setCostCenterId] = useState(line?.cost_center_id ?? "");
  const [revenueCenterId, setRevenueCenterId] = useState(line?.revenue_center_id ?? "");
  const [categoryId, setCategoryId] = useState(line?.category_id ?? "");
  const [side, setSide] = useState(line && Number(line.credit_amount) > 0 ? "credit" : "debit");
  const [amount, setAmount] = useState(
    String(line ? Math.max(Number(line.debit_amount), Number(line.credit_amount)) : ""),
  );
  const [originalCurrency, setOriginalCurrency] = useState(line?.original_currency_code ?? "");
  const [originalAmount, setOriginalAmount] = useState(line?.original_amount?.toString() ?? "");
  const [fxRate, setFxRate] = useState(line?.fx_rate?.toString() ?? "");
  const [description, setDescription] = useState(line?.description ?? "");
  const [submitting, setSubmitting] = useState(false);

  const products = structure.products.filter((item) => item.business_unit_id === unitId);
  const services = structure.serviceLines.filter((item) => item.business_unit_id === unitId);
  const projects = structure.projects.filter((item) => item.business_unit_id === unitId);
  const contracts = directory.contracts.filter((item) => item.business_unit_id === unitId);
  const costCenters = structure.costCenters.filter((item) => item.business_unit_id === unitId);
  const revenueCenters = structure.revenueCenters.filter(
    (item) => item.business_unit_id === unitId,
  );
  const accounts = directory.accounts.filter(
    (item) => item.posting_allowed && item.status === "active",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (productId && serviceLineId) throw new Error("Selecione produto ou serviço, nunca ambos.");
      const hasOriginal = originalCurrency !== "" || originalAmount !== "" || fxRate !== "";
      if (hasOriginal && (!originalCurrency || !originalAmount || !fxRate)) {
        throw new Error("Moeda, valor original e taxa devem ser preenchidos em conjunto.");
      }
      const numericAmount = Number(amount);
      const values = {
        journal_entry_id: entry.id,
        line_no: Number(lineNo),
        managerial_account_id: accountId,
        business_unit_id: unitId,
        product_id: productId || null,
        service_line_id: serviceLineId || null,
        project_id: projectId || null,
        contract_id: contractId || null,
        party_id: partyId || null,
        cost_center_id: costCenterId || null,
        revenue_center_id: revenueCenterId || null,
        category_id: categoryId || null,
        debit_amount: side === "debit" ? numericAmount : 0,
        credit_amount: side === "credit" ? numericAmount : 0,
        original_currency_code: hasOriginal ? originalCurrency : null,
        original_amount: hasOriginal ? Number(originalAmount) : null,
        fx_rate: hasOriginal ? Number(fxRate) : null,
        description: description.trim() || null,
      };
      if (line) {
        await updateJournalLine(line.id, values);
      } else {
        await createFinanceRecord<JournalLine>("journal_lines", values);
      }
      await onChanged();
      toast.success(line ? "Partida atualizada." : "Partida criada.");
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
            <DialogTitle>{line ? "Editar partida" : "Criar partida"}</DialogTitle>
            <DialogDescription>
              Informe uma conta de postagem, uma unidade e apenas um lado da partida.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Número da linha"
              type="number"
              min="1"
              value={lineNo}
              onChange={setLineNo}
              required
            />
            <SelectField
              label="Conta gerencial"
              value={accountId}
              onChange={setAccountId}
              options={accounts.map((item) => [item.id, `${item.code} — ${item.name}`])}
            />
            <SelectField
              label="Unidade"
              value={unitId}
              onChange={(value) => {
                setUnitId(value);
                setProductId("");
                setServiceLineId("");
                setProjectId("");
                setContractId("");
                setCostCenterId("");
                setRevenueCenterId("");
              }}
              options={structure.businessUnits.map((item) => [
                item.id,
                `${item.code} — ${item.name}`,
              ])}
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
              label="Contraparte"
              value={partyId}
              onChange={setPartyId}
              options={[
                ["", "Sem contraparte"],
                ...directory.parties.map(
                  (item) => [item.id, item.trade_name || item.legal_name] as const,
                ),
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
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Centro de custo"
              value={costCenterId}
              onChange={setCostCenterId}
              options={[
                ["", "Sem centro de custo"],
                ...costCenters.map((item) => [item.id, `${item.code} — ${item.name}`] as const),
              ]}
            />
            <SelectField
              label="Centro de receita"
              value={revenueCenterId}
              onChange={setRevenueCenterId}
              options={[
                ["", "Sem centro de receita"],
                ...revenueCenters.map((item) => [item.id, `${item.code} — ${item.name}`] as const),
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Lado"
              value={side}
              onChange={setSide}
              options={[
                ["debit", "Débito"],
                ["credit", "Crédito"],
              ]}
            />
            <TextField
              label="Valor BRL"
              type="number"
              min="0.000001"
              step="0.000001"
              value={amount}
              onChange={setAmount}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Moeda original opcional"
              value={originalCurrency}
              onChange={setOriginalCurrency}
              options={[
                ["", "Sem moeda original"],
                ...structure.currencies.map((item) => [item.code, item.code] as const),
              ]}
            />
            <TextField
              label="Valor original"
              type="number"
              min="0.000001"
              step="0.000001"
              value={originalAmount}
              onChange={setOriginalAmount}
            />
            <TextField
              label="Taxa para BRL"
              type="number"
              min="0.0000000001"
              step="0.0000000001"
              value={fxRate}
              onChange={setFxRate}
            />
          </div>
          <TextAreaField label="Descrição" value={description} onChange={setDescription} />
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

function ViewLineDialog({
  line,
  directory,
  structure,
  onClose,
}: {
  line: JournalLine;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  onClose: () => void;
}) {
  const fields: Array<[string, string]> = [
    ["Linha", String(line.line_no)],
    ["Conta", accountName(directory, line.managerial_account_id)],
    ["Unidade", unitCodeFor(structure, line.business_unit_id)],
    ["Dimensões", lineDimension(line, directory, structure)],
    ["Débito", formatMoney(Number(line.debit_amount), "BRL")],
    ["Crédito", formatMoney(Number(line.credit_amount), "BRL")],
    [
      "Original",
      line.original_currency_code && line.original_amount !== null
        ? formatMoney(Number(line.original_amount), line.original_currency_code)
        : "—",
    ],
    ["Câmbio", line.fx_rate?.toString() ?? "—"],
    ["Descrição", line.description ?? "—"],
    ["ID", line.id],
  ];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ver partida</DialogTitle>
          <DialogDescription>Linha persistida do ledger.</DialogDescription>
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

function DestroyLineDialog({
  line,
  onClose,
  onChanged,
}: {
  line: JournalLine;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const expected = String(line.line_no);
  async function destroy() {
    setSubmitting(true);
    try {
      await deleteFinanceRecord("journal_lines", line.id);
      await onChanged();
      toast.success("Partida excluída.");
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
          <DialogTitle>Excluir partida</DialogTitle>
          <DialogDescription>
            Somente partidas de lançamento manual em rascunho podem ser removidas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="journal-line-delete">Digite {expected} para confirmar</Label>
          <Input
            id="journal-line-delete"
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
            disabled={submitting || confirmation !== expected}
            onClick={() => void destroy()}
          >
            {submitting && <LoaderCircle className="animate-spin" />} Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReverseEntryDialog({
  open,
  entry,
  onClose,
  onChanged,
}: {
  open: boolean;
  entry: JournalEntry;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;
  async function reverse() {
    setSubmitting(true);
    try {
      await reverseJournalEntry({
        entryId: entry.id,
        expectedVersion: entry.version,
        reversalDate: date,
        reason: reason.trim(),
      });
      await onChanged();
      toast.success("Estorno integral postado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }
  const expected = String(entry.entry_number);
  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Estornar lançamento #{entry.entry_number}</DialogTitle>
          <DialogDescription>
            Será criado um novo lançamento com débitos e créditos integralmente invertidos.
          </DialogDescription>
        </DialogHeader>
        <TextField label="Data do estorno" type="date" value={date} onChange={setDate} required />
        <TextAreaField label="Motivo obrigatório" value={reason} onChange={setReason} required />
        <div className="space-y-2">
          <Label htmlFor="journal-reverse-confirmation">Digite {expected} para confirmar</Label>
          <Input
            id="journal-reverse-confirmation"
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
            disabled={submitting || reason.trim().length < 5 || confirmation !== expected}
            onClick={() => void reverse()}
          >
            {submitting && <LoaderCircle className="animate-spin" />} Postar estorno
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
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={2000}
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

function journalStatusLabel(value: string): string {
  return (
    { draft: "rascunho", validated: "validado", posted: "postado", reversed: "estornado" }[value] ??
    value
  );
}
function sourceLabel(value: string): string {
  return (
    {
      manual: "Manual",
      financial_document: "Documento financeiro",
      settlement: "Liquidação",
      allocation: "Rateio",
      participation: "Participação",
      reversal: "Estorno",
      opening: "Abertura",
      closing: "Encerramento",
      integration: "Integração",
    }[value] ?? value
  );
}
function periodName(structure: TransactionReferenceData, id: string): string {
  const period = structure.periods.find((item) => item.id === id);
  return period
    ? `${formatDate(period.period_start)} a ${formatDate(period.period_end)}`
    : "Período indisponível";
}
function nextLineNumber(directory: FinancialDirectory, entryId: string): number {
  return (
    Math.max(
      0,
      ...directory.journalLines
        .filter((item) => item.journal_entry_id === entryId)
        .map((item) => item.line_no),
    ) + 1
  );
}
function lineDimension(
  line: JournalLine,
  directory: FinancialDirectory,
  structure: TransactionReferenceData,
): string {
  const values = [
    line.product_id ? structure.products.find((item) => item.id === line.product_id)?.name : null,
    line.service_line_id
      ? structure.serviceLines.find((item) => item.id === line.service_line_id)?.name
      : null,
    line.project_id ? structure.projects.find((item) => item.id === line.project_id)?.name : null,
    line.contract_id
      ? directory.contracts.find((item) => item.id === line.contract_id)?.code
      : null,
    line.party_id ? partyName(directory, line.party_id) : null,
  ].filter(Boolean);
  return values.length ? values.join(" · ") : "Escopo geral";
}
