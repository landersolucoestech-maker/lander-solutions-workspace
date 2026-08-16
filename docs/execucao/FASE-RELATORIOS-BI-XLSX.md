# Fase — Relatórios, BI e Exportação XLSX

## Situação

Implementação funcional conectada às operações reais do Supabase de desenvolvimento.

A rota `/relatorios` consolida DRE gerencial, resultado por unidade, aging financeiro e fluxo de caixa realizado de acordo com a unidade e a competência selecionadas no cabeçalho global.

Nenhuma alteração foi executada na branch `main` ou no Supabase de produção.

## Views de leitura

- `reporting_posted_ledger_lines`;
- `reporting_posted_cash_movements`;
- `reporting_financial_documents`.

As três views foram criadas com `security_invoker=true`. Dessa forma, a consulta continua submetida às políticas RLS e aos controles de unidade das tabelas de origem.

## Segurança das views

- `anon` sem privilégios;
- `authenticated` com somente `SELECT`;
- `service_role` com somente `SELECT`;
- nenhum `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `TRIGGER` ou `REFERENCES` concedido às funções de leitura;
- advisor de segurança do Supabase sem alertas.

## DRE gerencial

- somente linhas pertencentes a lançamentos `posted`;
- agrupamento por conta gerencial;
- receita, deduções, custos, despesas, participações, impostos e taxas;
- resultado operacional e margem;
- separação por unidade gerencial;
- camada CORPORATIVO exibida separadamente quando o lançamento não pertence a uma unidade comercial.

## Aging financeiro

- contas a receber e contas a pagar;
- saldo calculado na data final da competência selecionada;
- liquidações posteriores à competência não reduzem o saldo histórico;
- faixas: a vencer, 1–30 dias, 31–60 dias, 61–90 dias e acima de 90 dias;
- documento, contraparte, unidade, vencimento, valor, liquidado e saldo em aberto.

## Fluxo de caixa

- somente liquidações `posted`;
- entradas e saídas identificadas pela natureza do documento financeiro;
- competência, documento, descrição, contraparte, unidade, valor e taxa bancária;
- moeda funcional BRL, sem conversão inventada.

## XLSX

O arquivo é gerado em formato XLSX real por meio de OOXML empacotado em ZIP, sem biblioteca externa e sem produzir CSV renomeado.

Planilhas geradas:

1. Resumo executivo;
2. DRE gerencial;
3. Resultado por unidade;
4. Fluxo de caixa;
5. Contas a receber;
6. Contas a pagar.

O arquivo inclui:

- cabeçalhos formatados;
- filtros automáticos;
- primeira linha congelada;
- larguras de coluna configuradas;
- metadados de geração;
- unidade e competência do snapshot;
- os mesmos valores usados pela interface.

## Arquivos principais

- `src/features/reports/types.ts`;
- `src/features/reports/api.ts`;
- `src/features/reports/reports-page.tsx`;
- `src/features/reports/xlsx-export.ts`;
- `src/features/reports/report-workbook.ts`;
- `src/features/reports/xlsx-export.test.ts`;
- `src/routes/relatorios.tsx`;
- `src/routeTree.gen.ts`.

## Migrations

- `20260731193541_reporting_and_bi_views_foundation`;
- `20260731194623_restrict_reporting_views_to_select`.

## Validação

- formatação aprovada;
- lint aprovado;
- typecheck aprovado;
- teste estrutural do XLSX aprovado;
- testes gerais aprovados;
- build aprovado;
- views confirmadas com `security_invoker=true`;
- privilégios confirmados como somente leitura;
- produção não alterada.
