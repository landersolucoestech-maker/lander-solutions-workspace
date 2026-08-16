import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
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
import type { TransactionReferenceData } from "./reference-data";
import { createFinanceRecord, updateFinanceRecord } from "./api";
import type { FinancialDirectory, FinancialDocument, FinancialDocumentNature } from "./types";

export function TransactionEditorDialog({
  open,
  initialNature,
  document,
  directory,
  structure,
  onClose,
  onChanged,
}: {
  open: boolean;
  initialNature: FinancialDocumentNature;
  document: FinancialDocument | null;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  if (!open) return null;
  return (
    <TransactionEditorForm
      key={document ? `${document.id}-${document.version}` : `new-${initialNature}`}
      initialNature={initialNature}
      document={document}
      directory={directory}
      structure={structure}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function TransactionEditorForm({
  initialNature,
  document,
  directory,
  structure,
  onClose,
  onChanged,
}: {
  initialNature: FinancialDocumentNature;
  document: FinancialDocument | null;
  directory: FinancialDirectory;
  structure: TransactionReferenceData;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { user } = useAuth();
  const defaultUnit = structure.businessUnits.find((item) => item.status === "active");
  const [nature, setNature] = useState<FinancialDocumentNature>(
    document?.document_nature ?? initialNature,
  );
  const [unitId, setUnitId] = useState(document?.business_unit_id ?? defaultUnit?.id ?? "");
  const [partyId, setPartyId] = useState(document?.party_id ?? directory.parties[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(document?.category_id ?? "");
  const [projectId, setProjectId] = useState(document?.project_id ?? "");
  const [description, setDescription] = useState(document?.description ?? "");
  const [issueDate, setIssueDate] = useState(document?.issue_date ?? today());
  const [competenceDate, setCompetenceDate] = useState(document?.competence_date ?? today());
  const [dueDate, setDueDate] = useState(document?.due_date ?? today());
  const [currency, setCurrency] = useState(document?.original_currency_code ?? "BRL");
  const [amount, setAmount] = useState(String(document?.original_amount ?? ""));
  const [fxRate, setFxRate] = useState(String(document?.fx_rate ?? 1));
  const [fxDate, setFxDate] = useState(document?.fx_date ?? today());
  const [notes, setNotes] = useState(document?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const selectedUnit = structure.businessUnits.find((item) => item.id === unitId) ?? null;
  const projects = structure.projects.filter((item) => item.business_unit_id === unitId);
  const categories = structure.categories.filter((item) => item.status === "active");
  const activeParties = directory.parties.filter((item) => item.status !== "blocked");
  const currencies = structure.currencies.filter((item) => item.is_active);

  function counterpartAccount(nextNature: FinancialDocumentNature) {
    const preferredCode = nextNature === "payable" ? "2100" : "1200";
    return (
      directory.accounts.find(
        (item) => item.code === preferredCode && item.status === "active" && item.posting_allowed,
      ) ??
      directory.accounts.find(
        (item) =>
          item.status === "active" &&
          item.posting_allowed &&
          item.account_type === (nextNature === "payable" ? "liability" : "asset"),
      ) ??
      null
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entity = structure.legalEntities.find(
      (item) => item.id === selectedUnit?.legal_entity_id,
    );
    const account = counterpartAccount(nature);
    const numericAmount = Number(amount.replace(",", "."));
    const numericFxRate = currency === "BRL" ? 1 : Number(fxRate.replace(",", "."));

    if (!entity || !selectedUnit) {
      toast.error("Selecione uma unidade válida.");
      return;
    }
    if (!partyId) {
      toast.error("Selecione um contato.");
      return;
    }
    if (!account) {
      toast.error("A configuração contábil interna desta transação não foi encontrada.");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (!Number.isFinite(numericFxRate) || numericFxRate <= 0) {
      toast.error("Informe uma taxa de câmbio válida.");
      return;
    }
    if (dueDate < issueDate) {
      toast.error("O vencimento não pode ser anterior à data de emissão.");
      return;
    }

    setSubmitting(true);
    try {
      const values = {
        legal_entity_id: entity.id,
        business_unit_id: selectedUnit.id,
        product_id: null,
        service_line_id: null,
        project_id: projectId || null,
        contract_id: document?.contract_id ?? null,
        party_id: partyId,
        cost_center_id: null,
        revenue_center_id: null,
        category_id: categoryId || null,
        document_nature: nature,
        source_type: nature === "payable" ? "bill" : "invoice",
        document_number: document?.document_number ?? manualDocumentNumber(issueDate),
        description: description.trim(),
        issue_date: issueDate,
        competence_date: competenceDate,
        due_date: dueDate,
        original_currency_code: currency,
        original_amount: numericAmount,
        fx_rate: numericFxRate,
        fx_date: currency === "BRL" ? issueDate : fxDate,
        fx_source: currency === "BRL" ? "functional_currency" : "manual",
        functional_currency_code: "BRL",
        tax_amount_functional: Number(document?.tax_amount_functional ?? 0),
        fee_amount_functional: Number(document?.fee_amount_functional ?? 0),
        classification_status: "classified",
        classification_due_at: null,
        classification_responsible_user_id: null,
        counterparty_account_id: account.id,
        status: document?.status ?? "draft",
        notes: notes.trim() || null,
        created_by: document?.created_by ?? user?.id ?? null,
      };

      if (document) {
        await updateFinanceRecord<FinancialDocument>(
          "financial_documents",
          document.id,
          document.version,
          values,
        );
        toast.success("Transação atualizada.");
      } else {
        await createFinanceRecord<FinancialDocument>("financial_documents", values);
        toast.success("Transação criada em rascunho.");
      }
      await onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar a transação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto">
        <form className="space-y-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{document ? "Editar transação" : "Nova transação"}</DialogTitle>
            <DialogDescription>
              Registre a operação em linguagem financeira. Contas contábeis e lançamentos de ledger
              são definidos internamente.
            </DialogDescription>
          </DialogHeader>

          <Section title="Tipo e identificação">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Tipo de transação"
                value={nature}
                onChange={(value) => setNature(value as FinancialDocumentNature)}
                options={[
                  ["receivable", "Receita / valor a receber"],
                  ["payable", "Despesa / valor a pagar"],
                ]}
              />
              <TextField
                label="Descrição"
                value={description}
                onChange={setDescription}
                required
                minLength={3}
                maxLength={1000}
              />
            </div>
          </Section>

          <Section title="Classificação operacional">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Unidade de negócio"
                value={unitId}
                onChange={(value) => {
                  setUnitId(value);
                  setProjectId("");
                }}
                options={structure.businessUnits
                  .filter((item) => item.status === "active")
                  .map((item) => [item.id, `${item.code} — ${item.name}`] as const)}
              />
              <SelectField
                label="Contato"
                value={partyId}
                onChange={setPartyId}
                options={activeParties.map(
                  (item) => [item.id, item.trade_name?.trim() || item.legal_name] as const,
                )}
              />
              <SelectField
                label="Categoria financeira"
                value={categoryId}
                onChange={setCategoryId}
                options={[
                  ["", "Sem categoria"],
                  ...categories.map((item) => [item.id, item.name] as const),
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
          </Section>

          <Section title="Datas e valor">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Emissão"
                value={issueDate}
                onChange={setIssueDate}
                type="date"
                required
              />
              <TextField
                label="Competência"
                value={competenceDate}
                onChange={setCompetenceDate}
                type="date"
                required
              />
              <TextField
                label="Vencimento"
                value={dueDate}
                onChange={setDueDate}
                type="date"
                required
              />
              <SelectField
                label="Moeda"
                value={currency}
                onChange={(value) => {
                  setCurrency(value);
                  if (value === "BRL") setFxRate("1");
                }}
                options={currencies.map(
                  (item) => [item.code, `${item.code} — ${item.name}`] as const,
                )}
              />
              <TextField
                label="Valor"
                value={amount}
                onChange={setAmount}
                inputMode="decimal"
                required
              />
            </div>
            {currency !== "BRL" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Taxa de câmbio para BRL"
                  value={fxRate}
                  onChange={setFxRate}
                  inputMode="decimal"
                  required
                />
                <TextField
                  label="Data do câmbio"
                  value={fxDate}
                  onChange={setFxDate}
                  type="date"
                  required
                />
              </div>
            )}
          </Section>

          <Section title="Informações complementares">
            <div className="space-y-2">
              <Label htmlFor="transaction-notes">Observações</Label>
              <textarea
                id="transaction-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-24 w-full rounded-sm border bg-background px-3 py-2 text-sm"
                maxLength={4000}
              />
            </div>
          </Section>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Salvar transação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
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
  inputMode,
  minLength,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  minLength?: number;
  maxLength?: number;
}) {
  const id = `transaction-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        inputMode={inputMode}
        minLength={minLength}
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function manualDocumentNumber(issueDate: string) {
  return `MANUAL-${issueDate.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
