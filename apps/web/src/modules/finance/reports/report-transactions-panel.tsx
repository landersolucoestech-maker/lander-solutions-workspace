import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { EmptyRow, Panel, StatusPill, UnitTag } from "@/shared/components/ui-kit";
import { useWorkspace } from "@/app/providers/workspace-context";
import { listFinancialCategories } from "@/modules/finance/accounting";
import { listBusinessUnits } from "@/modules/company/organizational-structure/business-units";
import { listPartyLookups } from "@/modules/parties";
import { listFinancialDocuments } from "@/modules/finance/transactions";

export function ReportTransactionsPanel() {
  const { unit, period } = useWorkspace();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [nature, setNature] = useState("all");
  const [status, setStatus] = useState("all");

  const directoryQuery = useQuery({
    queryKey: ["financial-directory"],
    queryFn: async () => {
      const [documents, parties] = await Promise.all([
        listFinancialDocuments(),
        listPartyLookups(),
      ]);
      return { documents, parties };
    },
  });
  const structureQuery = useQuery({
    queryKey: ["transaction-reference-data"],
    queryFn: async () => {
      const [businessUnits, categories] = await Promise.all([
        listBusinessUnits(),
        listFinancialCategories(),
      ]);
      return { businessUnits, categories };
    },
  });
  const directory = directoryQuery.data;
  const structure = structureQuery.data;

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
        (directory?.parties ?? []).map((item) => [
          item.id,
          item.trade_name?.trim() || item.legal_name,
        ]),
      ),
    [directory?.parties],
  );

  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (directory?.documents ?? []).filter((document) => {
      const businessUnit = unitById.get(document.business_unit_id);
      const category = document.category_id ? categoryById.get(document.category_id) : null;
      const party = partyById.get(document.party_id) ?? "";
      return (
        document.competence_date.startsWith(period) &&
        (unit === "TODAS" || businessUnit?.code === unit) &&
        (categoryId === "all" || document.category_id === categoryId) &&
        (nature === "all" || document.document_nature === nature) &&
        (status === "all" || document.status === status) &&
        (!normalized ||
          `${document.document_number} ${document.description} ${party} ${businessUnit?.name ?? ""} ${category?.name ?? ""}`
            .toLowerCase()
            .includes(normalized))
      );
    });
  }, [
    categoryById,
    categoryId,
    directory?.documents,
    nature,
    partyById,
    period,
    search,
    status,
    unit,
    unitById,
  ]);

  if (directoryQuery.isLoading || structureQuery.isLoading) {
    return (
      <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando base do relatório…
      </div>
    );
  }

  if (directoryQuery.error || structureQuery.error || !directory || !structure) {
    return (
      <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {directoryQuery.error instanceof Error
          ? directoryQuery.error.message
          : structureQuery.error instanceof Error
            ? structureQuery.error.message
            : "Falha ao carregar a base detalhada do relatório."}
      </div>
    );
  }

  function exportFilteredCsv() {
    const header = [
      "competencia",
      "documento",
      "descricao",
      "contato",
      "unidade",
      "categoria",
      "tipo",
      "status",
      "moeda",
      "valor_original",
      "valor_brl",
      "vencimento",
    ];
    const content = [
      header.join(";"),
      ...rows.map((document) => {
        const businessUnit = unitById.get(document.business_unit_id);
        const category = document.category_id ? categoryById.get(document.category_id) : null;
        return [
          document.competence_date,
          csv(document.document_number),
          csv(document.description),
          csv(partyById.get(document.party_id) ?? ""),
          csv(businessUnit?.code ?? "CORPORATIVO"),
          csv(category?.name ?? "Sem categoria"),
          document.document_nature === "receivable" ? "receita" : "despesa",
          document.status,
          document.original_currency_code,
          Number(document.original_amount).toFixed(2),
          Number(document.functional_amount).toFixed(2),
          document.due_date,
        ].join(";");
      }),
    ].join("\n");
    const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transacoes-filtradas-${period}-${unit.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} registros filtrados exportados.`);
  }

  return (
    <Panel
      title="Base detalhada do relatório"
      description="Os filtros abaixo são aplicados à exportação. O período e a unidade seguem o seletor global do sistema."
      actions={
        <Button variant="outline" onClick={exportFilteredCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Exportar dados filtrados
        </Button>
      }
    >
      <div className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar na base"
            className="h-9 rounded-sm pl-9"
          />
        </div>
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="h-9 rounded-sm border bg-background px-3 text-sm"
        >
          <option value="all">Todas as categorias</option>
          {structure.categories
            .filter((item) => item.status === "active")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <select
          value={nature}
          onChange={(event) => setNature(event.target.value)}
          className="h-9 rounded-sm border bg-background px-3 text-sm"
        >
          <option value="all">Receitas e despesas</option>
          <option value="receivable">Receitas</option>
          <option value="payable">Despesas</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-9 rounded-sm border bg-background px-3 text-sm"
        >
          <option value="all">Todas as situações</option>
          <option value="draft">Rascunho</option>
          <option value="pending_approval">Aguardando aprovação</option>
          <option value="approved">Aprovado</option>
          <option value="issued">Emitido</option>
          <option value="partially_settled">Parcialmente liquidado</option>
          <option value="settled">Liquidado</option>
          <option value="overdue">Vencido</option>
          <option value="in_dispute">Em contestação</option>
          <option value="cancelled">Cancelado</option>
          <option value="reversed">Estornado</option>
        </select>
        <div className="flex h-9 items-center rounded-sm border bg-muted/20 px-3 text-sm text-muted-foreground">
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-muted/60">
            <tr className="label-caps">
              <th className="px-4 py-3 text-left">Competência</th>
              <th className="px-4 py-3 text-left">Transação</th>
              <th className="px-4 py-3 text-left">Contato</th>
              <th className="px-4 py-3 text-left">Unidade</th>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Situação</th>
              <th className="px-4 py-3 text-right">Valor BRL</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={8} label="Nenhuma transação corresponde aos filtros." />
            )}
            {rows.map((document) => {
              const businessUnit = unitById.get(document.business_unit_id);
              const category = document.category_id ? categoryById.get(document.category_id) : null;
              return (
                <tr key={document.id} className="border-t align-top">
                  <td className="px-4 py-3 font-mono text-xs">{date(document.competence_date)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{document.description}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {document.document_number}
                    </p>
                  </td>
                  <td className="px-4 py-3">{partyById.get(document.party_id) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <UnitTag>{businessUnit?.code ?? "CORPORATIVO"}</UnitTag>
                  </td>
                  <td className="px-4 py-3">{category?.name ?? "Sem categoria"}</td>
                  <td className="px-4 py-3">
                    <StatusPill
                      status={document.document_nature === "receivable" ? "Receita" : "Despesa"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={statusLabel(document.status)} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {money(Number(document.functional_amount))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function csv(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    pending_approval: "Aguardando aprovação",
    approved: "Aprovado",
    issued: "Emitido",
    partially_settled: "Parcialmente liquidado",
    settled: "Liquidado",
    overdue: "Vencido",
    in_dispute: "Em contestação",
    cancelled: "Cancelado",
    reversed: "Estornado",
  };
  return labels[value] ?? value;
}
