# Fase 9 — Rateios e alocações

## Situação

**Implementada e validada tecnicamente no ambiente de desenvolvimento.**

A fase substitui a tela demonstrativa de rateios por um domínio persistido no Supabase, com regras versionadas, direcionadores, simulação, memória por origem e destino, aprovação segregada, postagem no ledger e estorno integral.

Nenhuma alteração foi executada no Supabase de produção ou na branch `main`.

## Ambientes

- Repositório: `landersolucoestech-maker/lander-solutions`;
- branch GitHub: `dev`;
- PR nº 1 mantido em rascunho;
- Supabase de desenvolvimento: `jodzhcktrlwinywqgbab`;
- Edge Function administrativa: `admin-allocations`;
- JWT obrigatório;
- MFA `aal2` obrigatório nas ações sensíveis.

## Princípio gerencial

O rateio é uma **reclassificação gerencial**, não uma nova despesa.

Ao postar uma execução:

1. o ledger credita a conta de custo ou investimento na dimensão de origem;
2. o ledger debita a mesma conta nas dimensões destinatárias;
3. o total de débitos é igual ao total de créditos;
4. o consolidado da LANDER SOLUTIONS permanece inalterado;
5. os resultados individuais das unidades passam a refletir a parcela atribuída a cada uma.

A mesma despesa não é duplicada. O lançamento original permanece auditável e o rateio registra somente sua redistribuição gerencial.

## Estrutura de banco

Foram criadas as tabelas:

- `allocation_rules`;
- `allocation_rule_versions`;
- `allocation_rule_targets`;
- `allocation_driver_values`;
- `allocation_runs`;
- `allocation_run_sources`;
- `allocation_run_distributions`;
- `allocation_approvals`.

Também foi criada a view `allocation_source_candidates`, com `security_invoker`, para apresentar somente partidas postadas com saldo devedor ainda disponível para rateio.

## Regras de rateio

Cada regra identifica:

- pessoa jurídica;
- código e nome;
- unidade de origem;
- situação;
- versão econômica vigente;
- responsável e controle de versão.

A exclusão física é permitida somente para regra em rascunho sem versões. Regras com histórico são inativadas ou arquivadas.

## Versões econômicas

As versões registram:

- número da versão;
- método de rateio;
- início e término da vigência;
- conta gerencial de origem opcional;
- centro de custo de origem opcional;
- categoria de origem opcional;
- projeto de origem opcional;
- estratégia de arredondamento;
- destino residual opcional;
- notas;
- solicitação, decisão e responsáveis;
- situação e concorrência otimista.

Versões aprovadas são imutáveis. Alterações econômicas exigem nova versão.

O solicitante não pode aprovar a própria versão.

## Métodos suportados

- percentual fixo;
- divisão igualitária;
- receita do período;
- custos diretos do período;
- quantidade de lançamentos;
- quantidade de pessoas;
- uso medido;
- direcionador manual.

Percentuais fixos precisam totalizar exatamente 100%.

Métodos baseados em pessoas, uso ou direcionador manual utilizam valores por destino e período, com situação de rascunho ou confirmado e campo de evidência.

## Destinos

Cada destino pode identificar:

- unidade;
- produto;
- linha de serviço;
- projeto;
- centro de custo;
- percentual fixo;
- ordem de processamento;
- situação ativa ou inativa.

O banco valida que produto, serviço, projeto e centro pertencem à unidade indicada.

## Execuções

Uma execução registra:

- versão aprovada utilizada;
- período financeiro;
- competência;
- descrição;
- método congelado;
- valor de origem;
- valor distribuído;
- resíduo;
- lançamento do rateio;
- lançamento de estorno;
- solicitante, aprovador, responsável pela postagem e responsável pelo estorno;
- situação e versão.

Ciclo de vida:

1. rascunho;
2. simulado;
3. pendente de aprovação;
4. aprovado;
5. postado;
6. estornado.

Execuções ainda não consolidadas podem ser excluídas. Execuções postadas são preservadas e corrigidas somente por estorno.

## Origens

As origens são partidas do ledger que atendem simultaneamente aos seguintes critérios:

- lançamento postado;
- origem diferente de rateio ou estorno;
- conta gerencial de despesa ou investimento;
- saldo devedor positivo;
- unidade correspondente à regra;
- filtros opcionais da versão;
- saldo ainda não consumido por outro rateio postado.

O sistema preserva o saldo disponível no momento da seleção e verifica novamente a disponibilidade antes da postagem.

