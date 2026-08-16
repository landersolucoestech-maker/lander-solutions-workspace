# Fase 10 — Participações, apurações e repasses

## Situação

**Implementada e validada tecnicamente no ambiente de desenvolvimento.**

A fase implementa a apuração econômica de contratos com participantes, preservando a LANDER SOLUTIONS como única pessoa jurídica e segregando os resultados gerenciais por unidade, produto ou linha de serviço.

Nenhuma alteração foi executada na branch `main` ou no Supabase de produção.

## Ambientes

- Repositório: `landersolucoestech-maker/lander-solutions`;
- branch de desenvolvimento: `dev`;
- PR nº 1 mantido em rascunho;
- Supabase de desenvolvimento: `jodzhcktrlwinywqgbab`;
- Edge Function: `admin-participations`, versão 2;
- JWT obrigatório;
- MFA `aal2` obrigatório nas operações administrativas.

## Escopo econômico

A apuração usa uma versão contratual aprovada como fonte imutável para:

- participantes;
- percentuais;
- prioridades;
- valores mínimos e máximos;
- retenções;
- prazo de pagamento;
- regras de prejuízo, investimento e reserva definidas no contrato.

A memória de cálculo é congelada após a submissão. Alterações posteriores exigem retorno ao estado calculado ou uma nova apuração, sem sobrescrever o histórico submetido.

## Estrutura persistida

Foram implementadas as tabelas:

- `participation_calculations`;
- `participation_calculation_lines`;
- `participation_approvals`;
- `payout_obligations`;
- `payout_payments`.

A conta gerencial `6200 — Participações e repasses econômicos` foi adicionada ao plano gerencial.

## Base distribuível

A base é calculada por:

`receita bruta - deduções - custos diretos - custos rateados - impostos - taxas de pagamento - investimentos - reservas - compensação de prejuízo anterior`

O cálculo por participante aplica, na ordem:

1. percentual contratual;
2. mínimo contratual, quando aplicável;
3. máximo contratual, quando aplicável;
4. retenção percentual;
5. valor líquido de repasse.

O total líquido não pode exceder a base distribuível.

## Ciclo da apuração

Estados implementados:

- `draft`;
- `calculated`;
- `pending_approval`;
- `approved`;
- `posted`;
- `cancelled`;
- `reversed`.

Ações administrativas:

- calcular;
- submeter;
- aprovar;
- rejeitar;
- consolidar no ledger;
- registrar pagamento reconciliado.

O criador ou solicitante não pode aprovar a própria apuração.

## Ledger e multimoeda

A consolidação cria um lançamento gerencial balanceado:

- débito na conta `6200 — Participações e repasses econômicos`;
- crédito na conta `2200 — Valores devidos a participantes`;
- detalhamento por participante;
- dimensão da unidade, produto ou serviço e contrato;
- moeda original, valor original e taxa de câmbio preservados.

Quando a moeda contratual difere da moeda funcional da LANDER SOLUTIONS, a função usa a cotação ativa mais recente até a data de competência. A ausência de cotação bloqueia a consolidação.

## Documento financeiro e obrigação

Para cada participante com valor líquido positivo, a consolidação cria:

1. uma linha de crédito individual no ledger;
2. um documento financeiro de contas a pagar;
3. uma linha financeira classificada;
4. uma obrigação de repasse vinculada exclusivamente a esse documento.

O documento é criado em rascunho, recebe sua linha e somente depois é marcado como aprovado. Isso respeita a imutabilidade do núcleo financeiro.

## Reconciliação de pagamentos

O pagamento de repasse exige uma liquidação financeira:

- postada;
- vinculada exatamente ao documento financeiro da obrigação;
- na mesma moeda;
- ainda não utilizada em outro pagamento de repasse;
- com valor compatível com o saldo da obrigação.

A interface não aceita UUID digitado manualmente. A Edge Function lista somente as liquidações elegíveis para aquela obrigação.

