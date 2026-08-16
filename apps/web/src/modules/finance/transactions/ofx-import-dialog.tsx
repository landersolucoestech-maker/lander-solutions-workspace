import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, FileUp, LoaderCircle } from "lucide-react";
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
import { Label } from "@/shared/components/ui/label";
import { EmptyRow, StatusPill } from "@/shared/components/ui-kit";
import {
  createStatementImport,
  createStatementLine,
  deleteStatementImport,
  listBankOperations,
  updateStatementImport,
} from "./bank-operations-api";
import type { CashAccount } from "./types";

interface ParsedOfxTransaction {
  date: string;
  type: "credit" | "debit";
  amount: number;
  reference: string;
  memo: string;
  counterparty: string;
}

interface ParsedOfx {
  fileName: string;
  checksum: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  transactions: ParsedOfxTransaction[];
}

export function OfxImportDialog({
  open,
  cashAccounts,
  onClose,
  onImported,
}: {
  open: boolean;
  cashAccounts: CashAccount[];
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const operationsQuery = useQuery({
    queryKey: ["financial-operations"],
    queryFn: listBankOperations,
    enabled: open,
  });
  const [accountId, setAccountId] = useState(cashAccounts[0]?.id ?? "");
  const [parsed, setParsed] = useState<ParsedOfx | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const account = cashAccounts.find((item) => item.id === accountId) ?? null;
  const existingReferences = useMemo(
    () =>
      new Set(
        (operationsQuery.data?.statementLines ?? [])
          .map((line) => line.bank_reference?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    [operationsQuery.data?.statementLines],
  );
  const duplicateReferences = useMemo(
    () =>
      parsed?.transactions.filter(
        (transaction) => transaction.reference && existingReferences.has(transaction.reference),
      ) ?? [],
    [existingReferences, parsed?.transactions],
  );
  const checksumAlreadyImported = Boolean(
    parsed &&
    operationsQuery.data?.statementImports.some(
      (item) => item.cash_account_id === accountId && item.checksum_sha256 === parsed.checksum,
    ),
  );

  if (!open) return null;

  async function selectFile(file: File) {
    setParsing(true);
    setParsed(null);
    try {
      if (!file.name.toLowerCase().endsWith(".ofx")) {
        throw new Error("Selecione um arquivo com extensão .ofx.");
      }
      if (file.size === 0) throw new Error("O arquivo OFX está vazio.");
      if (file.size > 10 * 1024 * 1024) throw new Error("O arquivo OFX excede o limite de 10 MB.");
      const buffer = await file.arrayBuffer();
      const checksum = await sha256(buffer);
      const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      const result = parseOfx(text, file.name, checksum);
      setParsed(result);
      toast.success(`${result.transactions.length} movimentações OFX validadas.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Arquivo OFX inválido.");
    } finally {
      setParsing(false);
    }
  }

  async function importFile() {
    if (!parsed || !account) return;
    if (checksumAlreadyImported) {
      toast.error("Este arquivo já foi importado para a conta selecionada.");
      return;
    }
    if (duplicateReferences.length > 0) {
      toast.error(
        `${duplicateReferences.length} movimentações possuem identificadores já importados. A importação foi bloqueada.`,
      );
      return;
    }
    if (parsed.currency !== account.currency_code) {
      toast.error(
        `A moeda do arquivo (${parsed.currency}) não corresponde à moeda da conta (${account.currency_code}).`,
      );
      return;
    }

    setSubmitting(true);
    let importId: string | null = null;
    try {
      const imported = await createStatementImport({
        cash_account_id: account.id,
        statement_format: "OFX",
        period_start: parsed.periodStart,
        period_end: parsed.periodEnd,
        opening_balance: parsed.openingBalance,
        closing_balance: parsed.closingBalance,
        currency_code: parsed.currency,
        storage_provider: "external",
        storage_bucket: null,
        storage_object_key: `browser-ofx/${parsed.checksum}/${sanitizeFileName(parsed.fileName)}`,
        checksum_sha256: parsed.checksum,
        status: "uploaded",
      });
      importId = imported.id;

      for (const [index, transaction] of parsed.transactions.entries()) {
        await createStatementLine({
          statement_import_id: imported.id,
          sequence_no: index + 1,
          transaction_date: transaction.date,
          value_date: null,
          transaction_type: transaction.type,
          amount: transaction.amount,
          currency_code: parsed.currency,
          bank_reference: transaction.reference || null,
          memo: transaction.memo || null,
          counterparty_name: transaction.counterparty || null,
          balance_after: null,
          match_status: "unmatched",
          matched_settlement_id: null,
          matched_journal_entry_id: null,
          ignored_reason: null,
        });
      }

      await updateStatementImport(imported.id, imported.version, { status: "validated" });
      await queryClient.invalidateQueries({ queryKey: ["financial-operations"] });
      await onImported();
      toast.success("OFX importado e validado com sucesso.");
      onClose();
    } catch (error) {
      if (importId) {
        try {
          await deleteStatementImport(importId);
        } catch {
          // O registro parcial permanece auditável se o banco impedir o rollback lógico.
        }
      }
      toast.error(error instanceof Error ? error.message : "Falha ao importar o OFX.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar OFX</DialogTitle>
          <DialogDescription>
            O arquivo é validado antes da gravação. Checksum, moeda e identificadores bancários
            impedem importações duplicadas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Conta financeira</Label>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
              disabled={submitting}
            >
              {cashAccounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name} ({item.currency_code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ofx-file">Arquivo OFX</Label>
            <label
              htmlFor="ofx-file"
              className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed bg-muted/20 px-3 text-sm hover:bg-muted/40"
            >
              {parsing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {parsed?.fileName ?? "Selecionar arquivo .ofx"}
            </label>
            <input
              id="ofx-file"
              type="file"
              accept=".ofx,application/x-ofx"
              className="hidden"
              disabled={parsing || submitting}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void selectFile(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        {cashAccounts.length === 0 && (
          <div className="rounded-sm border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Cadastre uma conta financeira antes de importar extratos OFX.
          </div>
        )}

        {parsed && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <PreviewCard
                label="Período"
                value={`${date(parsed.periodStart)} a ${date(parsed.periodEnd)}`}
              />
              <PreviewCard label="Moeda" value={parsed.currency} />
              <PreviewCard
                label="Saldo inicial"
                value={money(parsed.openingBalance, parsed.currency)}
              />
              <PreviewCard
                label="Saldo final"
                value={money(parsed.closingBalance, parsed.currency)}
              />
              <PreviewCard label="Movimentações" value={String(parsed.transactions.length)} />
            </div>

            {(checksumAlreadyImported || duplicateReferences.length > 0) && (
              <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {checksumAlreadyImported
                  ? "O mesmo arquivo já foi importado para esta conta."
                  : `${duplicateReferences.length} identificadores bancários já existem no sistema.`}
              </div>
            )}

            <div className="overflow-hidden rounded-sm border">
              <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 text-sm font-medium">
                <FileCheck2 className="h-4 w-4" /> Pré-visualização validada
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                    <tr className="label-caps">
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-left">Tipo</th>
                      <th className="px-4 py-2 text-left">Descrição</th>
                      <th className="px-4 py-2 text-left">Referência</th>
                      <th className="px-4 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.transactions.length === 0 && (
                      <EmptyRow colSpan={5} label="Nenhuma movimentação válida." />
                    )}
                    {parsed.transactions.slice(0, 100).map((transaction, index) => (
                      <tr key={`${transaction.reference}:${index}`} className="border-t">
                        <td className="px-4 py-2 font-mono text-xs">{date(transaction.date)}</td>
                        <td className="px-4 py-2">
                          <StatusPill
                            status={transaction.type === "credit" ? "Crédito" : "Débito"}
                          />
                        </td>
                        <td className="max-w-80 px-4 py-2">
                          {transaction.counterparty || transaction.memo || "—"}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">
                          {transaction.reference || "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {money(transaction.amount, parsed.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.transactions.length > 100 && (
                <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                  Exibindo as primeiras 100 de {parsed.transactions.length} movimentações.
                </p>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={submitting}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            disabled={
              submitting ||
              !parsed ||
              !account ||
              parsed.transactions.length === 0 ||
              checksumAlreadyImported ||
              duplicateReferences.length > 0
            }
            onClick={() => void importFile()}
          >
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Importar movimentações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseOfx(text: string, fileName: string, checksum: string): ParsedOfx {
  const normalized = text.replace(/\r/g, "");
  if (!/<OFX[>\s]/i.test(normalized))
    throw new Error("O arquivo não contém uma estrutura OFX válida.");
  const currency = tag(normalized, "CURDEF").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("A moeda CURDEF não foi encontrada no OFX.");

  const blocks = [
    ...normalized.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/STMTTRN>)/gi),
  ].map((match) => match[1]);
  if (blocks.length === 0) throw new Error("O OFX não possui blocos STMTTRN de movimentação.");

  const references = new Set<string>();
  const transactions = blocks.map((block, index) => {
    const rawAmount = Number(tag(block, "TRNAMT").replace(",", "."));
    if (!Number.isFinite(rawAmount) || rawAmount === 0) {
      throw new Error(`Valor inválido na movimentação ${index + 1}.`);
    }
    const dateValue = parseOfxDate(tag(block, "DTPOSTED"));
    const reference = tag(block, "FITID", false).trim();
    if (reference) {
      if (references.has(reference)) {
        throw new Error(`Identificador FITID duplicado dentro do arquivo: ${reference}.`);
      }
      references.add(reference);
    }
    const name = decodeOfx(tag(block, "NAME", false));
    const memo = decodeOfx(tag(block, "MEMO", false));
    return {
      date: dateValue,
      type: rawAmount >= 0 ? ("credit" as const) : ("debit" as const),
      amount: Math.abs(rawAmount),
      reference,
      memo,
      counterparty: name,
    };
  });

  const transactionDates = transactions.map((item) => item.date).sort();
  const periodStart = optionalOfxDate(tag(normalized, "DTSTART", false)) ?? transactionDates[0];
  const periodEnd = optionalOfxDate(tag(normalized, "DTEND", false)) ?? transactionDates.at(-1)!;
  const closingBalance = Number(tag(normalized, "BALAMT").replace(",", "."));
  if (!Number.isFinite(closingBalance)) throw new Error("O saldo final BALAMT é inválido.");
  const netMovement = transactions.reduce(
    (sum, item) => sum + (item.type === "credit" ? item.amount : -item.amount),
    0,
  );
  const openingBalance = closingBalance - netMovement;

  return {
    fileName,
    checksum,
    currency,
    periodStart,
    periodEnd,
    openingBalance,
    closingBalance,
    transactions,
  };
}

function tag(content: string, name: string, required = true) {
  const match = content.match(new RegExp(`<${name}>([^<\\n\\r]*)`, "i"));
  const value = match?.[1]?.trim() ?? "";
  if (required && !value) throw new Error(`Campo obrigatório ${name} não encontrado no OFX.`);
  return value;
}

function parseOfxDate(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) throw new Error(`Data OFX inválida: ${value || "vazia"}.`);
  const dateValue = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  if (Number.isNaN(new Date(`${dateValue}T12:00:00`).getTime())) {
    throw new Error(`Data OFX inválida: ${value}.`);
  }
  return dateValue;
}

function optionalOfxDate(value: string) {
  return value ? parseOfxDate(value) : null;
}

function decodeOfx(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .trim();
}

async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function PreviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium">{value}</p>
    </div>
  );
}

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}
