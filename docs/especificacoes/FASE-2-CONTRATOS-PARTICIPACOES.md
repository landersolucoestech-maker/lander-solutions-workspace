# Fase 2 — Especificação de contratos e participações

## 1. Objetivo

Definir o modelo contratual, financeiro e operacional para apurar participações econômicas vinculadas a produtos da LANDER SOLUTIONS.

A primeira utilização ocorrerá em:

- `VIVENDOMUSICA` — Vivendo da Música;
- `DICADECRIA` — Dica de Cria.

A estrutura deverá permitir novos produtos e contratos no futuro sem alteração estrutural do código.

## 2. Distinção jurídica obrigatória

O sistema deverá diferenciar:

- sócio da pessoa jurídica LANDER SOLUTIONS;
- participante econômico de produto;
- investidor;
- parceiro comercial;
- prestador remunerado por percentual;
- beneficiário contratual;
- fornecedor;
- cliente.

Um participante econômico de produto não será automaticamente tratado como sócio da LANDER SOLUTIONS.

Toda participação dependerá de contrato e versão contratual vigentes.

## 3. Entidades conceituais

### 3.1 Participante

Cadastro de pessoa física ou jurídica que possui relação econômica com uma unidade ou produto.

Campos mínimos:

- identificador;
- tipo de pessoa;
- nome ou razão social;
- documento;
- país;
- contatos;
- status;
- moeda preferencial;
- dados de pagamento protegidos;
- documentos;
- histórico.

### 3.2 Contrato de participação

Instrumento que define as condições econômicas aplicáveis ao produto.

Campos mínimos:

- código;
- unidade;
- produto;
- título;
- natureza da participação;
- vigência;
- periodicidade de apuração;
- prazo de pagamento;
- regime de reconhecimento;
- moeda;
- status;
- documento principal;
- responsáveis;
- aprovações.

### 3.3 Versão contratual

Toda alteração econômica deverá criar nova versão.

Campos mínimos:

- número da versão;
- início de vigência;
- fim de vigência;
- motivo da alteração;
- base de cálculo;
- componentes incluídos;
- componentes excluídos;
- regras de reserva;
- regras de prejuízo;
- regras de investimento;
- regras de arredondamento;
- documento correspondente;
- aprovadores;
- data de aprovação.

É proibido sobrescrever uma versão anterior que já tenha sido utilizada em apuração.

### 3.4 Participação por versão

Relaciona cada participante a uma versão contratual.

Campos mínimos:

- participante;
- versão;
- percentual;
- prioridade;
- limite mínimo ou máximo, quando contratual;
- retenção;
- condição de elegibilidade;
- status.

A soma dos percentuais não deverá exceder 100%, salvo modelo contratual explicitamente documentado que utilize bases distintas.

## 4. Base de cálculo

O sistema deverá suportar bases configuráveis, sem presumir faturamento bruto.

Bases mínimas:

- faturamento bruto;
- receita após descontos;
- receita após cancelamentos;
- receita após reembolsos;
- receita após chargebacks;
- receita líquida;
- receita de fontes selecionadas;
- resultado após custos diretos;
- resultado após despesas exclusivas;
- resultado após despesas compartilhadas autorizadas;
- lucro operacional;
- lucro líquido gerencial;
- composição contratual por componentes autorizados.

## 5. Componentes autorizados da fórmula

A versão contratual poderá incluir ou excluir:

- receitas por produto;
- receitas por plano;
- receitas por canal;
- receitas por país;
- receitas por moeda;
- descontos;
- cancelamentos;
- reembolsos;
- chargebacks;
- impostos;
- taxas de meios de pagamento;
- custos diretos;
- despesas exclusivas;
- despesas compartilhadas;
- investimentos recuperáveis;
- reservas;
- contingências;
- reinvestimentos;
- prejuízos acumulados;
- receitas específicas;
- despesas específicas;
- adiantamentos;
- compensações.

A fórmula deverá ser construída com componentes tipados e versionados.

É proibido armazenar ou executar código livre, SQL livre, JavaScript livre ou expressão arbitrária informada pelo usuário.

## 6. Regime aplicável

Cada versão contratual deverá indicar um regime:

- `COMPETENCIA`;
- `CAIXA`;
- `HIBRIDO_CONTRATUAL`.

O regime híbrido somente poderá ser utilizado quando a regra estiver detalhada e aprovada no contrato.

Exemplo válido: receita reconhecida por caixa, custos reconhecidos por competência.

A memória de cálculo deverá indicar o regime utilizado em cada componente.

## 7. Motor de apuração

### 7.1 Etapas

