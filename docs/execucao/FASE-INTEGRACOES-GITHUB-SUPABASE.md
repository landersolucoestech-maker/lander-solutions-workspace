# Fase — Integrações GitHub e Supabase

## Situação

Implementação funcional no Supabase de desenvolvimento e na branch `dev`.

O escopo inicial é restrito a:

- GitHub;
- Supabase.

Não existe integração direta entre o banco corporativo e os bancos operacionais dos produtos. Credenciais não são armazenadas em texto puro: o sistema registra somente referências para um cofre externo.

## Entidades

- `integration_connections`;
- `integration_webhook_endpoints`;
- `integration_events`;
- `integration_sync_jobs`;
- `integration_job_attempts`.

## Conexões

- provedor restrito a `github` ou `supabase`;
- código e nome;
- conta, organização, repositório ou project ref externo;
- URL base;
- referência segura de credencial;
- configuração JSON;
- unidade opcional;
- saúde, última verificação e último erro;
- estados `draft`, `active`, `paused`, `error` e `archived`;
- ativação exige conta externa e referência de credencial;
- transições administrativas com concorrência otimista por `version`.

## Webhooks

- endpoint associado a uma conexão;
- `public_id` não sequencial;
- escopo de eventos;
- referência do segredo de assinatura;
- estados `draft`, `active`, `paused` e `archived`;
- ativação exige conexão ativa e segredo de assinatura configurado.

## Eventos

- ID externo opcional e idempotente por conexão;
- tipo, ocorrência, recebimento e hash do payload;
- payload e metadados JSON;
- tentativas e próximo retry;
- estados `pending`, `processing`, `processed`, `failed`, `dead_letter` e `ignored`;
- reprocessamento, classificação como ignorado e dead-letter por ação administrativa.

## Jobs

- tipo do job;
- chave idempotente global;
- metadados de solicitação e resultado;
- agendamento, início, término e retry;
- estados `queued`, `running`, `succeeded`, `failed`, `dead_letter` e `cancelled`;
- retry preserva a mesma chave idempotente;
- cancelamento e dead-letter exigem motivo formal.

## Tentativas

- número da tentativa;
- início e término;
- resultado;
- status HTTP, código e mensagem de erro;
- metadados da resposta;
- registros imutáveis.

## Segurança

- RLS em todas as cinco tabelas;
- nenhum privilégio para `anon`;
- privilégios acessórios `TRUNCATE`, `TRIGGER` e `REFERENCES` removidos;
- `authenticated` limitado ao CRUD permitido pelas policies;
- tentativas somente leitura para usuários;
- RPCs administrativas somente para `service_role`;
- Edge Function `admin-integrations` com JWT obrigatório;
- MFA `aal2` obrigatório;
- verificação das permissões `integrations.manage`, `integrations.jobs.manage` e `integrations.events.manage`;
- advisor de segurança sem alertas.

## Interface

Rota: `/integracoes`.

Ações por modais:

- criar, visualizar, editar e excluir conexões em rascunho;
- ativar, pausar, retomar e arquivar conexões;
- criar, visualizar, editar e excluir webhooks em rascunho;
- ativar, pausar, retomar e arquivar webhooks;
- criar jobs manuais com chave idempotente;
- consultar jobs e tentativas;
- reprocessar, cancelar e mover jobs para dead-letter;
- consultar payloads e metadados de eventos;
- reprocessar, ignorar e mover eventos para dead-letter.

## Migrations

- `20260731203733_github_supabase_integrations_foundation.sql`;
- `20260731203808_integration_administrative_lifecycle.sql`;
- `20260731204941_restrict_integration_table_privileges.sql`.

## Validação

- teste transacional executado e revertido com `ROLLBACK`;
- provedor não autorizado rejeitado;
- ativação de conexão validada;
- duplicidade de chave idempotente rejeitada;
- retry de job validado;
- imutabilidade de tentativas validada;
- advisor de segurança sem alertas;
- produção e branch `main` não alteradas.