## Simulação e memória de cálculo

A simulação gera uma linha de memória para cada combinação de origem e destino, contendo:

- partida de origem;
- destino;
- valor do direcionador;
- peso normalizado;
- percentual calculado;
- valor distribuído;
- ajuste de arredondamento.

O algoritmo utiliza centavos e atribui o resíduo pela maior fração ou pelo destino residual designado.

A soma por origem precisa fechar exatamente com o valor selecionado. Uma execução com resíduo diferente de zero não pode ser submetida ou postada.

## Aprovação, postagem e estorno

Ações administrativas:

- `admin_submit_allocation_rule_version`;
- `admin_decide_allocation_rule_version`;
- `admin_simulate_allocation_run`;
- `admin_submit_allocation_run`;
- `admin_decide_allocation_run`;
- `admin_post_allocation_run`;
- `admin_reverse_allocation_run`.

Essas RPCs são executáveis somente por `postgres` e `service_role`.

A Edge Function `admin-allocations`:

1. valida o JWT;
2. valida a sessão;
3. exige MFA `aal2`;
4. resolve a unidade de origem;
5. valida `allocation.manage` ou `allocation.approve`;
6. chama a RPC restrita;
7. aplica versão esperada;
8. retorna resposta sem cache.

O `service_role` permanece exclusivamente no servidor.

O solicitante não pode aprovar ou postar a própria execução. O responsável pela postagem original não pode executar o próprio estorno.

## RLS e auditoria

As oito tabelas possuem RLS.

Foram aplicadas políticas separadas para leitura, inserção, atualização e exclusão, evitando políticas `FOR ALL` redundantes.

O papel `anon` possui zero privilégios no domínio.

As tabelas possuem:

- trilha de auditoria;
- atualização automática de data;
- incremento de versão;
- validação de escopo;
- proteção de versões aprovadas;
- congelamento após submissão;
- proteção contra consumo duplicado da origem.

## Interface entregue

A rota `/rateio` deixou de usar arrays locais.

Foram implementados:

- indicadores de regras, execuções, aprovações pendentes e total postado;
- busca e filtros;
- abas de regras e execuções;
- botão Criar regra;
- botão Criar execução;
- ações Ver, Editar e Excluir ou Inativar;
- modais de regras;
- modais de versões;
- modais de destinos;
- modais de direcionadores;
- modais de execuções;
- modais de origens;
- simulação;
- memória detalhada;
- submissão;
- aprovação ou rejeição;
- postagem no ledger;
- estorno integral;
- visualização da trilha de aprovação e dos lançamentos vinculados.

## Migrations aplicadas

- `20260731073803_allocation_rules_and_execution_foundation`;
- `20260731074248_allocation_simulation_posting_and_reversal`;
- `20260731074601_index_allocation_foreign_keys`;
- `20260731074618_split_allocation_management_policies`.

## Teste transacional ponta a ponta

Uma transação descartável confirmou:

- criação de três usuários temporários;
- atribuição de papéis distintos;
- criação de período financeiro aberto;
- criação e postagem de despesa compartilhada de R$ 100,00 no CORPORATIVO;
- criação de regra 60/40;
- submissão por um usuário;
- aprovação por usuário diferente;
- simulação de R$ 100,00;
- distribuição de R$ 60,00 para MUSICOS360;
- distribuição de R$ 40,00 para VIVENDOMUSICA;
- crédito de R$ 100,00 no CORPORATIVO;
- lançamento balanceado em R$ 100,00 de débito e R$ 100,00 de crédito;
- efeito consolidado igual a zero;
- estorno por terceiro usuário;
- lançamento de estorno balanceado em R$ 100,00 de débito e R$ 100,00 de crédito.

A transação foi revertida e nenhum dado de teste permaneceu salvo.

## Advisors

- advisor de segurança sem alertas;
- FKs do domínio com índices de cobertura;
- políticas de manutenção separadas por operação;
- avisos restantes de performance são referentes principalmente a índices ainda não exercitados em banco sem carga, FKs anteriores do núcleo financeiro e configuração global de conexões do Auth.

## Ressalva operacional

A homologação humana exige:

1. bootstrap do proprietário real;
2. MFA `aal2`;
3. segundo usuário com permissão de aprovação;
4. período financeiro aberto;
5. despesas compartilhadas de homologação sem dados produtivos;
6. conferência dos direcionadores com os contratos e a política gerencial aprovada.

A fase permanece no PR em rascunho e não deve ser promovida para `main` ou produção antes dessa homologação.
