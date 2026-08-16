# Fase 7 — Contratos, versões e participações

## Situação

**Concluída e validada tecnicamente no ambiente de desenvolvimento.**

A fase substituiu o protótipo hardcoded de contratos por um domínio persistido, versionado, auditável e protegido por autorização em banco e Edge Function. Nenhuma alteração foi executada no Supabase de produção.

## Ambiente utilizado

- Repositório: `landersolucoestech-maker/lander-solutions`
- Branch GitHub: `dev`
- Supabase de desenvolvimento: `jodzhcktrlwinywqgbab`
- Edge Function: `admin-contracts`
- Verificação JWT: habilitada
- PR: rascunho nº 1, sem promoção para `main`

## Objetivo do domínio

O módulo registra contratos celebrados pela única pessoa jurídica, **LANDER SOLUTIONS LTDA.**, mantendo separação gerencial por:

- unidade de negócio;
- produto;
- linha de serviço;
- contraparte;
- moeda;
- regime de reconhecimento;
- vigência;
- versão econômica.

A unidade, o produto ou o serviço não se tornam uma nova pessoa jurídica. Eles identificam o objeto gerencial ao qual receitas, custos, obrigações e participações deverão ser atribuídos.

## Estrutura entregue

### Contratos

A tabela `public.contracts` registra:

- pessoa jurídica;
- unidade gerencial;
- produto ou linha de serviço;
- código e título;
- tipo contratual;
- moeda;
- periodicidade de cobrança;
- valor base;
- regime de reconhecimento;
- vigência e renovação;
- responsável;
- situação;
- observações;
- versão de concorrência.

O banco impede a associação de um produto ou serviço a uma unidade diferente da unidade do contrato.

### Partes contratuais

A tabela `public.contract_parties` vincula os cadastros corporativos da Fase 6 como:

- contraparte;
- cliente;
- fornecedor;
- participante;
- investidor;
- beneficiário;
- garantidor;
- signatário;
- prestador de serviço;
- outro papel.

Cada contrato pode possuir uma contraparte principal ativa. A ativação exige que essa contraparte exista.

### Versões econômicas

A tabela `public.contract_versions` preserva as condições econômicas aplicáveis em cada período.

Cada versão registra:

- número e vigência;
- motivo da alteração;
- base de cálculo;
- componentes incluídos e excluídos;
- regra de prejuízo;
- regra de investimento;
- método e valor de reserva;
- casas de arredondamento;
- permissão para bases distintas;
- prazo de pagamento;
- solicitante, aprovador e aprovação.

Uma versão aprovada não pode ser sobrescrita. A única transição permitida para ela é `approved` → `superseded`, sem alteração dos termos econômicos. Componentes, participantes, obrigações e documentos vinculados a versões aprovadas ou substituídas também ficam imutáveis.

### Componentes tipados da fórmula

A tabela `public.contract_formula_components` implementa memória de cálculo por componentes controlados.

O sistema não oferece campo para:

- SQL livre;
- JavaScript;
- expressão executável;
- código enviado pelo usuário;
- fórmula textual interpretada dinamicamente.

Os componentes são escolhidos de uma enumeração controlada, incluindo:

- receitas por produto, plano, canal, país ou moeda;
- descontos;
- cancelamentos;
- reembolsos;
- chargebacks;
- impostos;
- taxas de pagamento;
- custos diretos;
- despesas exclusivas ou compartilhadas;
- investimentos recuperáveis;
- reservas;
- contingências;
- reinvestimentos;
- prejuízos acumulados;
- receitas e despesas específicas;
- adiantamentos;
- compensações.

Cada item possui operação, base de reconhecimento, escopo do filtro e sequência.

### Participações por versão

A tabela `public.contract_version_participants` registra:

- participante;
- percentual;
- prioridade;
- valor mínimo e máximo;
- retenção;
- condição de elegibilidade;
- situação.

Quando a versão não permite bases distintas, a soma dos percentuais ativos não pode ultrapassar 100%. Essa regra é garantida por trigger no banco, não apenas pela interface.

### Obrigações

A tabela `public.contract_obligations` registra:

- entregas;
- pagamentos;
- relatórios;
- SLA;
- confidencialidade;
- conformidade;
- renovação;
- avisos;
- outras obrigações.

Ela suporta responsável, regra de vencimento, data, recorrência e valor monetário opcional.

### Documentos

A tabela `public.contract_documents` armazena metadados e referências de armazenamento de:

- contrato principal;
- aditivo;
- anexo;
- proposta;
- evidência de assinatura;
- evidência de aprovação;
- outros documentos.

A aprovação de uma versão exige documento principal com situação `uploaded` ou `verified`.

### Aprovações

A tabela `public.contract_approvals` registra a decisão, o solicitante, o aprovador, a data e o motivo.

A segregação de funções é obrigatória:

- a versão precisa ser enviada para aprovação por um solicitante identificado;
- o solicitante não pode aprovar a própria versão;
- a aprovação exige permissão específica e MFA `aal2`;
- a decisão ocorre pela Edge Function administrativa.

## Ciclo de vida

