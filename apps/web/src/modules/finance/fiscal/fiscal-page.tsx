import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { RowActionsMenu } from "@/shared/components/row-actions-menu";
import { SortableTableHeader } from "@/shared/components/sortable-table-header";
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
import { EmptyRow, Panel, StatusPill } from "@/shared/components/ui-kit";
import { useWorkspace } from "@/app/providers/workspace-context";
import { deleteFiscalDocument, listFiscalDirectory } from "./api";
import { FiscalFormDialog } from "./fiscal-form-dialog";
import type { FiscalDirectory, FiscalDocument } from "./types";
import { nextFiscalSort, sortFiscalRows, type FiscalTableSort } from "./table-sorting";

type FiscalSortKey =
  "note" | "operation" | "recipient" | "unit" | "netAmount" | "issuedAt" | "status" | "pdf";

const fiscalHeaders: Array<{
  key: FiscalSortKey;
  label: string;
  align?: "left" | "right";
}> = [
  { key: "note", label: "Nota" },
  { key: "operation", label: "Operação" },
  { key: "recipient", label: "Tomador / Fornecedor" },
  { key: "unit", label: "Unidade" },
  { key: "netAmount", label: "Valor líquido", align: "right" },
  { key: "issuedAt", label: "Emissão" },
  { key: "status", label: "Status" },
  { key: "pdf", label: "PDF" },
];

