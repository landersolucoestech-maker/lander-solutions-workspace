import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { useWorkspace } from "@/app/providers/workspace-context";
import { EmptyRow, PageHeader, Panel, StatusPill } from "@/shared/components/ui-kit";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { loadReportSnapshot } from "./api";
import { agingBucketLabel, buildReportWorkbook, reportFilename } from "./report-workbook";
import type { AgingDocumentRow, AgingSummary } from "./types";
import { downloadWorkbook } from "./xlsx-export";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function percent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(value || 0) / 100);
}

function localDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

function periodLabel(period: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${period}-01T12:00:00`));
}

function chartMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} mi`;
  if (absolute >= 1_000) return `${Math.round(value / 1_000)} mil`;
  return String(Math.round(value));
}

export function ReportsPage() {
  const { unit, period } = useWorkspace();
  const query = useQuery({
    queryKey: ["managerial-report-snapshot", unit, period],
    queryFn: () => loadReportSnapshot({ unitCode: unit, period }),
  });

  const snapshot = query.data;
  const dreChart = useMemo(
    () =>
      (snapshot?.dreRows ?? [])
        .filter((row) => row.amount !== 0)
        .map((row) => ({
          conta: `${row.accountCode} · ${row.accountName}`,
          valor: Number(row.amount.toFixed(2)),
        })),
    [snapshot?.dreRows],
  );

  function exportWorkbook() {
    if (!snapshot) return;
    try {
      downloadWorkbook(
        reportFilename(snapshot),
        buildReportWorkbook(snapshot),
        snapshot.generatedAt,
      );
      toast.success("Relatório XLSX gerado com o snapshot atual.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar o arquivo XLSX.");
    }
  }

  if (query.error) {
    return (
      <div className="space-y-4 p-6">
        <PageHeader
          title="Relatórios e BI"
          description="Não foi possível consolidar o snapshot gerencial."
        />
        <p className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "Falha ao carregar os relatórios."}
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </Button>
      </div>
    );
  }
  if (query.isLoading || !snapshot) {
    return (
      <p className="p-6 text-sm text-muted-foreground">Consolidando relatórios gerenciais...</p>
    );
  }

  const summary = snapshot.dashboard.summary;
  const economic = snapshot.unitEconomics.consolidated;
  const scopeLabel = unit === "TODAS" ? "todas as unidades" : unit;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Resultado da Lander Solutions"
        description={`Visão consolidada de ${scopeLabel} em ${periodLabel(period)}, composta somente por lançamentos postados, rateios efetivados e repasses reais. Moeda funcional: BRL.`}
        actions={
          <Button onClick={exportWorkbook}>
            <Download className="h-4 w-4" /> Exportar XLSX
          </Button>
        }
      />

      {!economic.hasFinancialData && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Sem dados econômicos na competência.</strong> As unidades estão disponíveis, mas
          não há lançamentos postados ou obrigações de repasse para compor valores reais.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <EconomicKpi
          label="Receita total"
          value={economic.revenue}
          available={economic.hasFinancialData}
        />
        <EconomicKpi
          label="Impostos"
          value={economic.taxes}
          available={economic.hasFinancialData}
        />
        <EconomicKpi
          label="Despesas e rateios"
          value={economic.directExpenses + economic.allocatedExpenses + economic.deductions}
          available={economic.hasFinancialData}
        />
        <EconomicKpi
          label="Resultado"
          value={economic.result}
          available={economic.hasFinancialData}
          tone={economic.result >= 0 ? "positive" : "negative"}
        />
        <EconomicKpi
          label="Valor Lander"
          value={economic.landerRetained}
          available={economic.hasFinancialData}
          tone={economic.landerRetained >= 0 ? "positive" : "negative"}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <EconomicKpi
          label="Repasses devidos"
          value={economic.payoutDue}
          available={economic.hasPayoutData}
        />
        <EconomicKpi
          label="Repasses pagos"
          value={economic.payoutPaid}
          available={economic.hasPayoutData}
        />
        <EconomicKpi
          label="Saldo pendente"
          value={economic.payoutPending}
          available={economic.hasPayoutData}
          tone={economic.payoutPending > 0 ? "warning" : "default"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-sm border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4" />
        <span>
          O XLSX contém resumo executivo, DRE, resultado por unidade, fluxo de caixa, contas a
          receber e contas a pagar.
        </span>
        <span className="ml-auto">
          Snapshot gerado em{" "}
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(
            new Date(snapshot.generatedAt),
          )}
        </span>
      </div>

      <Tabs defaultValue="dre" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="dre">DRE gerencial</TabsTrigger>
          <TabsTrigger value="units">Unidades</TabsTrigger>
          <TabsTrigger value="aging">Aging financeiro</TabsTrigger>
          <TabsTrigger value="cash">Fluxo de caixa</TabsTrigger>
        </TabsList>

        <TabsContent value="dre" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-5">
            <Panel
              title="DRE por conta gerencial"
              description="Valores líquidos conforme a natureza de cada conta."
              className="xl:col-span-3"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-muted/60">
                    <tr className="text-left text-xs font-semibold text-muted-foreground">
                      <th className="px-4 py-3">Conta</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3 text-right">Valor BRL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.dreRows.length === 0 && (
                      <EmptyRow colSpan={4} label="Nenhum lançamento postado na competência." />
                    )}
                    {snapshot.dreRows.map((row) => (
                      <tr key={`${row.accountCode}:${row.accountName}`} className="border-t">
                        <td className="px-4 py-3 font-mono text-xs">{row.accountCode}</td>
                        <td className="px-4 py-3">{row.accountName}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={row.accountType} />
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono text-xs ${
                            row.amount < 0 ? "text-destructive" : ""
                          }`}
                        >
                          {money(row.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-muted/30 font-semibold">
                      <td className="px-4 py-3" colSpan={3}>
                        Resultado operacional
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-xs ${
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

            <Panel
              title="Distribuição por conta"
              description="Contas com movimento na competência."
              className="xl:col-span-2"
            >
              <div className="h-[390px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dreChart} layout="vertical" margin={{ left: 18, right: 16 }}>
                    <CartesianGrid
                      horizontal={false}
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => chartMoney(Number(value))}
                    />
                    <YAxis
                      type="category"
                      dataKey="conta"
                      width={145}
                      tick={{ fontSize: 9 }}
                      tickFormatter={(value) => String(value).slice(0, 24)}
                    />
                    <Tooltip
                      formatter={(value) => money(Number(value))}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="valor" fill="var(--color-chart-1)" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="units">
          <Panel
            title="Resultado econômico por unidade"
            description="Abra uma unidade para conferir a composição, os rateios, repasses e contratos relacionados."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-muted/60">
                  <tr className="text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3 text-right">Receita</th>
                    <th className="px-4 py-3 text-right">Impostos</th>
                    <th className="px-4 py-3 text-right">Desp. diretas</th>
                    <th className="px-4 py-3 text-right">Rateios</th>
                    <th className="px-4 py-3 text-right">Resultado</th>
                    <th className="px-4 py-3 text-right">Devido</th>
                    <th className="px-4 py-3 text-right">Pago</th>
                    <th className="px-4 py-3 text-right">Pendente</th>
                    <th className="px-4 py-3 text-right">Valor Lander</th>
                    <th className="px-4 py-3 text-right">Margem</th>
                    <th className="px-4 py-3 text-right">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.unitEconomics.units.length === 0 && (
                    <EmptyRow
                      colSpan={12}
                      label="Nenhuma unidade de negócio está disponível no escopo."
                    />
                  )}
                  {snapshot.unitEconomics.units.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-3 font-medium">
                        {row.name}
                        <span className="block font-mono text-xs text-muted-foreground">
                          {row.code}
                        </span>
                      </td>
                      <EconomicCell value={row.revenue} available={row.hasFinancialData} />
                      <EconomicCell value={row.taxes} available={row.hasFinancialData} />
                      <EconomicCell
                        value={row.directExpenses + row.deductions}
                        available={row.hasFinancialData}
                      />
                      <EconomicCell
                        value={row.allocatedExpenses}
                        available={row.hasFinancialData}
                      />
                      <td
                        className={`px-4 py-3 text-right font-mono text-xs ${
                          row.result >= 0 ? "text-positive" : "text-destructive"
                        }`}
                      >
                        {row.hasFinancialData ? money(row.result) : "Não disponível"}
                      </td>
                      <EconomicCell value={row.payoutDue} available={row.hasPayoutData} />
                      <EconomicCell value={row.payoutPaid} available={row.hasPayoutData} />
                      <EconomicCell value={row.payoutPending} available={row.hasPayoutData} />
                      <EconomicCell value={row.landerRetained} available={row.hasFinancialData} />
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {row.marginPercent === null ? "Não disponível" : percent(row.marginPercent)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/unidades/$unitId" params={{ unitId: row.id }}>
                            Abrir
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="aging" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <AgingPanel
              title="Contas a receber"
              partyLabel="Cliente"
              rows={snapshot.receivableRows}
              summary={snapshot.receivableAging}
            />
            <AgingPanel
              title="Contas a pagar"
              partyLabel="Fornecedor"
              rows={snapshot.payableRows}
              summary={snapshot.payableAging}
            />
          </div>
        </TabsContent>

        <TabsContent value="cash">
          <Panel
            title="Fluxo de caixa realizado"
            description="Liquidações efetivamente postadas na competência selecionada."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-muted/60">
                  <tr className="text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Natureza</th>
                    <th className="px-4 py-3">Documento</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3">Contraparte</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3 text-right">Valor BRL</th>
                    <th className="px-4 py-3 text-right">Taxa BRL</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.cashMovements.length === 0 && (
                    <EmptyRow colSpan={8} label="Nenhuma liquidação postada na competência." />
                  )}
                  {snapshot.cashMovements.map((row) => (
                    <tr key={row.settlementId} className="border-t">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {localDate(row.settlementDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={row.nature} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{row.documentNumber}</td>
                      <td className="max-w-72 px-4 py-3">{row.description}</td>
                      <td className="px-4 py-3">{row.partyName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.unitCode}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {money(row.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {money(row.bankFee)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EconomicKpi({
  label,
  value,
  available,
  tone = "default",
}: {
  label: string;
  value: number;
  available: boolean;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-destructive"
        : tone === "warning"
          ? "text-amber-700"
          : "";
  return (
    <div className="rounded-sm border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${toneClass}`}>
        {available ? money(value) : "Não disponível"}
      </p>
    </div>
  );
}