### Contrato

- `draft`;
- `in_review`;
- `pending_signature`;
- `active`;
- `renewal`;
- `expired`;
- `terminated`;
- `cancelled`.

Rascunhos sem vínculos podem ser excluídos fisicamente. Contratos com partes, versões ou histórico são cancelados ou encerrados, preservando os registros relacionados.

### Versão

- `draft`;
- `in_review`;
- `approved`;
- `superseded`;
- `rejected`.

Somente versões em rascunho, revisão ou rejeitadas podem ser alteradas. Versões aprovadas e substituídas são imutáveis.

## Permissões

Foram criadas:

- `contracts.read`;
- `contracts.create`;
- `contracts.update_draft`;
- `contracts.approve`;
- `contracts.terminate`;
- `contracts.documents.manage`.

A matriz foi atribuída aos papéis corporativos conforme responsabilidade. Leitura, criação, alteração de rascunho, aprovação, encerramento e gestão documental são permissões independentes.

## RLS e privilégios

As oito tabelas possuem RLS habilitada:

- `contracts`;
- `contract_parties`;
- `contract_versions`;
- `contract_formula_components`;
- `contract_version_participants`;
- `contract_obligations`;
- `contract_documents`;
- `contract_approvals`.

O papel `anon` possui zero privilégios nessas tabelas.

As sete tabelas mutáveis possuem políticas separadas de seleção, inclusão, alteração e exclusão. `contract_approvals` é somente leitura para usuários autenticados; suas mutações ocorrem exclusivamente pela rotina administrativa.

## Ações administrativas protegidas

As RPCs administrativas são executáveis somente por `postgres` e `service_role`:

- `admin_approve_contract_version`;
- `admin_activate_contract`;
- `admin_terminate_contract`.

Elas não podem ser chamadas diretamente pelo papel `authenticated`.

A Edge Function `admin-contracts` está ativa com JWT obrigatório e executa:

1. validação do token e da sessão;
2. confirmação de MFA `aal2`;
3. obtenção da unidade do contrato;
4. verificação de permissão do usuário autenticado;
5. chamada da RPC restrita usando `service_role` no servidor;
6. resposta sem cache.

O `service_role` não é enviado ao navegador.

## Interface entregue

A rota `/contratos` deixou de usar arrays locais e foi conectada ao Supabase.

Foram implementados:

- indicadores da carteira;
- busca e filtro por situação;
- criação de contrato;
- visualização detalhada;
- edição de rascunho;
- exclusão física segura;
- cancelamento ou encerramento com motivo;
- seleção de versão;
- criação de nova versão;
- envio para revisão;
- aprovação por usuário distinto;
- ativação do contrato;
- CRUD de partes;
- CRUD de versões editáveis;
- CRUD de participações;
- CRUD de componentes tipados;
- CRUD de obrigações;
- CRUD de documentos;
- leitura da trilha de aprovação;
- modais explícitos para Criar, Ver, Editar e Excluir ou equivalente seguro;
- controle de concorrência por versão.

## Migrations

Aplicadas no Supabase `dev` e versionadas no GitHub:

- `20260731031857_contracts_participation_foundation.sql`;
- `20260731032102_harden_contract_administrative_actions.sql`;
- `20260731033740_align_contract_termination_lifecycle.sql`;
- `20260731033818_optimize_contract_policies_and_indexes.sql`.

## Validações executadas

### Pipeline GitHub

A execução nº 131 concluiu com sucesso:

- formatação no runner;
- lint;
- typecheck;
- testes unitários;
- build.

### Testes transacionais do banco

Uma transação descartável confirmou:

- bloqueio de produto pertencente a unidade diferente da unidade do contrato;
- criação de contrato válido;
- criação de componente tipado válido;
- bloqueio de filtro incompatível com seu escopo;
- bloqueio de soma de participações acima de 100%;
- bloqueio de exclusão física de contrato com vínculos;
- bloqueio de alteração de versão aprovada;
- bloqueio de inclusão de componentes em versão aprovada.

A transação foi revertida e nenhum dado de teste permaneceu salvo.

### Advisors e privilégios

- advisor de segurança sem alertas;
- políticas redundantes `FOR ALL` foram separadas por operação;
- FK `contracts.created_by` recebeu índice;
- RPCs administrativas confirmadas somente para `postgres` e `service_role`;
- Edge Function confirmada como `ACTIVE` e `verify_jwt=true`;
- avisos de performance restantes são informativos sobre índices ainda não usados em um banco sem carga operacional e sobre a estratégia global de conexões do Auth.

## Ressalva operacional

O Supabase de desenvolvimento ainda não possui usuários reais. Por isso, a homologação ponta a ponta de solicitação por um usuário e aprovação por outro depende do bootstrap controlado do proprietário, da criação de um segundo aprovador autorizado e da habilitação de MFA `aal2`.

Essa ressalva não altera a validação estrutural da fase, mas impede declarar a aprovação humana autenticada como homologada em ambiente real.

A Fase 7 permanece no PR em rascunho e não deve ser promovida para `main` ou produção antes dessa homologação.
