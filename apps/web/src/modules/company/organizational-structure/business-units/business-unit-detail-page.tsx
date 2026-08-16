import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Pencil, RefreshCw } from "lucide-react";

import { useWorkspace } from "@/app/providers/workspace-context";
import { loadUnitDetail } from "@/modules/finance/reports/unit-economics-queries";
import { EmptyRow, PageHeader, Panel, StatusPill } from "@/shared/components/ui-kit";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function localDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : "—";
}

function periodLabel(period: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(`${period}-01T12:00:00`),
  );
}

function percent(value: number | null) {
  return value === null ? "Não disponível" : `${value.toFixed(1)}%`;
}

export function BusinessUnitDetailPage({ unitId }: { unitId: string }) {
  const { period } = useWorkspace();
  const query = useQuery({
    queryKey: ["business-unit-detail", unitId, period],
    queryFn: () => loadUnitDetail(unitId, period),
  });

  if (query.isLoading)
    return (
      <p className="p-6 text-sm text-muted-foreground">Compondo a visão econômica da unidade…</p>
    );
  if (query.error || !query.data) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <PageHeader
          title="Unidade de Negócio"
          description="Não foi possível compor os dados desta unidade."
        />
        <p className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "Unidade indisponível."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/unidades">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Button variant="outline" onClick={() => void query.refetch()}>
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const { unit, financialMovements, allocations, participations, payouts, contracts, history } =
    query.data;
  const periodName = periodLabel(period);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/unidades">
          <ArrowLeft className="h-4 w-4" /> Produtos / Unidades
        </Link>
      </Button>

      <section className="rounded-sm border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-normal md:text-2xl">{unit.name}</h1>
              <StatusPill status={unit.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {unit.legalEntityName ?? "Entidade responsável não disponível"} · {periodName}
            </p>
            {unit.description && (
              <p className="max-w-3xl text-sm text-muted-foreground">{unit.description}</p>
            )}
          </div>
          <Button variant="outline" disabled title="Editar exige sessão autorizada">
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        </div>
      </section>

      {!unit.hasFinancialData && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Sem dados econômicos no período.</strong> A unidade existe, mas não possui
          lançamentos postados nem obrigações de repasse nesta competência. Valores não serão
          apresentados como zero operacional.
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="finance">Financeiro</TabsTrigger>
          <TabsTrigger value="allocations">Rateios</TabsTrigger>
          <TabsTrigger value="participations">Sócios / Participações</TabsTrigger>
          <TabsTrigger value="payouts">Repasses</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Receita" value={unit.revenue} available={unit.hasFinancialData} />
            <Metric label="Impostos" value={unit.taxes} available={unit.hasFinancialData} />
            <Metric
              label="Despesas diretas"
              value={unit.directExpenses + unit.deductions}
              available={unit.hasFinancialData}
            />
            <Metric
              label="Rateios"
              value={unit.allocatedExpenses}
              available={unit.hasFinancialData}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Resultado distribuível"
              value={unit.resultBeforeParticipations}
              available={unit.hasFinancialData}
              tone={unit.resultBeforeParticipations >= 0 ? "positive" : "negative"}
            />
            <Metric
              label="Participações"
              value={unit.participationExpenses}
              available={unit.hasParticipationData}
            />
            <Metric
              label="Resultado LANDER"
              value={unit.landerRetained}
              available={unit.hasFinancialData}
              tone={unit.landerRetained >= 0 ? "positive" : "negative"}
            />
            <div className="rounded-sm border bg-card p-4">
              <p className="text-xs text-muted-foreground">Margem LANDER</p>
              <p className="mt-2 text-xl font-semibold">
                {unit.hasFinancialData ? percent(unit.marginPercent) : "Não disponível"}
              </p>
            </div>
          </div>
          <Panel
            title="Como o resultado é composto"
            description="A unidade é um centro econômico; participações contratuais não são a estrutura societária da Lander Solutions."
          >
            <div className="divide-y text-sm">
              <CompositionRow
                label="Receita"
                value={unit.revenue}
                available={unit.hasFinancialData}
              />
              <CompositionRow
                label="Impostos"
                value={-unit.taxes}
                available={unit.hasFinancialData}
              />
              <CompositionRow
                label="Despesas diretas"
                value={-(unit.directExpenses + unit.deductions)}
                available={unit.hasFinancialData}
              />
              <CompositionRow
                label="Rateios"
                value={-unit.allocatedExpenses}
                available={unit.hasFinancialData}
              />
              <CompositionRow
                label="Resultado distribuível"
                value={unit.resultBeforeParticipations}
                available={unit.hasFinancialData}
                strong
              />
              <CompositionRow
                label="Participações"
                value={-unit.participationExpenses}
                available={unit.hasParticipationData}
              />
              <CompositionRow
                label="Resultado LANDER"
                value={unit.landerRetained}
                available={unit.hasFinancialData}
                strong
              />
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="finance">
          <Panel
            title={`Financeiro · ${periodName}`}
            description="Movimentos reais da competência ligados a esta unidade. A edição detalhada permanece em Transações."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3">Receita/Despesa</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Conta financeira</th>
                    <th className="px-4 py-3">Situação</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {financialMovements.length === 0 && (
                    <EmptyRow
                      colSpan={7}
                      label="Nenhum movimento financeiro postado para esta unidade no período."
                    />
                  )}
                  {financialMovements.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3">{localDate(item.date)}</td>
                      <td className="px-4 py-3 font-medium">{item.description}</td>
                      <td className="px-4 py-3">{item.nature}</td>
                      <td className="px-4 py-3">{item.category}</td>
                      <td className="px-4 py-3">{item.account}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {money(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t p-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/transacoes">
                  Ver em Transações <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="allocations">
          <Panel
            title="Despesas rateadas recebidas"
            description="Somente leitura. A operação completa continua no módulo de Rateio."
          >
            {!query.data.allocationsAvailable ? (
              <p className="p-4 text-sm text-muted-foreground">
                Detalhes de rateios indisponíveis sem sessão autorizada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Origem</th>
                      <th className="px-4 py-3">Regra</th>
                      <th className="px-4 py-3">Período</th>
                      <th className="px-4 py-3 text-right">Percentual</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.length === 0 && (
                      <EmptyRow
                        colSpan={6}
                        label="Nenhuma despesa rateada foi distribuída para esta unidade no período."
                      />
                    )}
                    {allocations.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-3">{item.description}</td>
                        <td className="px-4 py-3">{item.ruleName}</td>
                        <td className="px-4 py-3">{localDate(item.competenceDate)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {item.percentage.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {money(item.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t p-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/rateio">
                  Ver módulo de Rateios <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="participations">
          <Panel
            title="Sócios / Participações"
            description="Participantes contratuais da unidade. Isto não representa quadro societário da Lander Solutions."
          >
            {!unit.hasParticipationData ? (
              <p className="p-4 text-sm text-muted-foreground">
                Dados de participações indisponíveis sem sessão autorizada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Beneficiário</th>
                      <th className="px-4 py-3">Contrato</th>
                      <th className="px-4 py-3 text-right">Percentual</th>
                      <th className="px-4 py-3 text-right">Base de cálculo</th>
                      <th className="px-4 py-3 text-right">Valor devido</th>
                      <th className="px-4 py-3">Período</th>
                      <th className="px-4 py-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participations.length === 0 && (
                      <EmptyRow
                        colSpan={7}
                        label="Nenhuma participação contratual foi apurada para esta unidade no período."
                      />
                    )}
                    {participations.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{item.beneficiary}</td>
                        <td className="px-4 py-3">{item.contractLabel}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {item.percentage.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {money(item.calculationBase)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {money(item.amount)}
                        </td>
                        <td className="px-4 py-3">{item.period}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="payouts">
          <Panel
            title="Repasses da unidade"
            description="Do valor devido ao saldo pendente, com origem contratual preservada."
          >
            {!unit.hasPayoutData ? (
              <p className="p-4 text-sm text-muted-foreground">
                Dados de repasses indisponíveis sem sessão autorizada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Beneficiário</th>
                      <th className="px-4 py-3">Origem</th>
                      <th className="px-4 py-3 text-right">Devido</th>
                      <th className="px-4 py-3 text-right">Pago</th>
                      <th className="px-4 py-3 text-right">Pendente</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.length === 0 && (
                      <EmptyRow
                        colSpan={7}
                        label="Nenhuma obrigação de repasse foi gerada para esta unidade no período."
                      />
                    )}
                    {payouts.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{item.beneficiary}</td>
                        <td className="px-4 py-3">{item.contractLabel}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {money(item.amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {money(item.paid)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {money(item.pending)}
                        </td>
                        <td className="px-4 py-3">{localDate(item.dueDate)}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="contracts">
          <Panel
            title="Contratos vinculados"
            description="Consulta contextual; a gestão permanece no módulo de Contratos."
          >
            {!query.data.contractsAvailable ? (
              <p className="p-4 text-sm text-muted-foreground">
                Contratos vinculados indisponíveis sem sessão autorizada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Título</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Contraparte</th>
                      <th className="px-4 py-3">Vigência</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.length === 0 && (
                      <EmptyRow
                        colSpan={7}
                        label="Nenhum contrato está vinculado a esta unidade."
                      />
                    )}
                    {contracts.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-3">
                          <strong>{item.code}</strong>
                          <span className="block text-muted-foreground">{item.title}</span>
                        </td>
                        <td className="px-4 py-3">{item.contractType ?? "Não disponível"}</td>
                        <td className="px-4 py-3">{item.counterparty ?? "Não disponível"}</td>
                        <td className="px-4 py-3">
                          {localDate(item.startsOn)} — {localDate(item.endsOn)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {item.baseAmount === null ? "Não disponível" : money(item.baseAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/contratos">
                              Ver contrato <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="history">
          <Panel
            title="Histórico da unidade"
            description="Eventos relevantes rastreáveis pela auditoria global existente."
          >
            <div className="divide-y">
              {!query.data.historyAvailable ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Histórico indisponível sem sessão autorizada.
                </p>
              ) : history.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Ainda não há eventos de auditoria visíveis para este cadastro.
                </p>
              ) : null}
              {query.data.historyAvailable &&
                history.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>
                      <strong>{item.action}</strong> em {item.entityTable}
                    </span>
                    <span className="text-muted-foreground">
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(item.occurredAt))}
                    </span>
                  </div>
                ))}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({
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

function CompositionRow({
  label,
  value,
  available,
  strong = false,
}: {
  label: string;
  value: number;
  available: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        strong ? "bg-muted/30 font-semibold" : ""
      }`}
    >
      <span>{label}</span>
      <span className="font-mono text-xs">{available ? money(value) : "Não disponível"}</span>
    </div>
  );
}