1. selecionar unidade e produto;
2. selecionar contrato;
3. determinar a versão vigente pela competência;
4. determinar participantes elegíveis;
5. selecionar receitas incluídas;
6. excluir receitas não elegíveis;
7. aplicar descontos;
8. aplicar cancelamentos;
9. aplicar reembolsos;
10. aplicar chargebacks;
11. aplicar impostos;
12. aplicar taxas;
13. aplicar custos diretos;
14. aplicar despesas exclusivas;
15. aplicar rateios autorizados;
16. aplicar investimentos recuperáveis;
17. aplicar reservas;
18. aplicar contingências;
19. aplicar prejuízos anteriores;
20. calcular a base final;
21. aplicar percentuais;
22. aplicar retenções;
23. aplicar adiantamentos;
24. aplicar compensações;
25. calcular o valor final devido.

### 7.2 Modos de execução

- `SIMULACAO`: não gera obrigação ou postagem definitiva;
- `EM_REVISAO`: cálculo congelado para conferência;
- `APROVADA`: obrigação reconhecida;
- `POSTADA`: lançamentos gerados no ledger;
- `REVERTIDA`: anulada por operação formal inversa.

### 7.3 Imutabilidade

Após aprovação:

- componentes não poderão ser alterados;
- percentuais não poderão ser substituídos;
- lançamentos de origem permanecerão vinculados;
- memória de cálculo permanecerá preservada;
- correções ocorrerão por reversão, complemento ou compensação futura.

## 8. Memória de cálculo

Toda apuração deverá gerar memória detalhada contendo:

- unidade;
- produto;
- contrato;
- versão;
- período;
- regime;
- participante;
- percentual;
- receitas consideradas;
- receitas excluídas;
- descontos;
- cancelamentos;
- reembolsos;
- chargebacks;
- impostos;
- taxas;
- custos diretos;
- despesas exclusivas;
- despesas compartilhadas;
- regras e versões de rateio;
- investimentos;
- reservas;
- contingências;
- prejuízos compensados;
- base anterior aos ajustes;
- base final;
- retenções;
- adiantamentos;
- compensações;
- valor devido;
- valor pago;
- saldo pendente.

Cada linha deverá possuir vínculo com o documento operacional, alocação e lançamento do ledger correspondente.

A memória deverá ser exportável em XLSX.

## 9. Conta-corrente gerencial da unidade

A conta-corrente gerencial não é uma conta bancária.

Ela demonstrará a relação econômica entre a LANDER SOLUTIONS e a unidade.

Movimentos mínimos:

- receita gerada;
- recebimento pela LANDER SOLUTIONS;
- despesa paga em benefício da unidade;
- recurso disponibilizado pela LANDER SOLUTIONS;
- investimento;
- adiantamento;
- crédito;
- débito;
- rateio;
- reserva;
- compensação;
- repasse;
- reversão;
- prejuízo acumulado.

O saldo deverá ser derivado do ledger. É proibido manter saldo editável sem origem transacional.

## 10. Conta-corrente do participante

Cada participante possuirá conta-corrente por unidade, produto e contrato.

Movimentos mínimos:

- participação apurada;
- obrigação aprovada;
- pagamento;
- pagamento parcial;
- investimento;
- adiantamento;
- despesa assumida;
- reembolso;
- retenção;
- reserva atribuída;
- compensação;
- prejuízo carregado;
- reversão;
- ajuste formal.

Saldos derivados:

- a pagar;
- vencido;
- retido;
- a compensar;
- a recuperar;
- já pago.

## 11. Investimentos

Investimentos poderão ser realizados por:

- LANDER SOLUTIONS;
- participante;
- parceiro;
- terceiro autorizado.

Classificações mínimas:

- não recuperável;
- recuperável antes da divisão;
- recuperável em parcelas;
- adiantamento;
- empréstimo contratual;
- despesa assumida por participante;
- reinvestimento de resultado;
- reserva operacional.

Campos mínimos:

- investidor;
- unidade;
- produto;
- contrato;
- data;
- competência;
- valor;
- moeda;
- finalidade;
- forma de recuperação;
- prioridade;
- limite;
- documento;
- saldo recuperado;
- saldo pendente;
- status.

Nenhum investimento será classificado automaticamente como capital social.

## 12. Prejuízos acumulados

A versão contratual deverá definir se o prejuízo:

- é absorvido pela LANDER SOLUTIONS;
- é compartilhado;
- reduz bases futuras;
- é compensado com lucros futuros;
- possui limite;
- possui prazo;
- não afeta participações futuras.

O sistema não aplicará compensação sem regra vigente.

Toda utilização de prejuízo deverá constar na memória de cálculo e na conta-corrente correspondente.

## 13. Reservas, contingências e reinvestimentos

Reservas poderão possuir finalidade:

- operação;
- capital de giro;
- marketing;
- desenvolvimento;
- manutenção;
- suporte;
- impostos;
- reembolsos;
- chargebacks;
- contingência;
- reinvestimento.

Campos mínimos:

- nome;
- unidade;
- produto;
- contrato;
- versão;
- finalidade;
- método;
- percentual ou valor;
- limite;
- vigência;
- saldo;
- status;
- aprovadores.

Toda constituição ou utilização de reserva deverá postar no ledger.

## 14. Repasses

### 14.1 Estados

- `EM_CALCULO`;
- `SIMULADO`;
- `AGUARDANDO_CONFERENCIA`;
- `AGUARDANDO_APROVACAO`;
- `APROVADO`;
- `PARCIALMENTE_PAGO`;
- `PAGO`;
- `RETIDO`;
- `COMPENSADO`;
- `VENCIDO`;
- `REVERTIDO`.

### 14.2 Regras

O sistema deverá impedir:

- pagamento sem apuração aprovada;
- pagamento duplicado;
- pagamento acima do saldo sem autorização específica;
- edição de pagamento consolidado;
- exclusão de comprovante sem histórico;
- alteração retroativa da base;
- pagamento para participante inativo ou sem dados validados;
- pagamento durante período bloqueado, salvo fluxo autorizado.

### 14.3 Pagamentos parciais

Cada pagamento parcial reduzirá o saldo da obrigação original.

Invariante:

`valor_aprovado = valor_pago + valor_retido + valor_compensado + saldo_pendente`

## 15. Aprovações e segregação

Operações que exigirão aprovação:

- ativação de contrato;
- nova versão contratual;
- alteração de percentual;
- consolidação de apuração;
- ajuste manual;
- constituição ou uso de reserva;
- recuperação de investimento;
- compensação;
- repasse;
- reversão;
- reabertura de período.

Quando a segregação estiver habilitada, o solicitante não poderá aprovar a própria operação.

## 16. CRUD e modais

Módulos obrigatórios:

- participantes;
- contratos de participação;
- versões;
- participações;
- investimentos;
- reservas;
- apurações;
- repasses;
- compensações.

Cada módulo deverá possuir:

- botão **Criar**;
- ação **Ver**;
- ação **Editar** quando permitida;
- ação **Excluir** ou equivalente seguro;
- modal de criação;
- modal de visualização;
- modal de edição;
- modal destrutivo.

Regras destrutivas:

- participante sem vínculo poderá ser excluído; com vínculo deverá ser inativado;
- contrato em rascunho sem dependências poderá ser excluído; contrato utilizado deverá ser encerrado;
- versão utilizada em apuração não poderá ser excluída;
- apuração aprovada deverá ser revertida;
- repasse realizado deverá ser estornado ou revertido;
- investimento consolidado deverá ser revertido;
- auditoria nunca poderá ser excluída.

## 17. Permissões mínimas

Ações específicas:

- `participantes.read`;
- `participantes.create`;
- `participantes.update`;
- `participantes.deactivate`;
- `participation_contracts.read`;
- `participation_contracts.create`;
- `participation_contracts.update_draft`;
- `participation_contracts.approve`;
- `settlements.simulate`;
- `settlements.review`;
- `settlements.approve`;
- `settlements.reverse`;
- `payouts.create`;
- `payouts.approve`;
- `payouts.pay`;
- `payouts.reverse`;
- `reserves.manage`;
- `investments.manage`.

As políticas RLS deverão limitar dados pela unidade autorizada.

## 18. Relatórios obrigatórios

- demonstrativo de participação por produto;
- memória de cálculo por participante;
- conta-corrente da unidade;
- conta-corrente do participante;
- investimentos e recuperação;
- reservas e utilizações;
- prejuízos acumulados;
- repasses aprovados;
- repasses pagos;
- repasses pendentes;
- repasses vencidos;
- compensações;
- reconciliação entre apuração, ledger e pagamento.

## 19. Invariantes obrigatórias

1. Toda participação possui contrato e versão aplicável.
2. Percentuais utilizados permanecem versionados.
3. Apuração aprovada é imutável.
4. Pagamento depende de obrigação aprovada.
5. O total pago não excede o total aprovado sem autorização formal.
6. Conta-corrente é derivada do ledger.
7. Prejuízo somente é compensado quando o contrato autoriza.
8. Reserva somente é criada ou utilizada quando o contrato autoriza.
9. Investimento somente é recuperado conforme regra contratual.
10. Toda memória de cálculo é rastreável até a origem.
11. Correções ocorrem por reversão ou ajuste formal.
12. Alterações contratuais não afetam períodos anteriores.

## 20. Critérios de aceite da Fase 2

- distinção entre sócio jurídico e participante econômico definida;
- contrato e versionamento definidos;
- bases de cálculo suportadas definidas;
- motor de apuração especificado;
- memória de cálculo especificada;
- contas-correntes especificadas;
- investimentos, reservas e prejuízos especificados;
- repasses e pagamentos parciais especificados;
- aprovações e permissões definidas;
- CRUD e regras destrutivas incorporados;
- invariantes documentadas.

**Status:** aprovado.
