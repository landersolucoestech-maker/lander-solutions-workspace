# CRM e Projetos — etapa pendente do plano mestre

## Situação

**Implementada e validada tecnicamente no ambiente de desenvolvimento.**

Esta etapa corrige a lacuna identificada após a Fase 10: o plano mestre previa CRM, propostas, conversão comercial e rentabilidade de projetos, mas o repositório possuía somente o cadastro estrutural genérico de `projects`.

A implementação foi executada exclusivamente:

- no repositório `landersolucoestech-maker/lander-solutions`;
- na branch `dev`;
- no Supabase de desenvolvimento `jodzhcktrlwinywqgbab`;
- no PR nº 1, mantido em rascunho.

A branch `main` e o Supabase de produção não foram alterados.

## Escopo implementado

O domínio comercial agora cobre:

- leads;
- qualificação e conversão em cliente;
- oportunidades;
- pipeline por unidade gerencial;
- histórico de mudanças de etapa;
- propostas;
- versões econômicas de proposta;
- itens, entregáveis e marcos;
- custos, receita, lucro e margem estimados;
- aprovação segregada;
- envio, aceite e rejeição;
- conversão da venda em projeto;
- escopo operacional do projeto;
- atividades e follow-ups;
- rentabilidade planejada e realizada.

## Estrutura persistida

Foram criadas as tabelas:

- `crm_pipeline_stages`;
- `crm_leads`;
- `crm_opportunities`;
- `crm_opportunity_stage_history`;
- `crm_proposals`;
- `crm_proposal_versions`;
- `crm_proposal_items`;
- `crm_project_profiles`;
- `crm_project_scope_items`;
- `crm_activities`.

A visão `crm_project_profitability` combina o orçamento comercial com os lançamentos postados no ledger por `project_id`.

## Pipeline

Cada unidade ativa recebeu as etapas iniciais:

1. Prospecção — 10%;
2. Qualificação — 25%;
3. Proposta — 50%;
4. Negociação — 75%;
5. Ganha — 100%;
6. Perdida — 0%.

O valor ponderado da oportunidade é calculado automaticamente por:

`valor estimado × probabilidade`

Toda mudança de etapa gera histórico com data e responsável.

## Leads e clientes

Um lead pertence a uma unidade e pode apontar para exatamente um produto ou uma linha de serviço.

A qualificação administrativa:

1. valida o estado e o escopo do lead;
2. cria ou utiliza uma `party`;
3. atribui o papel `client`;
4. cria uma oportunidade na etapa de qualificação;
5. marca o lead como convertido;
6. preserva o vínculo entre lead, cliente e oportunidade.

A conversão é idempotente por estado e não permite recriar o mesmo fluxo a partir de um lead encerrado.

## Propostas versionadas

Cada proposta possui versões econômicas com:

- moeda;
- itens;
- quantidade;
- preço unitário;
- custo unitário estimado;
- horas planejadas;
- desconto;
- impostos;
- validade;
- condições de pagamento;
- resumo do escopo;
- premissas;
- exclusões.

Os totais são derivados automaticamente dos itens:

- subtotal;
- custo estimado;
- valor total;
- lucro estimado;
- margem estimada.

Uma proposta não pode ser submetida sem item, valor positivo ou validade vigente.

Após a submissão, a versão e seus itens tornam-se economicamente imutáveis.

## Aprovação e segregação

O fluxo implementado é:

1. rascunho;
2. aguardando aprovação;
3. aprovada ou rejeitada;
4. enviada;
5. aceita ou recusada.

O criador ou solicitante não pode aprovar a própria proposta.

A rejeição exige motivo. Somente proposta aprovada pode ser enviada, e somente proposta enviada pode ser aceita ou recusada.

O aceite marca a oportunidade como ganha e a recusa registra a oportunidade como perdida.

## Conversão em projeto

Somente uma oportunidade ganha com proposta aceita pode ser convertida.

A conversão:

- reutiliza a tabela corporativa `projects`;
- cria `crm_project_profiles`;
- preserva oportunidade, proposta e versão aceita;
- copia a receita contratada e o custo planejado;
- calcula lucro e margem planejados;
- transforma itens de proposta em itens de escopo;
- bloqueia conversão duplicada da mesma oportunidade.

