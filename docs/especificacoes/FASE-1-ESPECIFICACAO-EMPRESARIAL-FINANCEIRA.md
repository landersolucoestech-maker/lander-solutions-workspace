# Fase 1 — Especificação empresarial e financeira

## 1. Objetivo

Definir o modelo empresarial, gerencial e financeiro que deverá orientar o banco de dados, os serviços de domínio, as permissões, os relatórios e a interface do Sistema Corporativo da LANDER SOLUTIONS.

Esta especificação é normativa. Nenhuma tabela financeira, regra de cálculo, relatório ou fluxo de fechamento poderá contrariá-la.

## 2. Estrutura jurídica e gerencial

### 2.1 Pessoa jurídica única

A única pessoa jurídica do sistema será a **LANDER SOLUTIONS LTDA.**

Todas as operações jurídicas, fiscais, bancárias e contábeis pertencem à LANDER SOLUTIONS:

- receitas;
- despesas;
- contas bancárias;
- documentos fiscais;
- contratos;
- pagamentos;
- recebimentos;
- impostos;
- obrigações legais;
- ativos;
- passivos.

As unidades gerenciais não são empresas, filiais, pessoas jurídicas ou contabilidades autônomas.

### 2.2 Camada corporativa

`CORPORATIVO` será uma camada administrativa e de consolidação, não um quinto produto.

Ela poderá receber:

- despesas gerais da pessoa jurídica;
- contabilidade;
- jurídico corporativo;
- administração;
- recursos humanos;
- infraestrutura compartilhada;
- despesas ainda pendentes de classificação;
- despesas justificadamente não rateáveis.

### 2.3 Unidades gerenciais oficiais

| Código           | Nome              | Natureza                                           |
| ---------------- | ----------------- | -------------------------------------------------- |
| `MUSICOS360`     | Music OS 360      | Produto SaaS e serviços relacionados               |
| `VIVENDOMUSICA`  | Vivendo da Música | Cursos, conteúdos e produtos digitais              |
| `DICADECRIA`     | Dica de Cria      | Cursos, conteúdos e produtos digitais              |
| `LANDERSERVICES` | Lander Services   | Linhas de serviços prestados pela LANDER SOLUTIONS |

Dentro de `LANDERSERVICES`, as linhas de serviço serão cadastráveis. Exemplos iniciais:

- desenvolvimento de sistemas;
- websites e portais;
- automações;
- consultoria tecnológica;
- suporte técnico;
- apoio administrativo;
- serviços de dispatch;
- outros serviços profissionais.

É proibido recriar como unidades independentes:

- `DISPATCH-SOFTWARE`;
- `DISPATCH-SERVICE`;
- `TECH-SERVICES`;
- `CLEANING-BPO`;
- `DJSTAY-EAD`.

Não existe produto ou sistema Lander Dispatch. Dispatch é uma linha de serviço de `LANDERSERVICES`.

## 3. Dimensões gerenciais

Toda movimentação deverá preservar as dimensões aplicáveis:

- pessoa jurídica;
- unidade gerencial;
- produto;
- linha de serviço;
- projeto;
- contrato;
- contrato de participação;
- cliente;
- fornecedor;
- participante econômico;
- centro de custo;
- centro de receita;
- categoria;
- subcategoria;
- competência;
- moeda;
- origem;
- responsável.

### 3.1 Obrigatoriedade

Nenhuma receita ou despesa poderá ser consolidada sem uma classificação válida.

Um lançamento poderá permanecer temporariamente como `PENDENTE_CLASSIFICACAO`, mas:

- não integrará o fechamento definitivo;
- deverá constar no relatório de pendências;
- deverá possuir responsável e prazo;
- bloqueará o fechamento do período enquanto não for resolvido.

## 4. Tipos de alocação

### 4.1 Direta

O valor pertence integralmente a uma unidade, produto, serviço, projeto ou contrato.

A alocação será de 100% para o beneficiário correspondente.

### 4.2 Compartilhada

O valor beneficia mais de uma unidade ou operação.

Deverá possuir:

- regra de rateio;
- versão da regra;
- base de cálculo;
- beneficiários;
- percentuais;
- valores;
- arredondamento;
- simulação;
- aprovação;
- memória de cálculo;
- trilha de auditoria.

### 4.3 Corporativa não rateável

Utilizada somente quando a despesa pertence à estrutura jurídica geral e não existe fundamento gerencial para rateio.

Exigirá justificativa e permissão específica.

### 4.4 Não duplicidade

A movimentação jurídica, bancária ou documental será registrada uma única vez.

