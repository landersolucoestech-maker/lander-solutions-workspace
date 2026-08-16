import type { WorkbookSheet } from "./xlsx-export";
import type { AgingBucket, ReportSnapshot } from "./types";

const bucketLabels: Record<AgingBucket, string> = {
  not_due: "A vencer",
  days_1_30: "1–30 dias",
  days_31_60: "31–60 dias",
  days_61_90: "61–90 dias",
  over_90: "Acima de 90 dias",
};

function amount(value: number) {
  return Number(value.toFixed(2));
}

function percentage(value: number) {
  return Number(value.toFixed(2));
}

export function reportFilename(snapshot: ReportSnapshot) {
  const unit = snapshot.filters.unitCode.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  return `lander-solutions-relatorios-${snapshot.filters.period}-${unit}.xlsx`;
}

export function buildReportWorkbook(snapshot: ReportSnapshot): WorkbookSheet[] {
  const summary = snapshot.dashboard.summary;
  const receivables = snapshot.receivableAging;
  const payables = snapshot.payableAging;

  return [
    {
      name: "Resumo executivo",
      widths: [34, 22],
      rows: [
        ["Indicador", "Valor"],
        ["Competência", snapshot.filters.period],
        ["Unidade", snapshot.filters.unitCode],
        ["Gerado em", snapshot.generatedAt],
        ["Moeda funcional", "BRL"],
        ["Receita bruta", amount(summary.revenue)],
        ["Deduções da receita", amount(summary.deductions)],
        ["Custos diretos", amount(summary.directCost)],
        ["Despesas exclusivas", amount(summary.exclusiveExpense)],
        ["Despesas compartilhadas", amount(summary.sharedExpense)],
        ["Participações e repasses", amount(summary.participationExpense)],
        ["Impostos sobre receita", amount(summary.taxExpense)],
        ["Taxas e despesas bancárias", amount(summary.feeExpense)],
        ["Despesas totais", amount(summary.totalExpense)],
        ["Resultado operacional", amount(summary.operatingResult)],
        ["Margem operacional (%)", percentage(summary.marginPercent)],
        ["Recebíveis em aberto", amount(receivables.total)],
        ["Pagamentos em aberto", amount(payables.total)],
        ["Lançamentos postados", snapshot.dashboard.postedEntries],
        ["Liquidações postadas", snapshot.dashboard.postedSettlements],
      ],
    },
    {
      name: "DRE gerencial",
      widths: [16, 42, 20, 20],
      rows: [
        ["Conta", "Descrição", "Tipo", "Valor BRL"],
        ...snapshot.dreRows.map((row) => [
          row.accountCode,
          row.accountName,
          row.accountType,
          amount(row.amount),
        ]),
        ["", "RESULTADO OPERACIONAL", "result", amount(summary.operatingResult)],
      ],
    },
    {
      name: "Resultado por unidade",
      widths: [18, 34, 18, 18, 18, 18, 16],
      rows: [
        ["Código", "Unidade", "Receita", "Deduções", "Despesas", "Resultado", "Margem (%)"],
        ...snapshot.dashboard.units.map((row) => [
          row.code,
          row.name,
          amount(row.revenue),
          amount(row.deductions),
          amount(row.expenses),
          amount(row.result),
          percentage(row.marginPercent),
        ]),
      ],
    },
    {
      name: "Fluxo de caixa",
      widths: [16, 18, 20, 42, 34, 18, 18, 18],
      rows: [
        [
          "Data",
          "Natureza",
          "Documento",
          "Descrição",
          "Contraparte",
          "Unidade",
          "Valor BRL",
          "Taxa bancária BRL",
        ],
        ...snapshot.cashMovements.map((row) => [
          row.settlementDate,
          row.nature,
          row.documentNumber,
          row.description,
          row.partyName,
          row.unitCode,
          amount(row.amount),
          amount(row.bankFee),
        ]),
      ],
    },
    {
      name: "Contas a receber",
      widths: [18, 42, 34, 18, 16, 16, 16, 18, 18, 18, 18, 20],
      rows: [
        [
          "Documento",
          "Descrição",
          "Cliente",
          "Unidade",
          "Emissão",
          "Competência",
          "Vencimento",
          "Valor BRL",
          "Liquidado BRL",
          "Saldo BRL",
          "Faixa",
          "Referência externa",
        ],
        ...snapshot.receivableRows.map((row) => [
          row.documentNumber,
          row.description,
          row.partyName,
          row.unitCode,
          row.issueDate,
          row.competenceDate,
          row.dueDate,
          amount(row.functionalAmount),
          amount(row.settledAmount),
          amount(row.openAmount),
          bucketLabels[row.bucket],
          row.externalReference,
        ]),
      ],
    },
    {
      name: "Contas a pagar",
      widths: [18, 42, 34, 18, 16, 16, 16, 18, 18, 18, 18, 20],
      rows: [
        [
          "Documento",
          "Descrição",
          "Fornecedor",
          "Unidade",
          "Emissão",
          "Competência",
          "Vencimento",
          "Valor BRL",
          "Liquidado BRL",
          "Saldo BRL",
          "Faixa",
          "Referência externa",
        ],
        ...snapshot.payableRows.map((row) => [
          row.documentNumber,
          row.description,
          row.partyName,
          row.unitCode,
          row.issueDate,
          row.competenceDate,
          row.dueDate,
          amount(row.functionalAmount),
          amount(row.settledAmount),
          amount(row.openAmount),
          bucketLabels[row.bucket],
          row.externalReference,
        ]),
      ],
    },
  ];
}

export function agingBucketLabel(bucket: AgingBucket) {
  return bucketLabels[bucket];
}
