import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  FileText,
  GitBranch,
  Landmark,
  ReceiptText,
  Scale,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { EmptyRow, Panel, StatusPill } from "@/shared/components/ui-kit";
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
      <div className="m-6 rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Não foi possível carregar o dashboard</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {query.error instanceof Error
                ? query.error.message
                : "Falha ao carregar os dados consolidados da Lander Solutions."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (query.isLoading || !query.data) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando visão executiva...</p>;
  }

  const data = query.data;
  const directExpense = data.summary.directOperatingExpense + data.summary.deductions;
  const totalOperatingCost =
    data.summary.taxExpense + directExpense + data.summary.allocatedExpense;
  const rankedUnits = data.units.filter(
    (unit) => unit.revenue !== 0 || unit.finalResult !== 0 || unit.allocations !== 0,
  );
  const positiveUnits = rankedUnits.filter((unit) => unit.finalResult >= 0).length;
  const pendingObligations =
    data.payables.open + (data.payouts.available ? data.payouts.pending : 0);
  const totalFlow = Math.max(data.summary.revenue, 1);
  const taxShare = Math.min((data.summary.taxExpense / totalFlow) * 100, 100);
  const directShare = Math.min((directExpense / totalFlow) * 100, 100);
  const allocationShare = Math.min((data.summary.allocatedExpense / totalFlow) * 100, 100);
  const participationShare = Math.min((data.summary.participationExpense / totalFlow) * 100, 100);

  return (
    <div className="space-y-5 pb-8">
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicadores executivos"
      >
        <ExecutiveCard
          title="Faturamento do mês"
          value={money(data.summary.revenue)}
          helper="Receita bruta reconhecida"
          icon={CircleDollarSign}
        />
        <ExecutiveCard
          title="Custos + impostos"
          value={money(totalOperatingCost)}
          helper={`${percent((totalOperatingCost / totalFlow) * 100)} do faturamento`}
          icon={ReceiptText}
        />
        <ExecutiveCard
          title="Resultado distribuível"
          value={money(data.summary.finalResult)}
          helper={`Margem consolidada ${percent(data.summary.marginPercent)}`}
          icon={BarChart3}
          tone={data.summary.finalResult >= 0 ? "positive" : "negative"}
        />
        <ExecutiveCard
          title="Obrigações pendentes"
          value={money(pendingObligations)}
          helper="Contas a pagar + repasses pendentes"
          icon={WalletCards}
          tone={pendingObligations > 0 ? "warning" : "neutral"}
        />
      </section>

      <div className="grid gap-4 2xl:grid-cols-[1.45fr_0.85fr]">
        <Panel
          title="Fluxo financeiro e apuração do resultado"
          description="Da receita bruta ao resultado líquido distribuível, seguindo a lógica econômica central da Lander Solutions."
        >
          <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
            <FlowStep label="Faturamento bruto" value={data.summary.revenue} sign="+" />
            <FlowStep label="Impostos" value={data.summary.taxExpense} sign="−" />
            <FlowStep label="Custos e despesas diretas" value={directExpense} sign="−" />
            <FlowStep
              label="Despesas compartilhadas / rateadas"
              value={data.summary.allocatedExpense}
              sign="−"
            />
            <FlowStep
              label="Participações destinadas"
              value={data.summary.participationExpense}
              sign="−"
            />
            <FlowStep
              label="Resultado líquido distribuível"
              value={data.summary.finalResult}
              sign="="
              emphasized
            />
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            Resultado antes das participações:{" "}
            <strong>{money(data.summary.resultBeforeParticipations)}</strong>. Resultado final:{" "}
            <strong>{money(data.summary.finalResult)}</strong>.
          </div>
        </Panel>

        <Panel
          title="Composição do faturamento"
          description="Participação relativa dos principais componentes que consomem a receita da competência."
        >
          <div className="grid gap-5 p-4 sm:grid-cols-[160px_1fr] sm:items-center">
            <div
              className="mx-auto flex h-36 w-36 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(hsl(var(--destructive)) 0 ${taxShare}%, hsl(var(--muted-foreground)) ${taxShare}% ${taxShare + directShare}%, hsl(var(--primary)) ${taxShare + directShare}% ${taxShare + directShare + allocationShare}%, hsl(var(--ring)) ${taxShare + directShare + allocationShare}% ${taxShare + directShare + allocationShare + participationShare}%, hsl(var(--muted)) ${taxShare + directShare + allocationShare + participationShare}% 100%)`,
              }}
              aria-label="Gráfico de composição do faturamento"
            >
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-card text-center shadow-sm">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Resultado
                </span>
                <strong className="mt-1 text-sm">{money(data.summary.finalResult)}</strong>
              </div>
            </div>
            <div className="space-y-3 text-xs">
              <LegendRow label="Impostos" value={data.summary.taxExpense} />
              <LegendRow label="Diretos e deduções" value={directExpense} />
              <LegendRow label="Rateios" value={data.summary.allocatedExpense} />
              <LegendRow label="Participações" value={data.summary.participationExpense} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Financeiro"
          description="Posição de recebimentos, pagamentos e caixa operacional."
        >
          <div className="grid grid-cols-2">
            <SmallMetric label="Contas a receber" value={money(data.receivables.open)} />
            <SmallMetric
              label="Recebíveis vencidos"
              value={money(data.receivables.overdue)}
              warning={data.receivables.overdue > 0}
            />
            <SmallMetric label="Contas a pagar" value={money(data.payables.open)} />
            <SmallMetric
              label="Pagamentos vencidos"
              value={money(data.payables.overdue)}
              warning={data.payables.overdue > 0}
            />
          </div>
          <PanelLink to="/transacoes" label="Abrir financeiro" />
        </Panel>

        <Panel
          title="Participações e repasses"
          description="Acompanhamento do valor destinado aos participantes por unidade."
        >
          {data.payouts.available ? (
            <div className="grid grid-cols-2">
              <SmallMetric label="Repasses devidos" value={money(data.payouts.due)} />
              <SmallMetric label="Pagos" value={money(data.payouts.paid)} />
              <SmallMetric
                label="Pendentes"
                value={money(data.payouts.pending)}
                warning={data.payouts.pending > 0}
              />
              <SmallMetric
                label="Vencidos"
                value={money(data.payouts.overdue)}
                warning={data.payouts.overdue > 0}
              />
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Dados de repasses indisponíveis neste ambiente.
            </p>
          )}
          <PanelLink to="/repasses" label="Abrir repasses" />
        </Panel>

        <Panel
          title="Contratos"
          description="Situação dos instrumentos ativos e próximos vencimentos."
        >
          <div className="grid grid-cols-3">
            <SmallMetric label="Vigentes" value={String(data.contracts.active)} />
            <SmallMetric
              label="Aguardando ação"
              value={String(data.contracts.awaitingAction)}
              warning={data.contracts.awaitingAction > 0}
            />
            <SmallMetric
              label="Vencem em 90 dias"
              value={String(data.contracts.endingSoon)}
              warning={data.contracts.endingSoon > 0}
            />
          </div>
          <PanelLink to="/contratos" label="Abrir contratos" />
        </Panel>
      </div>

      <Panel
        title="Resultado por Produto / SaaS / Projeto"
        description="Cada unidade econômica mostra o que faturou, seus custos, rateios, participações e o resultado final da competência."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to="/unidades">Ver todas as unidades</Link>
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Unidade econômica</th>
                <th className="px-3 py-3 text-right font-medium">Receita</th>
                <th className="px-3 py-3 text-right font-medium">Impostos</th>
                <th className="px-3 py-3 text-right font-medium">Diretos</th>
                <th className="px-3 py-3 text-right font-medium">Rateios</th>
                <th className="px-3 py-3 text-right font-medium">Participações</th>
                <th className="px-3 py-3 text-right font-medium">Resultado</th>
                <th className="px-3 py-3 text-right font-medium">Margem</th>
                <th className="px-4 py-3 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rankedUnits.length === 0 && (
                <EmptyRow colSpan={9} label="Nenhuma movimentação econômica nesta competência." />
              )}
              {rankedUnits.map((unit) => (
                <tr key={unit.id} className={unit.finalResult < 0 ? "bg-destructive/5" : ""}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{unit.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {unit.code}
                    </p>
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
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid border-t sm:grid-cols-3">
          <SmallMetric label="Unidades com movimento" value={String(rankedUnits.length)} />
          <SmallMetric label="Resultado positivo" value={String(positiveUnits)} />
          <SmallMetric
            label="Resultado negativo"
            value={String(Math.max(rankedUnits.length - positiveUnits, 0))}
            warning={rankedUnits.length - positiveUnits > 0}
          />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Custos compartilhados e rateios"
          description="Despesas corporativas pagas uma vez e alocadas entre unidades para apuração real de resultado."
        >
          <div className="p-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <GitBranch className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Total rateado na competência</p>
                <p className="mt-1 text-lg font-semibold">{money(data.summary.allocatedExpense)}</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to="/rateio">Detalhar</Link>
              </Button>
            </div>
          </div>
        </Panel>

        <Panel
          title="Itens que exigem atenção"
          description="Pendências financeiras e contratuais que precisam de acompanhamento."
        >
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
            {data.renewals.slice(0, 3).map((renewal) => (
              <div key={renewal.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{renewal.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {renewal.businessUnitName} · vence em {localDate(renewal.endsOn)}
                  </p>
                </div>
                <StatusPill status={renewal.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Atalhos do Business OS"
      >
        <BusinessShortcut
          title="Empresa"
          description="Estrutura, usuários e governança corporativa"
          icon={Landmark}
          to="/estrutura-organizacional"
        />
        <BusinessShortcut
          title="Comercial e contratos"
          description="Clientes, oportunidades e instrumentos"
          icon={FileText}
          to="/crm"
        />
        <BusinessShortcut
          title="Financeiro e fiscal"
          description="Transações, contabilidade e notas fiscais"
          icon={WalletCards}
          to="/transacoes"
        />
        <BusinessShortcut
          title="Participações e repasses"
          description="Apuração, distribuição e pagamentos"
          icon={Scale}
          to="/participacoes"
        />
      </section>

      {data.recurring.nonBrlContracts > 0 && (
        <p className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          {data.recurring.nonBrlContracts} contrato(s) recorrente(s) em moeda diferente de BRL não
          foram convertidos porque não existe taxa cambial registrada.
        </p>
      )}
    </div>
  );
}

function ExecutiveCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof CircleDollarSign;
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-destructive"
        : tone === "warning"
          ? "text-amber-600"
          : "text-foreground";
  return (
    <article className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className={`mt-2 text-xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </article>
  );
}

function FlowStep({
  label,
  value,
  sign,
  emphasized = false,
}: {
  label: string;
  value: number;
  sign: "+" | "−" | "=";
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${emphasized ? "border-positive/30 bg-positive/5" : "bg-card"}`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${emphasized ? "bg-positive/15 text-positive" : "bg-muted text-muted-foreground"}`}
        >
          {sign}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={`mt-1 font-mono text-sm font-semibold ${emphasized ? (value >= 0 ? "text-positive" : "text-destructive") : ""}`}
          >
            {money(value)}
          </p>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <strong className="font-mono font-medium">{money(value)}</strong>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0 border-r border-b px-4 py-3 last:border-r-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 truncate font-mono text-sm font-semibold ${warning ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function PanelLink({ to, label }: { to: string; label: string }) {
  return (
    <div className="border-t px-4 py-2.5">
      <Button size="sm" variant="ghost" className="px-0" asChild>
        <Link to={to}>
          {label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function BusinessShortcut({
  title,
  description,
  icon: Icon,
  to,
}: {
  title: string;
  description: string;
  icon: typeof Landmark;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
            Abrir{" "}
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function EconomicCell({ value, result = false }: { value: number; result?: boolean }) {
  return (
    <td
      className={`px-3 py-3 text-right font-mono text-xs ${result ? (value >= 0 ? "font-semibold text-positive" : "font-semibold text-destructive") : ""}`}
    >
      {money(value)}
    </td>
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
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`font-mono text-xs font-semibold ${warning ? "text-destructive" : "text-muted-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}