O rateio criará alocações gerenciais, não novas despesas pagas.

Invariante obrigatória:

`valor_original = soma(alocacoes)`

No consolidado, a movimentação original será considerada uma única vez. As alocações serão utilizadas apenas para distribuir o resultado entre unidades.

## 5. Documentos operacionais e ledger

O sistema será dividido em duas camadas:

### 5.1 Documentos operacionais

Representam eventos e obrigações do negócio:

- conta a pagar;
- conta a receber;
- invoice;
- nota fiscal;
- cobrança;
- pagamento;
- recebimento;
- reembolso;
- chargeback;
- investimento;
- repasse;
- reserva;
- rateio;
- apuração.

### 5.2 Ledger gerencial de partidas dobradas

Decisão adotada: utilizar **ledger gerencial de partidas dobradas**.

Motivos:

- impedir saldos sem contrapartida;
- permitir estornos consistentes;
- separar competência e caixa;
- impedir dupla contagem;
- suportar contas-correntes gerenciais;
- rastrear repasses, reservas e investimentos;
- reconciliar relatórios por unidade com o consolidado.

Cada postagem deverá possuir pelo menos duas linhas e obedecer:

`total_debitos = total_creditos`

O ledger não substitui a contabilidade oficial.

### 5.3 Plano de contas gerencial

O plano de contas deverá suportar, no mínimo:

- ativos;
- passivos;
- patrimônio/resultado gerencial;
- receitas;
- deduções da receita;
- impostos sobre receita;
- taxas de recebimento;
- custos diretos;
- despesas exclusivas;
- despesas compartilhadas;
- investimentos gerenciais;
- reservas;
- contas a pagar;
- contas a receber;
- caixa e equivalentes;
- valores devidos a participantes;
- adiantamentos;
- compensações;
- prejuízos acumulados gerenciais.

## 6. Reconhecimento por competência e por caixa

### 6.1 Competência

Receitas e despesas serão reconhecidas no período econômico ao qual pertencem.

### 6.2 Caixa

Entradas e saídas serão reconhecidas na data de liquidação.

### 6.3 Regra de relatório

Todo relatório financeiro deverá indicar explicitamente o regime utilizado.

É proibido misturar competência e caixa em um mesmo indicador sem identificação.

## 7. Estados financeiros mínimos

### 7.1 Contas a pagar

- `RASCUNHO`;
- `PENDENTE_APROVACAO`;
- `APROVADA`;
- `PARCIALMENTE_PAGA`;
- `PAGA`;
- `VENCIDA`;
- `CANCELADA`;
- `ESTORNADA`.

### 7.2 Contas a receber

- `RASCUNHO`;
- `EMITIDA`;
- `PARCIALMENTE_RECEBIDA`;
- `RECEBIDA`;
- `VENCIDA`;
- `CANCELADA`;
- `ESTORNADA`;
- `EM_DISPUTA`.

### 7.3 Lançamento do ledger

- `RASCUNHO`;
- `VALIDADO`;
- `POSTADO`;
- `REVERTIDO`.

Lançamentos `POSTADO` não poderão ser editados ou excluídos.

## 8. Estrutura do resultado por unidade

O demonstrativo gerencial deverá apresentar:

1. receita bruta;
2. descontos;
3. cancelamentos;
4. reembolsos;
5. chargebacks;
6. outras deduções;
7. receita ajustada;
8. impostos sobre receita;
9. taxas de meios de pagamento;
10. receita líquida;
11. custos diretos;
12. margem bruta;
13. despesas exclusivas;
14. despesas compartilhadas rateadas;
15. resultado operacional;
16. investimentos apresentados separadamente;
17. reservas e contingências;
18. compensações e ajustes autorizados;
19. lucro ou prejuízo gerencial.

Cada linha deverá permitir drill-down até os documentos e lançamentos originais.

## 9. Resultado consolidado

O resultado consolidado representa a LANDER SOLUTIONS como uma única empresa.

Deverá eliminar:

- transferências internas;
- duplicidade de rateios;
- movimentos entre contas-correntes gerenciais;
- repasses tratados como movimentação interna de resultado quando aplicável;
- alocações que já estejam representadas pela movimentação original.

Deverá diferenciar:

- despesa operacional;
- distribuição ou participação de resultado;
- investimento;
- adiantamento;
- empréstimo;
- reembolso;
- compensação;
- movimento de caixa;
- reconhecimento por competência.

## 10. Centros de custo e receita

### 10.1 Centro de custo

Identifica onde o recurso foi consumido.

Poderá ser relacionado a:

- unidade;
- produto;
- serviço;
- departamento;
- projeto;
- contrato.

### 10.2 Centro de receita

Identifica a origem econômica da receita.

Poderá ser relacionado a:

- unidade;
- produto;
- plano;
- curso;
- produto digital;
- linha de serviço;
- projeto;
- contrato.

Centros com movimentação não poderão ser excluídos fisicamente.

## 11. Rateio

Bases mínimas:

- percentual fixo;
- receita;
- consumo real;
- horas trabalhadas;
- usuários;
- colaboradores;
- projetos;
- unidades beneficiadas;
- regra híbrida;
- rateio manual aprovado.

Regras:

- a soma deverá corresponder exatamente ao valor original;
- diferenças de arredondamento serão atribuídas deterministicamente;
- uma despesa não poderá receber dois rateios definitivos ativos;
- alterações de regra não afetarão períodos já encerrados;
- simulações não postarão no ledger;
- execução definitiva será versionada e auditada;
- reversão deverá preservar o histórico.

## 12. Múltiplas moedas

Moedas iniciais:

- BRL;
- USD.

Cada documento deverá preservar:

- valor original;
- moeda original;
- taxa de câmbio;
- data da taxa;
- fonte da taxa;
- valor funcional em BRL;
- tarifas;
- valor líquido.

A moeda funcional da empresa será BRL.

Valores monetários utilizarão `numeric`, nunca `float`, `real` ou `double precision`.

## 13. Fechamento de período

Etapas obrigatórias:

1. validar classificações;
2. validar documentos pendentes;
3. concluir conciliações;
4. concluir rateios;
5. registrar cancelamentos, reembolsos e chargebacks;
6. provisionar impostos gerenciais;
7. validar contratos vigentes;
8. calcular resultados;
9. calcular participações;
10. revisar pendências;
11. aprovar;
12. bloquear o período.

O fechamento será bloqueado quando houver:

- lançamento pendente de classificação;
- rateio incompleto;
- apuração obrigatória não concluída;
- documento financeiro inconsistente;
- ledger desbalanceado;
- contrato sem versão aplicável;
- erro de reconciliação.

A reabertura exigirá permissão, justificativa, aprovação e auditoria.

## 14. CRUD e interface

Todo módulo de cadastro deverá implementar operações reais:

- **Criar**;
- **Ver**;
- **Editar**;
- **Excluir** ou ação segura equivalente.

As operações utilizarão modais consistentes.

A ação destrutiva deverá respeitar a natureza do registro:

- excluir fisicamente somente registros sem dependências e sem obrigação de retenção;
- inativar unidades, produtos, serviços, clientes, fornecedores e centros vinculados;
- cancelar obrigações não consolidadas;
- estornar ou reverter movimentações consolidadas;
- nunca apagar auditoria, períodos fechados, lançamentos postados, rateios definitivos ou repasses realizados.

## 15. Permissões

As permissões deverão considerar:

- papel;
- ação;
- módulo;
- unidade;
- registro;
- status;
- segregação de funções.

Ocultar controles no frontend não substitui autorização no banco.

## 16. Relatórios obrigatórios

- resultado por unidade;
- resultado por produto;
- resultado por linha de serviço;
- consolidado da LANDER SOLUTIONS;
- fluxo de caixa;
- contas a pagar;
- contas a receber;
- inadimplência;
- rateios;
- pendências de classificação;
- investimentos;
- exposição cambial;
- conta-corrente da unidade;
- reconciliação entre unidades e consolidado.

## 17. Invariantes obrigatórias

1. Todo documento financeiro pertence à LANDER SOLUTIONS.
2. Todo lançamento consolidado possui classificação gerencial válida.
3. Toda postagem no ledger está balanceada.
4. Toda alocação fecha exatamente com o valor original.
5. O consolidado não duplica alocações ou transferências internas.
6. Períodos fechados são imutáveis sem reabertura formal.
7. Valores monetários utilizam precisão decimal.
8. Correções de lançamentos consolidados ocorrem por reversão.
9. Unidades com movimentação não são excluídas fisicamente.
10. Cada relatório permite rastrear o valor até sua origem.

## 18. Critérios de aceite da Fase 1

- estrutura jurídica única documentada;
- unidades oficiais consolidadas;
- unidades antigas expressamente rejeitadas;
- dimensões gerenciais definidas;
- modelo de partidas dobradas adotado;
- competência e caixa separados;
- estrutura de resultados definida;
- regras de rateio definidas;
- critérios de fechamento definidos;
- regras CRUD e de exclusão incorporadas;
- invariantes documentadas.

**Status:** aprovado.
