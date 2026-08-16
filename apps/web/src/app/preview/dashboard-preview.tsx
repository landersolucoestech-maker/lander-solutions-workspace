import { useMemo, useState } from "react";
import { Eye, Filter, MoreHorizontal, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { StatusPill } from "@/shared/components/ui-kit";

const KPI_ITEMS = [
  { label: "Faturamento bruto", value: "R$ 184.920", hint: "+12,4% no mês" },
  { label: "Custos e impostos", value: "R$ 71.480", hint: "38,7% do faturamento" },
  { label: "Resultado distribuível", value: "R$ 113.440", hint: "61,3% de margem" },
  { label: "Repasses pendentes", value: "R$ 28.360", hint: "3 obrigações" },
];

const COLUMNS = ["Unidade", "Receita", "Custos", "Resultado", "Margem", "Status"];

const INITIAL_ROWS = [
  ["Music OS 360", "R$ 82.400", "R$ 28.100", "R$ 54.300", "65,9%", "Saudável"],
  ["Vivendo da Música", "R$ 61.780", "R$ 22.430", "R$ 39.350", "63,7%", "Saudável"],
  ["Corporativo", "R$ 40.740", "R$ 20.950", "R$ 19.790", "48,6%", "Atenção"],
];

export function DashboardPreview() {
  const [rows, setRows] = useState(() => INITIAL_ROWS.map((row) => [...row]));
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusOnly, setStatusOnly] = useState(false);
  const [compact, setCompact] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          !statusOnly ||
          !["inativo", "fechado", "arquivado"].includes((row.at(-1) ?? "").toLowerCase()),
      ),
    [rows, statusOnly],
  );

  return (
    <div className="space-y-5">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Visão consolidada da operação, faturamento, custos, resultado distribuível e repasses da Lander Solutions.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_ITEMS.map((item) => (
          <div key={item.label} className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
          </div>
        ))}
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span>{notice}</span>
          <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
            Fechar
          </Button>
        </div>
      )}

      <section className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground">{visibleRows.length} registro(s) nesta visão.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterOpen((value) => !value)}
            >
              <Filter className="h-4 w-4" /> Filtros
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCompact((value) => !value)}>
              <SlidersHorizontal className="h-4 w-4" /> {compact ? "Confortável" : "Compacta"}
            </Button>
          </div>
        </div>

        {filterOpen && (
          <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-4 py-3 text-sm">
            <Button
              size="sm"
              variant={statusOnly ? "default" : "outline"}
              onClick={() => setStatusOnly((value) => !value)}
            >
              Somente ativos
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStatusOnly(false)}>
              Limpar filtros
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {column}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={`${row[0]}-${index}`} className="border-t hover:bg-muted/30">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${cell}-${cellIndex}`}
                      className={`whitespace-nowrap px-4 ${compact ? "py-2" : "py-3"}`}
                    >
                      {cellIndex === row.length - 1 ? <StatusPill status={cell} /> : cell}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label={`Ações de ${row[0]}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setNotice(`${row[0]} selecionado para visualização.`)}>
                          <Eye className="h-4 w-4" /> Ver
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setNotice(`${row[0]} selecionado para edição.`)}>
                          <Pencil className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setRows((current) => current.filter((item) => item !== row));
                            setNotice(`${row[0]} arquivado na demonstração.`);
                          }}
                        >
                          <Trash2 className="h-4 w-4" /> Arquivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>Mostrando {visibleRows.length} de {rows.length}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNotice("Paginação pronta para expansão quando houver mais registros.")}
          >
            Mais registros
          </Button>
        </div>
      </section>
    </div>
  );
}
