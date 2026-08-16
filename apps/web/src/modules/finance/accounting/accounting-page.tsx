import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { SortableTableHeader } from "@/shared/components/sortable-table-header";
import { EmptyRow, Panel, StatusPill } from "@/shared/components/ui-kit";
import { useWorkspace } from "@/app/providers/workspace-context";
import { loadReportSnapshot } from "@/modules/finance/reports/api";
import { buildReportWorkbook, reportFilename } from "@/modules/finance/reports/report-workbook";
import { downloadWorkbook } from "@/modules/finance/reports/xlsx-export";
import { nextAccountingSort, sortAccountingRows, type AccountingTableSort } from "./table-sorting";

interface ImportedRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  amount: number;
}

type AccountingSortKey =
  "description" | "category" | "revenue" | "expense" | "unclassified" | "result";

const accountingHeaders: Array<{
  key: AccountingSortKey;
  label: string;
  align?: "left" | "right";
}> = [
  { key: "description", label: "Descrição" },
  { key: "category", label: "Categoria" },
  { key: "revenue", label: "Receitas", align: "right" },
  { key: "expense", label: "Despesas", align: "right" },
  { key: "unclassified", label: "Não classificado", align: "right" },
  { key: "result", label: "Resultado", align: "right" },
];

export function AccountingPage() {
  const { unit, period } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importedRows, setImportedRows] = useState<ImportedRow[]>([]);
  const [importedName, setImportedName] = useState<string | null>(null);
  const [knownHashes, setKnownHashes] = useState<Set<string>>(() => new Set());
  const [tableSort, setTableSort] = useState<AccountingTableSort<AccountingSortKey>>({
    key: "description",
    direction: "asc",
  });

  const query = useQuery({
    queryKey: ["managerial-report-snapshot", unit, period],
    queryFn: () => loadReportSnapshot({ unitCode: unit, period }),
  });
  const snapshot = query.data;

  const resultRows = useMemo(
    () => (importedRows.length > 0 ? importedRows : (snapshot?.dreRows ?? [])),
    [importedRows, snapshot?.dreRows],
  );
  const accountingRows = useMemo(() => resultRows.map(toAccountingRow), [resultRows]);
  const sortedAccountingRows = useMemo(
    () =>
      sortAccountingRows(accountingRows, tableSort.direction, (row) => {
        switch (tableSort.key) {
          case "description":
            return row.accountCode;
          case "category":
            return row.category;
          case "revenue":
            return row.revenue;
          case "expense":
            return row.expense;
          case "unclassified":
            return row.unclassified;
          case "result":
            return row.result;
        }
      }),
    [accountingRows, tableSort],
  );

  const exportXlsx = useCallback(() => {
    if (!snapshot) return;
    downloadWorkbook(reportFilename(snapshot), buildReportWorkbook(snapshot), snapshot.generatedAt);
    toast.success("Profit & Loss exportado em XLSX.");
  }, [snapshot]);

  useEffect(() => {
    const importXlsxFromTopbar = () => inputRef.current?.click();
    const printReport = () => window.print();
    window.addEventListener("accounting:import-xlsx", importXlsxFromTopbar);
    window.addEventListener("accounting:export-xlsx", exportXlsx);
    window.addEventListener("accounting:print", printReport);
    return () => {
      window.removeEventListener("accounting:import-xlsx", importXlsxFromTopbar);
      window.removeEventListener("accounting:export-xlsx", exportXlsx);
      window.removeEventListener("accounting:print", printReport);
    };
  }, [exportXlsx]);

  if (query.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Calculando Profit & Loss…
      </div>
    );
  }

  if (query.error || !snapshot) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {query.error instanceof Error
            ? query.error.message
            : "Falha ao carregar a contabilidade."}
        </div>
      </div>
    );
  }

  const currentSnapshot = snapshot;
  const summary = currentSnapshot.dashboard.summary;
  const unclassifiedTotal = accountingRows.reduce((sum, row) => sum + row.unclassified, 0);
  const hasAggregateWithoutDetails =
    accountingRows.length === 0 &&
    Math.abs(summary.revenue) + Math.abs(summary.deductions) + Math.abs(summary.totalExpense) > 0;

  async function importXlsx(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Selecione um arquivo XLSX válido.");
      return;
    }
    if (file.size === 0) {
      toast.error("O arquivo está vazio.");
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map((item) => item.toString(16).padStart(2, "0"))
        .join("");
      if (knownHashes.has(hash)) {
        toast.error("Este arquivo já foi importado nesta sessão.");
        return;
      }

      const sheetRows = await readFirstWorksheet(bytes);
      if (sheetRows.length < 2) {
        toast.error("O XLSX deve conter cabeçalho e pelo menos um registro.");
        return;
      }
      const headers = sheetRows[0].map((value) => normalizeHeader(String(value ?? "")));
      const required = ["account_code", "account_name", "account_type", "amount"];
      const missing = required.filter((item) => !headers.includes(item));
      if (missing.length > 0) {
        toast.error(`Estrutura inválida. Colunas obrigatórias: ${required.join(", ")}.`);
        return;
      }

      const indexes = Object.fromEntries(required.map((item) => [item, headers.indexOf(item)]));
      const rows: ImportedRow[] = [];
      const seen = new Set<string>();
      for (let index = 1; index < sheetRows.length; index += 1) {
        const values = sheetRows[index].map((value) => String(value ?? "").trim());
        if (values.every((value) => !value)) continue;
        const accountCode = values[indexes.account_code] ?? "";
        const accountName = values[indexes.account_name] ?? "";
        const accountType = values[indexes.account_type] ?? "";
        const rawValue = values[indexes.amount] ?? "";
        const rawAmount = rawValue.includes(",")
          ? rawValue.replace(/\./g, "").replace(",", ".")
          : rawValue;
        const amount = Number(rawAmount);
        const rowKey = `${accountCode}|${accountName}|${accountType}|${rawAmount}`;
        if (!accountCode || !accountName || !accountType || !Number.isFinite(amount)) {
          toast.error(`Registro inválido na linha ${index + 1}.`);
          return;
        }
        if (seen.has(rowKey)) {
          toast.error(`Registro duplicado na linha ${index + 1}.`);
          return;
        }
        seen.add(rowKey);
        rows.push({ accountCode, accountName, accountType, amount });
      }

      setImportedRows(rows);
      setImportedName(file.name);
      setKnownHashes((current) => new Set(current).add(hash));
      toast.success(`${rows.length} registros XLSX validados e carregados para conferência.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar o XLSX.");
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importXlsx(file);
          event.currentTarget.value = "";
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AccountingCard label="Receita bruta" value={summary.revenue} />
        <AccountingCard label="Deduções" value={summary.deductions} />
        <AccountingCard label="Despesas" value={summary.totalExpense} />
        <AccountingCard
          label={summary.operatingResult >= 0 ? "Lucro operacional" : "Prejuízo operacional"}
          value={Math.abs(summary.operatingResult)}
          positive={summary.operatingResult >= 0}
          negative={summary.operatingResult < 0}
        />
        <AccountingCard label="Margem operacional" value={summary.marginPercent} percentage />
      </div>

      {importedName && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            Pré-visualização importada: <strong>{importedName}</strong> · {importedRows.length}{" "}
            registros.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setImportedRows([]);
              setImportedName(null);
            }}
          >
            Voltar aos dados do sistema
          </Button>
        </div>
      )}

      <Panel
        title="Profit & Loss"
        description={`Competência ${period} · ${unit === "TODAS" ? "todas as unidades" : unit}. Valores em BRL.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                {accountingHeaders.map(({ key, label, align }) => (
                  <SortableTableHeader
                    key={key}
                    label={label}
                    align={align}
                    active={tableSort.key === key}
                    direction={tableSort.direction}
                    onSort={() => setTableSort((current) => nextAccountingSort(current, key))}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {accountingRows.length === 0 && (
                <EmptyRow
                  colSpan={6}
                  label={
                    hasAggregateWithoutDetails
                      ? "Os totais existem, mas os lançamentos detalhados não estão disponíveis para este acesso."
                      : "Nenhum lançamento postado na competência."
                  }
                />
              )}
              {sortedAccountingRows.map((row) => (
                <tr key={`${row.accountCode}:${row.description}`} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.description}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {row.accountCode}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.category} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-positive">
                    {row.revenue > 0 ? money(row.revenue) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-destructive">
                    {row.expense > 0 ? money(row.expense) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-amber-700">
                    {row.unclassified !== 0 ? money(row.unclassified) : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs ${
                      row.result >= 0 ? "text-positive" : "text-destructive"
                    }`}
                  >
                    {money(row.result)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 bg-muted/30 font-semibold">
                <td className="px-4 py-3">Resultado operacional</td>
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right font-mono text-positive">
                  {money(summary.revenue)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-destructive">
                  {money(summary.deductions + summary.totalExpense)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-amber-700">
                  {unclassifiedTotal !== 0 ? money(unclassifiedTotal) : "—"}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono ${
                    summary.operatingResult >= 0 ? "text-positive" : "text-destructive"
                  }`}
                >
                  {money(summary.operatingResult)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function toAccountingRow(row: ImportedRow) {
  const amount = Math.abs(Number(row.amount || 0));
  const type = row.accountType.toLowerCase();
  const revenue = type === "revenue" ? amount : 0;
  const expense = ["deduction", "expense", "investment", "reserve"].includes(type) ? amount : 0;
  const unclassified = type === "unclassified" ? Number(row.amount || 0) : 0;
  return {
    accountCode: row.accountCode,
    description: row.accountName,
    category: accountTypeLabel(row.accountType),
    revenue,
    expense,
    unclassified,
    result: revenue - expense,
  };
}

function AccountingCard({
  label,
  value,
  positive = false,
  negative = false,
  percentage = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
  percentage?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-2 font-mono text-lg font-semibold ${
          positive ? "text-positive" : negative ? "text-destructive" : ""
        }`}
      >
        {percentage ? `${Number(value).toFixed(1)}%` : money(value)}
      </p>
    </div>
  );
}

function normalizeHeader(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const aliases: Record<string, string> = {
    conta: "account_code",
    codigo_da_conta: "account_code",
    descricao: "account_name",
    nome_da_conta: "account_name",
    tipo: "account_type",
    classificacao: "account_type",
    valor: "amount",
  };
  return aliases[normalized] ?? normalized;
}

async function readFirstWorksheet(bytes: Uint8Array): Promise<string[][]> {
  const files = await unzipWorkbook(bytes);
  const decoder = new TextDecoder();
  const sharedStringsXml = files.get("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsXml
    ? parseSharedStrings(decoder.decode(sharedStringsXml))
    : [];

  const workbookXml = files.get("xl/workbook.xml");
  const relationshipsXml = files.get("xl/_rels/workbook.xml.rels");
  let worksheetPath = "xl/worksheets/sheet1.xml";
  if (workbookXml && relationshipsXml) {
    const workbook = parseXml(decoder.decode(workbookXml));
    const firstSheet = workbook.getElementsByTagNameNS("*", "sheet")[0];
    const relationshipId =
      firstSheet?.getAttribute("r:id") ??
      firstSheet?.getAttributeNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "id",
      );
    const relationships = parseXml(decoder.decode(relationshipsXml));
    const relationship = Array.from(relationships.getElementsByTagNameNS("*", "Relationship")).find(
      (item) => item.getAttribute("Id") === relationshipId,
    );
    const target = relationship?.getAttribute("Target");
    if (target) worksheetPath = normalizeWorkbookPath(target);
  }

  const worksheetXml = files.get(worksheetPath);
  if (!worksheetXml) throw new Error("A primeira planilha do XLSX não foi encontrada.");
  const worksheet = parseXml(decoder.decode(worksheetXml));
  return Array.from(worksheet.getElementsByTagNameNS("*", "row")).map((row) => {
    const values: string[] = [];
    for (const cell of Array.from(row.getElementsByTagNameNS("*", "c"))) {
      const column = columnIndex(cell.getAttribute("r") ?? "A1");
      const type = cell.getAttribute("t");
      let value = "";
      if (type === "inlineStr") {
        value = Array.from(cell.getElementsByTagNameNS("*", "t"))
          .map((node) => node.textContent ?? "")
          .join("");
      } else {
        const raw = cell.getElementsByTagNameNS("*", "v")[0]?.textContent ?? "";
        value = type === "s" ? (sharedStrings[Number(raw)] ?? "") : raw;
      }
      values[column] = value;
    }
    return values;
  });
}

function parseSharedStrings(xml: string) {
  const document = parseXml(xml);
  return Array.from(document.getElementsByTagNameNS("*", "si")).map((item) =>
    Array.from(item.getElementsByTagNameNS("*", "t"))
      .map((node) => node.textContent ?? "")
      .join(""),
  );
}

function parseXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error("O arquivo XLSX contém XML inválido.");
  }
  return document;
}

function normalizeWorkbookPath(target: string) {
  const normalized = target.replaceAll("\\", "/").replace(/^\//, "");
  if (normalized.startsWith("xl/")) return normalized;
  return `xl/${normalized.replace(/^\.\//, "")}`;
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function unzipWorkbook(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findSignature(view, 0x06054b50, Math.max(0, bytes.length - 65_557));
  if (eocdOffset < 0) throw new Error("O arquivo não é um XLSX válido.");
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const files = new Map<string, Uint8Array>();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("O diretório interno do XLSX está corrompido.");
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + fileNameLength),
    );

    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error("Uma entrada interna do XLSX está corrompida.");
    }
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const content =
      method === 0
        ? new Uint8Array(compressed)
        : method === 8
          ? await inflateRaw(compressed)
          : null;
    if (content) files.set(name.replaceAll("\\", "/"), content);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function findSignature(view: DataView, signature: number, minimumOffset: number) {
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === signature) return offset;
  }
  return -1;
}

async function inflateRaw(bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
}

function accountTypeLabel(value: string) {
  const labels: Record<string, string> = {
    revenue: "Receita",
    deduction: "Dedução",
    contra_revenue: "Dedução",
    unclassified: "Não classificado",
    expense: "Despesa",
    asset: "Ativo",
    liability: "Passivo",
    equity: "Patrimônio líquido",
  };
  return labels[value] ?? value;
}
