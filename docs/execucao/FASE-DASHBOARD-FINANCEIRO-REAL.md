# Fase — Dashboard Financeiro Real

## Situação

O dashboard principal foi conectado às tabelas financeiras reais do Supabase de desenvolvimento.

As rotas `/`, `/contas-a-pagar`, `/contas-a-receber`, `/ledger` e `/estrutura` deixaram de utilizar dados de demonstração e passaram a usar os módulos persistentes do sistema.

Nenhuma alteração foi executada na branch `main` ou no Supabase de produção.

## Fontes de dados

- `business_units`;
- `managerial_accounts`;
- `journal_entries`;
- `journal_lines`;
- `financial_documents`;
- `financial_settlements`;
- `contracts`;
- `financial_periods`.

## Filtros globais reais

- unidades carregadas de `business_units`;
- competências carregadas de `financial_periods`;
- filtro por todas as unidades ou por unidade gerencial específica;
- filtro por competência selecionada;
- moeda funcional fixada em BRL, sem seletor de conversão fictícia;
- indicação explícita quando a competência atual ainda não está cadastrada.

## Regras de consolidação

- somente lançamentos de diário com status `posted` entram no resultado gerencial;
- somente liquidações com status `posted` entram no fluxo de caixa realizado;
- os indicadores principais respeitam a unidade e a competência selecionadas;
- as séries históricas usam a janela de seis meses encerrada na competência selecionada;
- os valores consolidados utilizam a moeda funcional BRL já registrada nos lançamentos;
- nenhuma taxa cambial é inventada ou buscada automaticamente;
- contratos recorrentes em moeda diferente de BRL são identificados, mas não convertidos sem taxa registrada;
- documentos financeiros em aberto são reduzidos pelas liquidações postadas vinculadas até o encerramento da competência;
- vencidos são calculados pela data de vencimento e pelo saldo funcional ainda aberto;
- o estado vazio apresenta valores reais zerados, sem dados fictícios.

## Classificação gerencial

- `4000` — receita bruta;
- `4200` — deduções da receita;
- `5000` — custos diretos;
- `6000` — despesas exclusivas;
- `6100` — despesas compartilhadas;
- `6200` — participações e repasses;
- `7000` — impostos sobre receita;
- `7100` — taxas de pagamento e bancárias.

## Indicadores

- receita bruta;
- deduções da receita;
- despesas totais;
- resultado operacional e margem;
- receita recorrente mensal em BRL;
- contas a receber abertas, vencidas e aguardando aprovação;
- contas a pagar abertas, vencidas e aguardando aprovação;
- lançamentos e liquidações postados na competência;
- resultado por unidade gerencial;
- composição das despesas;
- receita, despesas e resultado por competência;
- fluxo de caixa realizado;
- contratos ativos com vencimento nos 90 dias posteriores à competência.

## Remoção do protótipo

Foram removidos os catálogos e cálculos estáticos que continham unidades antigas, lançamentos fictícios, contratos fictícios, pessoas fictícias, ativos fictícios, eventos de auditoria simulados e taxa cambial fixa:

- `src/data/corporate.ts`;
- `src/data/finance.ts`;
- `src/data/governance.ts`;
- `src/data/parties.ts`;
- `src/data/types.ts`;
- cálculos financeiros e de câmbio anteriormente existentes em `src/lib/finance.ts`.

O arquivo `src/lib/finance.ts` passou a conter somente formatação neutra de datas, utilizada por uma tela administrativa, sem dados ou cálculos financeiros.

## Arquivos principais

- `src/features/dashboard/types.ts`;
- `src/features/dashboard/api.ts`;
- `src/features/dashboard/financial-dashboard-page.tsx`;
- `src/features/workspace/api.ts`;
- `src/components/workspace-context.tsx`;
- `src/components/topbar.tsx`;
- `src/routes/index.tsx`;
- `src/features/finance/documents-page.tsx`;
- `src/features/finance/ledger-page.tsx`;
- `src/features/corporate/structure-page.tsx`.

## Validação

- formatação aprovada;
- lint aprovado;
- typecheck aprovado após a remoção completa dos catálogos estáticos;
- testes aprovados;
- build aprovado;
- nenhum consumidor funcional depende de `src/data/*`;
- branch `main` e Supabase de produção não alterados.