function EconomicCell({ value, available }: { value: number; available: boolean }) {
  return (
    <td className="px-4 py-3 text-right font-mono text-xs">
      {available ? money(value) : "Não disponível"}
    </td>
  );
}

function AgingPanel({
  title,
  partyLabel,
  rows,
  summary,
}: {
  title: string;
  partyLabel: string;
  rows: AgingDocumentRow[];
  summary: AgingSummary;
}) {
  return (
    <Panel title={title} description="Saldo em aberto no encerramento da competência selecionada.">
      <div className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-3">
        <AgingMetric label="A vencer" value={summary.notDue} />
        <AgingMetric label="1–30 dias" value={summary.days1To30} warning={summary.days1To30 > 0} />
        <AgingMetric
          label="31–60 dias"
          value={summary.days31To60}
          warning={summary.days31To60 > 0}
        />
        <AgingMetric
          label="61–90 dias"
          value={summary.days61To90}
          warning={summary.days61To90 > 0}
        />
        <AgingMetric label="> 90 dias" value={summary.over90} warning={summary.over90 > 0} />
        <AgingMetric label="Total" value={summary.total} />
      </div>
      <div className="max-h-[430px] overflow-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-muted/95 backdrop-blur">
            <tr className="text-left text-xs font-semibold text-muted-foreground">
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">{partyLabel}</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Faixa</th>
              <th className="px-4 py-3 text-right">Saldo BRL</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5} label="Nenhum saldo em aberto." />}
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs">{row.documentNumber}</p>
                  <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">
                    {row.description}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p>{row.partyName}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{row.unitCode}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{localDate(row.dueDate)}</td>
                <td className="px-4 py-3">
                  <span
                    className={row.daysOverdue > 0 ? "text-destructive" : "text-muted-foreground"}
                  >
                    {agingBucketLabel(row.bucket)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">{money(row.openAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AgingMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <p className={`mt-1 font-mono text-xs font-medium ${warning ? "text-destructive" : ""}`}>
        {money(value)}
      </p>
    </div>
  );
}