## Permissões

Permissões implementadas:

- `participation.read`;
- `participation.manage`;
- `participation.approve`;
- `participation.post`;
- `payout.read`;
- `payout.manage`.

Papéis inicialmente habilitados:

- proprietário;
- administrador corporativo;
- gestor financeiro;
- gestor de participações.

As políticas RLS consideram a unidade gerencial vinculada ao registro.

## Segurança

- tabelas com RLS;
- nenhum privilégio para `anon`;
- RPCs sensíveis revogadas de `public`, `anon` e `authenticated`;
- execução privilegiada somente por `service_role` dentro da Edge Function;
- JWT obrigatório;
- MFA `aal2` obrigatório;
- controle de concorrência otimista por `version`;
- trilha de auditoria nas tabelas da fase;
- autoaprovação bloqueada;
- memória submetida imutável;
- documentos e liquidações consolidados protegidos por guards de transição explícitos.

O advisor de segurança do Supabase não apresentou alertas após as migrations.

## Interface

A rota `/participacoes` contém:

- indicadores de apurações, aprovações, repasses reconhecidos e pagos;
- abas de apurações e repasses;
- filtros por busca, status e workspace de unidade;
- ações explícitas **Criar**, **Ver**, **Editar** e **Excluir**;
- modal de cálculo, submissão, aprovação, rejeição e consolidação;
- memória por participante;
- obrigações com valor, pago, saldo e vencimento;
- modal de pagamento com seleção restrita às liquidações elegíveis.

## Migrations

Foram versionadas:

1. `20260731144412_participation_calculations_and_payouts_foundation.sql`;
2. `20260731144656_participation_managerial_account.sql`;
3. `20260731144727_participation_calculation_actions.sql`;
4. `20260731144802_participation_posting_and_payout_actions.sql`;
5. `20260731144930_index_participation_and_payout_foreign_keys.sql`;
6. `20260731152322_harden_participation_payout_reconciliation.sql`;
7. `20260731152638_fix_generated_participation_document_amount.sql`;
8. `20260731152805_order_participation_document_lifecycle.sql`;
9. `20260731152937_preserve_submitted_participation_memory.sql`;
10. `20260731153108_fix_financial_settlement_transition_guard.sql`;
11. `20260731153450_fix_financial_document_transition_guard.sql`.

## Teste transacional

Foi executado um cenário completo dentro de `BEGIN` e `ROLLBACK` com dois usuários temporários distintos:

- criação de participante;
- contrato de participação em rascunho;
- inclusão do participante antes da aprovação;
- aprovação da versão contratual;
- ativação do contrato;
- criação do período financeiro;
- apuração com base distribuível de R$ 5.000,00;
- participação de 40%;
- participação bruta de R$ 2.000,00;
- retenção de 10%, equivalente a R$ 200,00;
- repasse líquido de R$ 1.800,00;
- tentativa de autoaprovação bloqueada;
- aprovação por usuário distinto;
- ledger balanceado em R$ 1.800,00 a débito e crédito;
- documento financeiro e obrigação gerados;
- liquidação financeira submetida e postada;
- pagamento de repasse reconciliado;
- obrigação finalizada como paga em R$ 1.800,00.

O `ROLLBACK` foi confirmado: nenhum usuário, contrato, apuração ou conta financeira de teste permaneceu no banco.

## Validação da aplicação

Pipeline aprovada com:

- formatação;
- lint;
- typecheck;
- testes unitários;
- build de produção.

## Pendência de homologação humana

O ambiente ainda não possui o primeiro proprietário real nem dados financeiros reais. A homologação funcional final exige:

1. bootstrap do proprietário;
2. MFA `aal2` ativo;
3. dois usuários reais para validar segregação de funções;
4. contrato real aprovado;
5. período financeiro real aberto;
6. apuração e liquidação de homologação.

Essa pendência não bloqueia a aprovação técnica da fase, mas bloqueia promoção para produção.