export function FiscalPage() {
  const { unit } = useWorkspace();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [operation, setOperation] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<FiscalDocument | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FiscalDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tableSort, setTableSort] = useState<FiscalTableSort<FiscalSortKey>>({
    key: "note",
    direction: "asc",
  });
  const [sortingApplied, setSortingApplied] = useState(false);
  const query = useQuery({
    queryKey: ["fiscal-directory"],
    queryFn: listFiscalDirectory,
    retry: 1,
    staleTime: 30_000,
  });
  const data = query.data;

  useEffect(() => {
    const handleCreate = () => setCreateOpen(true);
    window.addEventListener("fiscal:create", handleCreate);
    return () => window.removeEventListener("fiscal:create", handleCreate);
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const normalized = search.trim().toLowerCase();
    const unitId = data.fiscalBusinessUnits.find((item) => item.code === unit)?.id;
    return data.fiscalDocuments
      .map((document) => {
        const source = data.financialDocuments.find(
          (item) => item.id === document.financial_document_id,
        );
        const party = data.fiscalParties.find((item) => item.id === document.party_id);
        const businessUnit = data.fiscalBusinessUnits.find(
          (item) => item.id === source?.business_unit_id,
        );
        return { document, source, party, businessUnit };
      })
      .filter(({ document, source, party, businessUnit }) => {
        const issued = document.issued_at?.slice(0, 10) ?? "";
        const matchesUnit = unit === "TODAS" || source?.business_unit_id === unitId;
        const matchesOperation = operation === "all" || document.operation_type === operation;
        const matchesStatus = status === "all" || document.workflow_status === status;
        const matchesDate = (!dateFrom || issued >= dateFrom) && (!dateTo || issued <= dateTo);
        const matchesSearch =
          !normalized ||
          `${document.fiscal_number} ${document.series ?? ""} ${document.recipient_name ?? ""} ${party?.legal_name ?? ""} ${businessUnit?.name ?? ""}`
            .toLowerCase()
            .includes(normalized);
        return matchesUnit && matchesOperation && matchesStatus && matchesDate && matchesSearch;
      });
  }, [data, dateFrom, dateTo, operation, search, status, unit]);

  const sortedRows = useMemo(() => {
    if (!sortingApplied) return rows;
    return sortFiscalRows(rows, tableSort.direction, ({ document, party, businessUnit }) => {
      switch (tableSort.key) {
        case "note":
          return document.fiscal_number;
        case "operation":
          return document.operation_type === "saida" ? "Saída" : "Entrada";
        case "recipient":
          return document.recipient_name || party?.trade_name || party?.legal_name;
        case "unit":
          return businessUnit?.name;
        case "netAmount":
          return document.operation_type === "saida"
            ? Number(document.net_amount)
            : -Number(document.net_amount);
        case "issuedAt":
          return document.issued_at ? Date.parse(document.issued_at) : null;
        case "status":
          return statusLabel(document.workflow_status);
        case "pdf":
          return document.pdf_object_key ? "Disponível" : "Não anexado";
      }
    });
  }, [rows, sortingApplied, tableSort]);

  if (query.isError) {
    return (
      <Panel title="Falha ao carregar notas fiscais">
        <div className="space-y-3 p-4">
          <p className="text-sm text-destructive">
            {query.error instanceof Error
              ? query.error.message
              : "Falha ao carregar notas fiscais."}
          </p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </Panel>
    );
  }
  if (query.isLoading || !data) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando notas fiscais…
      </div>
    );
  }

  const outgoing = rows.filter((row) => row.document.operation_type === "saida");
  const incoming = rows.filter((row) => row.document.operation_type === "entrada");
  const balance =
    outgoing.reduce((sum, row) => sum + Number(row.document.net_amount || 0), 0) -
    incoming.reduce((sum, row) => sum + Number(row.document.net_amount || 0), 0);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteFiscalDocument(pendingDelete.id);
      await queryClient.invalidateQueries({ queryKey: ["fiscal-directory"] });
      toast.success("Nota fiscal excluída.");
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir a nota fiscal.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Metric label="Total de notas" value={rows.length} />
        <Metric label="Notas de saída" value={outgoing.length} positive />
        <Metric label="Notas de entrada" value={incoming.length} negative />
        <Metric
          label="Emitidas"
          value={rows.filter((row) => row.document.workflow_status === "emitida").length}
          positive
        />
        <Metric
          label="Pendentes"
          value={rows.filter((row) => row.document.workflow_status === "pendente").length}
          warning
        />
        <Metric
          label="Canceladas"
          value={rows.filter((row) => row.document.workflow_status === "cancelada").length}
        />
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Saldo fiscal</p>
          <p
            className={`mt-2 font-mono text-lg font-semibold ${balance >= 0 ? "text-positive" : "text-destructive"}`}
          >
            {money(balance)}
          </p>
        </div>
      </div>

      <Panel
        title="Notas fiscais"
        description="Todos os fluxos fiscais estão consolidados nesta página."
      >
        <div className="flex flex-wrap items-end gap-3 border-b p-4">
          <FieldLabel label="Emissão inicial">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9"
            />
          </FieldLabel>
          <FieldLabel label="Emissão final">
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9"
            />
          </FieldLabel>
          <FieldLabel label="Pesquisar">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Número, tomador, fornecedor ou unidade"
              className="h-9 min-w-64"
            />
          </FieldLabel>
          <FieldLabel label="Operação">
            <select
              value={operation}
              onChange={(event) => setOperation(event.target.value)}
              className="h-9 rounded-sm border bg-background px-3 text-sm"
            >
              <option value="all">Todas</option>
              <option value="saida">Saída</option>
              <option value="entrada">Entrada</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Status">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-9 rounded-sm border bg-background px-3 text-sm"
            >
              <option value="all">Todos</option>
              <option value="emitida">Emitida</option>
              <option value="pendente">Pendente</option>
              <option value="paga">Paga</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </FieldLabel>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                {fiscalHeaders.map(({ key, label, align }) => (
                  <SortableTableHeader
                    key={key}
                    label={label}
                    align={align}
                    active={tableSort.key === key}
                    direction={tableSort.direction}
                    onSort={() => {
                      setSortingApplied(true);
                      setTableSort((current) => nextFiscalSort(current, key));
                    }}
                  />
                ))}
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <EmptyRow colSpan={9} label="Nenhuma nota fiscal encontrada." />
              )}
              {sortedRows.map(({ document, party, businessUnit }) => (
                <tr key={document.id} className="border-t align-top hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">Nº {document.fiscal_number || "—"}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Série {document.series || "001"} · {noteType(document.note_type)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${document.operation_type === "saida" ? "text-positive" : "text-destructive"}`}
                    >
                      {document.operation_type === "saida" ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      )}
                      {document.operation_type === "saida" ? "Saída" : "Entrada"}
                    </span>
                  </td>
                  <td className="max-w-64 px-4 py-3">
                    <p className="font-medium">
                      {document.recipient_name || party?.trade_name || party?.legal_name || "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {document.recipient_tax_id || "Documento não informado"}
                    </p>
                  </td>
                  <td className="px-4 py-3">{businessUnit?.name || "—"}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs ${document.operation_type === "saida" ? "text-positive" : "text-destructive"}`}
                  >
                    {money(
                      document.operation_type === "saida"
                        ? Number(document.net_amount)
                        : -Number(document.net_amount),
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {document.issued_at
                      ? new Intl.DateTimeFormat("pt-BR").format(new Date(document.issued_at))
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={statusLabel(document.workflow_status)} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {document.pdf_object_key ? "Disponível" : "Não anexado"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActionsMenu
                      onView={() => setSelected(document)}
                      onEdit={() => setSelected(document)}
                      editDisabled
                      onDelete={() => setPendingDelete(document)}
                      deleteDisabled={document.status !== "draft"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <FiscalFormDialog open={createOpen} data={data} onClose={() => setCreateOpen(false)} />
      <FiscalDetailsDialog document={selected} data={data} onClose={() => setSelected(null)} />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir nota fiscal</DialogTitle>
            <DialogDescription>
              Somente registros em rascunho podem ser excluídos. A confirmação remove a nota e seus
              itens.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Nota Nº {pendingDelete?.fiscal_number}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Série {pendingDelete?.series || "001"}
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FiscalDetailsDialog({
  document,
  data,
  onClose,
}: {
  document: FiscalDocument | null;
  data: FiscalDirectory;
  onClose: () => void;
}) {
  if (!document) return null;
  const items = data.fiscalDocumentItems.filter(
    (item: { fiscal_document_id: string }) => item.fiscal_document_id === document.id,
  );
  const fields = [
    ["Número", document.fiscal_number],
    ["Série", document.series || "001"],
    ["Tipo", noteType(document.note_type)],
    ["Operação", document.operation_type === "saida" ? "Saída" : "Entrada"],
    ["Natureza da operação", document.operation_nature || "—"],
    ["CFOP", document.cfop || "—"],
    ["Código de serviço", document.service_code || "—"],
    ["Município IBGE", document.municipality_code || "—"],
    ["Razão social / Nome", document.recipient_name || "—"],
    ["CNPJ / CPF", document.recipient_tax_id || "—"],
    ["Inscrição Estadual", document.recipient_state_registration || "—"],
    ["Inscrição Municipal", document.recipient_municipal_registration || "—"],
    ["E-mail", document.recipient_email || "—"],
    ["Endereço", document.recipient_address || "—"],
    [
      "Cidade / UF",
      [document.recipient_city, document.recipient_state].filter(Boolean).join("/") || "—",
    ],
    ["CEP", document.recipient_postal_code || "—"],
    ["Valor dos serviços", money(Number(document.service_amount))],
    ["Deduções", money(Number(document.deductions_amount))],
    ["Base de cálculo", money(Number(document.calculation_base))],
    ["ISS", `${Number(document.iss_rate).toFixed(2)}% · ${money(Number(document.iss_amount))}`],
    ["PIS", money(Number(document.pis_amount))],
    ["COFINS", money(Number(document.cofins_amount))],
    ["IRRF", money(Number(document.irrf_amount))],
    ["CSLL", money(Number(document.csll_amount))],
    ["INSS", money(Number(document.inss_amount))],
    ["Valor líquido", money(Number(document.net_amount))],
    ["Forma de pagamento", document.payment_method || "—"],
    ["Condição", document.payment_terms || "—"],
    ["Vencimento", document.due_date || "—"],
    ["Observações", document.notes || "—"],
  ];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Nota Fiscal Nº {document.fiscal_number}/{document.series || "001"}
          </DialogTitle>
          <DialogDescription>
            Dados completos do registro fiscal e dos itens vinculados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-sm border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 break-words text-sm">{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-sm border">
          <div className="border-b px-4 py-3 font-medium">Itens da nota</div>
          <div className="divide-y">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum item registrado.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="grid gap-2 p-4 text-sm sm:grid-cols-4">
                  <span className="sm:col-span-2">{item.description}</span>
                  <span>
                    {item.quantity} × {money(Number(item.unit_amount))}
                  </span>
                  <span className="text-right font-mono">{money(Number(item.total_amount))}</span>
                </div>
              ))
            )}
          </div>
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
function Metric({
  label,
  value,
  positive = false,
  negative = false,
  warning = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-2 font-mono text-2xl font-semibold ${positive ? "text-positive" : negative ? "text-destructive" : warning ? "text-warning" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function noteType(value: string) {
  return ({ nfse: "NFS-e", nfe: "NF-e", nfce: "NFC-e" } as Record<string, string>)[value] ?? value;
}
function statusLabel(value: string) {
  return (
    (
      { emitida: "Emitida", pendente: "Pendente", paga: "Paga", cancelada: "Cancelada" } as Record<
        string,
        string
      >
    )[value] ?? value
  );
}
function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
}