## Rentabilidade

O orçamento comercial contém:

- receita contratada;
- custo planejado;
- lucro planejado;
- margem planejada.

A visão realizada deriva do ledger postado:

- receita real;
- custo real;
- lucro real;
- margem real.

Não existe segundo ledger ou duplicação de resultados. O CRM somente referencia a dimensão `project_id` do núcleo financeiro.

## Atividades

As atividades podem ser vinculadas a exatamente um dos seguintes objetos:

- lead;
- oportunidade;
- proposta;
- projeto comercial.

São suportados:

- ligação;
- e-mail;
- reunião;
- tarefa;
- nota;
- follow-up.

Cada atividade possui prioridade, prazo, responsável, estado e resultado.

## Permissões

Foram implementadas:

- `crm.read`;
- `crm.leads.manage`;
- `crm.opportunities.manage`;
- `crm.proposals.manage`;
- `crm.proposals.approve`;
- `crm.projects.manage`;
- `crm.convert`.

Matriz inicial:

- proprietário e administrador corporativo: todas as permissões;
- comercial: leitura, leads, oportunidades, propostas e conversão;
- gestor de unidade: leitura, leads, oportunidades, propostas e projetos;
- financeiro, auditoria e perfis somente leitura: consulta.

As permissões respeitam o código da unidade gerencial.

## Segurança

- RLS ativa em todas as tabelas;
- nenhum privilégio para `anon`;
- funções sensíveis revogadas de `public`, `anon` e `authenticated`;
- execução administrativa somente por `service_role` dentro da Edge Function;
- JWT obrigatório;
- MFA `aal2` obrigatório;
- concorrência otimista por `version`;
- trilha de auditoria;
- validação de unidade, produto e serviço;
- versões submetidas imutáveis;
- autoaprovação bloqueada;
- conversão duplicada bloqueada;
- todas as FKs do domínio CRM cobertas por índices.

O advisor de segurança do Supabase retornou zero alertas.

## Edge Function

A função `admin-crm`, versão 1, está ativa com JWT obrigatório.

Ações disponíveis:

- `qualify-lead`;
- `submit-proposal`;
- `approve-proposal`;
- `reject-proposal`;
- `send-proposal`;
- `accept-proposal`;
- `reject-sent-proposal`;
- `close-opportunity-lost`;
- `convert-opportunity-project`.

Cada ação valida sessão, MFA `aal2`, permissão e unidade antes de chamar a RPC privilegiada.

## Interface

A rota `/crm` contém:

- KPIs comerciais;
- busca e filtro por unidade;
- aba de leads;
- aba de pipeline;
- aba de propostas;
- aba de projetos;
- aba de atividades;
- ações explícitas **Criar**, **Ver**, **Editar** e **Excluir** quando o estado permite;
- qualificação de lead;
- submissão e decisão de propostas;
- registro de envio e aceite;
- encerramento de oportunidade perdida;
- conversão em projeto;
- cadastro e manutenção de escopo;
- acompanhamento de margem planejada e realizada.

## Migrations

Foram versionadas:

1. `20260731164117_crm_pipeline_proposals_projects_foundation.sql`;
2. `20260731164245_crm_administrative_actions.sql`;
3. `20260731165628_index_crm_missing_foreign_keys.sql`.

## Teste transacional

Foi executado um cenário completo dentro de `BEGIN` e `ROLLBACK` com dois administradores temporários distintos:

- criação de lead;
- conversão em cliente;
- criação de oportunidade;
- proposta de R$ 10.000,00;
- custo planejado de R$ 6.000,00;
- lucro planejado de R$ 4.000,00;
- margem planejada de 40%;
- tentativa de autoaprovação bloqueada;
- aprovação por segundo usuário;
- envio e aceite da proposta;
- oportunidade marcada como ganha;
- conversão em projeto;
- cópia de um item de escopo.

O `ROLLBACK` foi confirmado. Permaneceram no banco:

- zero usuários de teste;
- zero leads de teste;
- zero propostas de teste;
- zero projetos de teste.

## Validação da aplicação

A pipeline aprovou:

- formatação;
- lint;
- typecheck;
- testes unitários;
- build de produção;
- verificação de dívida de formatação.
