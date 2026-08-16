# Fase — Auditoria e Rastreabilidade

## Situação

Implementação funcional conectada à tabela real `audit_events` no Supabase de desenvolvimento.

A rota `/auditoria` deixou de utilizar dados estáticos e passou a consultar diretamente a trilha imutável do sistema.

Nenhuma alteração foi executada na branch `main` ou no Supabase de produção.

## Interface implementada

- paginação com 25, 50, 100 ou 200 eventos por página;
- ordenação cronológica decrescente;
- busca por ação, schema, tabela, identificador da entidade e request ID;
- filtro por ação;
- filtro por tabela;
- filtro por UUID do ator;
- filtro por intervalo de datas;
- KPIs de inclusões, alterações, exclusões e total de eventos;
- visualização detalhada em modal;
- exibição do ator, sessão, entidade e request ID;
- comparação dos valores anteriores e posteriores;
- identificação dos campos alterados;
- exibição integral dos metadados persistidos.

## Segurança e autorização

- acesso condicionado à permissão global `audit.read` por RLS;
- `anon` sem qualquer privilégio;
- `authenticated` com somente `SELECT`, condicionado pela policy;
- `service_role` reduzido a somente `SELECT`;
- sequência da tabela sem privilégios para `anon`, `authenticated` e `service_role`;
- alterações e exclusões bloqueadas por trigger de imutabilidade;
- inserções realizadas exclusivamente pelas funções internas de auditoria com `security definer`.

## Índices utilizados

- `audit_events_pkey`;
- `audit_events_occurred_at_idx`;
- `audit_events_actor_idx`;
- `audit_events_entity_idx`.

## Migrations

- `20260731185842_harden_audit_event_immutability`;
- `20260731190024_restrict_audit_event_service_role_privileges`.

## Arquivos principais

- `src/features/audit/types.ts`;
- `src/features/audit/api.ts`;
- `src/features/audit/audit-page.tsx`;
- `src/routes/auditoria.tsx`.

## Validação

- advisor de segurança do Supabase sem alertas;
- RLS de leitura vinculada a `audit.read`;
- trigger `audit_events_immutable` ativo para `UPDATE` e `DELETE`;
- privilégios efetivos de `authenticated` e `service_role` limitados a `SELECT`;
- migrations remotas sincronizadas no repositório;
- CI obrigatório com formatação, lint, typecheck, testes e build.
