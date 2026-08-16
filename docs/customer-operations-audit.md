# Auditoria técnica — Atendimento e Suporte

Data: 2026-08-04
Branch auditada: `dev`

## Arquitetura existente

- Frontend: React 19, TanStack Start/Router/Query, TypeScript e componentes Radix/shadcn existentes.
- Backend: Supabase Edge Functions Deno com `@supabase/supabase-js` e RPCs PostgreSQL.
- Banco: PostgreSQL/Supabase, migrations SQL e RLS.
- Autenticação: Supabase Auth; temporariamente desativada no frontend de desenvolvimento.
- Autorização: `permissions`, `app_roles`, `role_permissions`, `user_role_assignments`, `has_permission`, escopo por código da unidade e MFA AAL2 para operações administrativas.
- Usuários/agentes: reutilização de `profiles` e RBAC existente.
- Produtos: reutilização de `products`, vinculados a `business_units` e `legal_entities`.
- Contatos e organizações: reutilização de `parties`, `party_contacts` e `party_company_contacts`.
- Auditoria: reutilização de `audit_events` e do trigger `private.audit_row_change()`.
- Storage: buckets privados existentes; será criado bucket privado próprio apenas quando anexos do atendimento forem implementados.
- Jobs: nenhum `pg_cron`, `pg_net` ou `pgmq` instalado no ambiente dev. Escalonamentos serão persistidos de forma idempotente e exigirão executor agendado explícito antes de produção.
- Contratos: o projeto não usa OpenAPI/codegen; os contratos do frontend são TypeScript manuais e o backend valida JSON nas Edge Functions.

## Reutilização obrigatória

- `legal_entities` é o equivalente de tenant interno.
- `products` é a fonte de verdade dos produtos; não será criada tabela duplicada de produtos.
- `profiles` é a fonte de verdade dos agentes.
- `parties` é a fonte de verdade de pessoas e organizações.
- O módulo deve ficar em `src/features/support`, rota `/atendimento` e Edge Function `admin-support`.

## Situação do código MusicChat de referência

O pacote de referência não pertence a este repositório. A evidência histórica disponível identifica nove arquivos: quatro componentes, dois hooks, uma página, um serviço e um arquivo de tipos.

### Responsabilidades observadas

- `EscalationRuleAccordionItem.tsx`: edição visual de tempo, nível, destinatário, canais e mensagem.
- `EscalationRulesEditor.tsx`: coleção e ordenação de regras de escalonamento.
- `MenuQueueAccordionItem.tsx`: edição de opção de triagem, fila textual, responsável textual, prioridade, template e tags.
- `TriageMenuBuilder.tsx`: criação, remoção e ordenação das opções do menu.
- `useMusicChatAutomationSettings.ts`: carregamento e mutação da configuração geral.
- `useMusicChatTriageRules.ts`: mutações e execução das regras de triagem/escalonamento.
- `MusicChatAutomationSettings.tsx`: página administrativa monolítica com mensagens, campos, menu, filas e escalonamentos.
- `musicchat-automation.service.ts`: cliente HTTP para endpoints de conversas e automação.
- `musicchat-automation.types.ts`: tipos simplificados do modelo antigo.

### Lógica aproveitável somente como conceito

- editor ordenável de opções;
- separação visual de mensagens, triagem e escalonamentos;
- prioridade e ativação por opção;
- prévia de configuração;
- hooks de leitura e mutação.

### Lógica descartada

- nomes `MusicChat`/`musicchat`;
- filas e responsáveis como texto;
- IDs gerados no navegador;
- `required_fields` e `optional_fields` como listas de strings;
- execução global de escalonamentos por botão;
- tipos `unknown` para conversas, opções e notificações;
- remoção automática de template ao excluir opção;
- conteúdo específico da Lander Records;
- fallback apresentado como se fosse dado persistido;
- menu textual duplicando a lista estruturada.

### Riscos do modelo antigo

- ausência de isolamento multiproduto/tenant;
- IDOR caso a autorização dependa do frontend;
- referências frágeis por texto;
- configuração publicada sem versionamento imutável;
- ausência de optimistic locking;
- escalonamentos sem idempotência e concorrência;
- formulário sem chaves estáveis e validações estruturadas;
- canais exibidos sem comprovação de integração;
- estados de loading e erro ambíguos;
- ausência de testes associados.

## Busca no repositório atual

Não foram encontrados `MusicChat`, `musicchat`, inbox, tickets, filas de suporte, conversas de atendimento ou automações equivalentes no runtime atual. Existem apenas estruturas genéricas reutilizáveis de CRM, usuários, produtos, contatos, integrações, auditoria e financeiro.

## Decisão arquitetural

Será criado o domínio genérico `support`/`customer operations`, sem copiar ou renomear o código antigo. A implementação seguirá a ordem: domínio, migration, backend, contratos do frontend, interface administrativa, caixa de entrada e testes.
