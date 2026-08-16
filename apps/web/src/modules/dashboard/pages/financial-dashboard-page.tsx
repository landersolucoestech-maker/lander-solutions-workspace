import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ExternalLink, Trophy, TriangleAlert } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { EmptyRow, Kpi, MoneyKpi, Panel, StatusPill } from "@/shared/components/ui-kit";
import { loadDashboardData } from "../api";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
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

export function FinancialDashboardPage() {
  const period = new Date().toISOString().slice(0, 7);
  const query = useQuery({
    queryKey: ["financial-dashboard", "TODAS", period],
    queryFn: () => loadDashboardData({ unitCode: "TODAS", period }),
  });

  if (query.error) {
    return (
      <p className="m-6 rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {query.error instanceof Error
          ? query.error.message
          : "Falha ao carregar os dados financeiros."}
      </p>
    );
  }

  if (query.isLoading || !query.data) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando dashboard...</p>;
  }

  const data = query.data;
  const rankedUnits = data.units.filter(
    (unit) => unit.revenue !== 0 || unit.finalResult !== 0 || unit.allocations !== 0,
  );
  const highestRevenue = rankedUnits.reduce(
    (winner, unit) => (!winner || unit.revenue > winner.revenue ? unit : winner),
    rankedUnits[0],
  );
  const highestResult = rankedUnits.reduce(
    (winner, unit) => (!winner || unit.finalResult > winner.finalResult ? unit : winner),
    rankedUnits[0],
  );

  return (
    <div className="space-y-4">
      <section aria-labelledby="general-result-title" className="space-y-3">
        <div>
          <h2 id="general-result-title" className="text-base font-semibold">
            Resultado geral da LANDER
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Competência {period.slice(5, 7)}/{period.slice(0, 4)} · valores reconhecidos no razão
            gerencial.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MoneyKpi label="Receita" brl={data.summary.revenue} hint="Receita bruta reconhecida" />
          <MoneyKpi label="Impostos" brl={data.summary.taxExpense} hint="Impostos sobre receita" />
          <MoneyKpi
            label="Custos e despesas diretas"
            brl={data.summary.directOperatingExpense + data.summary.deductions}
            hint="Inclui deduções, custos e taxas"
          />
          <MoneyKpi
            label="Rateios"
            brl={data.summary.allocatedExpense}
            hint="Despesas compartilhadas alocadas"
          />
          <MoneyKpi
            label="Participações destinadas"
            brl={data.summary.participationExpense}
            hint="Participações reconhecidas na competência"
          />
          <MoneyKpi
            label="Resultado final da LANDER"
            brl={data.summary.finalResult}
            hint={`Após participações · margem ${percent(data.summary.marginPercent)}`}
            tone={data.summary.finalResult >= 0 ? "positive" : "negative"}
          />
        </div>

        <Panel
          title="Composição do resultado"
          description="A sequência abaixo usa as mesmas classificações reconciliadas em Contabilidade e Relatórios."
        >
          <div className="overflow-x-auto">
            <div className="flex min-w-[900px] items-stretch divide-x">
              <ResultStep label="Receita" value={data.summary.revenue} />
              <ResultOperator />
              <ResultStep label="Impostos" value={data.summary.taxExpense} />
              <ResultOperator />
              <ResultStep
                label="Despesas diretas"
                value={data.summary.directOperatingExpense + data.summary.deductions}
              />
              <ResultOperator />
              <ResultStep label="Rateios" value={data.summary.allocatedExpense} />
              <ResultOperator />
              <ResultStep label="Participações" value={data.summary.participationExpense} />
              <div className="flex w-14 shrink-0 items-center justify-center text-lg font-semibold">
                =
              </div>
              <ResultStep
                label="Resultado final"
                value={data.summary.finalResult}
                emphasized
                positive={data.summary.finalResult >= 0}
              />
            </div>
          </div>
          <div className="border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
            Resultado antes das participações: {money(data.summary.resultBeforeParticipations)}.
            Resultado final após participações: {money(data.summary.finalResult)}.
          </div>
        </Panel>
      </section>

      <Panel
        title="Desempenho por unidade"
        description="Receita, custos e resultado final por unidade vinculada aos lançamentos da competência."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to="/unidades">
              Ver unidades <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Unidade</th>
                <th className="px-3 py-2.5 text-right font-medium">Receita</th>
                <th className="px-3 py-2.5 text-right font-medium">Impostos</th>
                <th className="px-3 py-2.5 text-right font-medium">Despesas diretas</th>
                <th className="px-3 py-2.5 text-right font-medium">Rateios</th>
                <th className="px-3 py-2.5 text-right font-medium">Participações</th>
                <th className="px-3 py-2.5 text-right font-medium">Resultado final</th>
                <th className="px-3 py-2.5 text-right font-medium">Margem</th>
                <th className="px-4 py-2.5 text-right font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rankedUnits.length === 0 && (
                <EmptyRow
                  colSpan={9}
                  label="Não há movimento econômico por unidade nesta competência."
                />
              )}
              {rankedUnits.map((unit) => {
                const bestRevenue = highestRevenue?.id === unit.id;
                const bestResult = highestResult?.id === unit.id;
                return (
                  <tr key={unit.id} className={unit.finalResult < 0 ? "bg-destructive/5" : ""}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0">
                          <span>{unit.name}</span>
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {unit.code}
                          </span>
                        </div>
                        {(bestRevenue || bestResult) && (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-positive/10 px-1.5 py-0.5 text-[10px] text-positive"
                            title={bestRevenue ? "Maior receita" : "Melhor resultado"}
                          >
                            <Trophy className="h-3 w-3" />
                            {bestRevenue && bestResult
                              ? "Maior receita e resultado"
                              : bestRevenue
                                ? "Maior receita"
                                : "Melhor resultado"}
                          </span>
                        )}
                      </div>
                    </td>
                    <EconomicCell value={unit.revenue} />
                    <EconomicCell value={unit.taxes} />
                    <EconomicCell value={unit.directExpenses + unit.deductions} />
                    <EconomicCell value={unit.allocations} />
                    <EconomicCell value={unit.participations} />
                    <EconomicCell value={unit.finalResult} result />
                    <td className="px-3 py-3 text-right font-mono text-xs">
                      {percent(unit.marginPercent)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {unit.id === "corporate-unassigned" ? (
                        <span className="text-xs text-muted-foreground">Corporativo</span>
                      ) : (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/unidades/$unitId" params={{ unitId: unit.id }}>
                            Abrir
                          </Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Obrigações e repasses"
          description="Valores a receber, a pagar e obrigações destinadas aos participantes."
        >
          <div className="grid sm:grid-cols-2">
            <CompactMetric
              label="Contas a receber"
              value={money(data.receivables.open)}
              hint={`${money(data.receivables.overdue)} vencidos`}
              warning={data.receivables.overdue > 0}
            />
            <CompactMetric
              label="Contas a pagar"
              value={money(data.payables.open)}
              hint={`${money(data.payables.overdue)} vencidos`}
              warning={data.payables.overdue > 0}
            />
          </div>
          {data.payouts.available ? (
            <div className="grid border-t sm:grid-cols-4">
              <CompactMetric label="Repasses devidos" value={money(data.payouts.due)} />
              <CompactMetric label="Pagos" value={money(data.payouts.paid)} />
              <CompactMetric label="Pendentes" value={money(data.payouts.pending)} />
              <CompactMetric
                label="Vencidos"
                value={money(data.payouts.overdue)}
                warning={data.payouts.overdue > 0}
              />
            </div>
          ) : (
            <div className="border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              Dados de repasses indisponíveis neste ambiente sem sessão autorizada.
            </div>
          )}
        </Panel>

        <Panel
          title="Contratos e itens que exigem atenção"
          description="Sinais executivos consumidos do módulo de Contratos e das obrigações financeiras."
        >
          <div className="grid grid-cols-3 border-b">
            <CompactMetric label="Vigentes" value={String(data.contracts.active)} />
            <CompactMetric label="Aguardando ação" value={String(data.contracts.awaitingAction)} />
            <CompactMetric label="Vencem em 90 dias" value={String(data.contracts.endingSoon)} />
          </div>
          <div className="divide-y">
            <AttentionRow
              label="Recebíveis vencidos"
              value={money(data.receivables.overdue)}
              warning={data.receivables.overdue > 0}
            />
            <AttentionRow
              label="Pagamentos vencidos"
              value={money(data.payables.overdue)}
              warning={data.payables.overdue > 0}
            />
            <AttentionRow
              label="Pagamentos aguardando aprovação"
              value={money(data.payables.pendingApproval)}
              warning={data.payables.pendingApproval > 0}
            />
            {data.renewals.length === 0 && (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                Nenhum contrato vigente vence nos 90 dias posteriores à competência.
              </p>
            )}
            {data.renewals.map((renewal) => (
              <div key={renewal.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{renewal.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {renewal.code} · {renewal.businessUnitName} · vence em{" "}
                      {localDate(renewal.endsOn)}
                    </p>
                  </div>
                  <StatusPill status={renewal.status} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {data.recurring.nonBrlContracts > 0 && (
        <p className="rounded-sm border bg-muted/20 p-3 text-xs text-muted-foreground">
          {data.recurring.nonBrlContracts} contrato(s) recorrente(s) em moeda diferente de BRL não
          foram convertidos, pois não existe taxa cambial registrada.
        </p>
      )}
    </div>
  );
}

function ResultStep({
  label,
  value,
  emphasized = false,
  positive = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
  positive?: boolean;
}) {
  return (
    <div className={`min-w-0 flex-1 px-4 py-4 ${emphasized ? "bg-positive/5" : ""}`}>
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={`mt-1 whitespace-nowrap font-mono text-sm font-semibold ${
          emphasized ? (positive ? "text-positive" : "text-destructive") : ""
        }`}
      >
        {money(value)}
      </p>
    </div>
  );
}

function ResultOperator() {
  return (
    <div
      className="flex w-9 shrink-0 items-center justify-center text-muted-foreground"
      aria-hidden
    >
      <span className="hidden text-lg sm:inline">−</span>
      <ArrowDown className="h-4 w-4 sm:hidden" />
    </div>
  );
}

function EconomicCell({ value, result = false }: { value: number; result?: boolean }) {
  return (
    <td
      className={`px-3 py-3 text-right font-mono text-xs ${
        result
          ? value >= 0
            ? "font-semibold text-positive"
            : "font-semibold text-destructive"
          : ""
      }`}
    >
      {money(value)}
    </td>
  );
}

function CompactMetric({
  label,
  value,
  hint,
  warning = false,
}: {
  label: string;
  value: string;
  hint?: string;
  warning?: boolean;
}) {
  return (
    <div className="border-r border-b px-4 py-3 last:border-r-0">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={`mt-1 font-mono text-sm font-semibold ${warning ? "text-destructive" : ""}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AttentionRow({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="flex items-center gap-2 text-sm">
        {warning && <TriangleAlert className="h-3.5 w-3.5 text-destructive" />}
        {label}
      </span>
      <span className={`font-mono text-xs font-medium ${warning ? "text-destructive" : ""}`}>
        {value}
      </span>
    </div>
  );
}
