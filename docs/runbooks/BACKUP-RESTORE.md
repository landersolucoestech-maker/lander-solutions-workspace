# Runbook — Backup e Restauração

## Objetivo

Validar que o banco do Sistema Central LANDER SOLUTIONS pode ser reconstruído por migrations e restaurado a partir de backup sem perder estrutura, dados, RLS, grants, revogações e restrições administrativas.

## Ambiente permitido

- desenvolvimento local;
- Supabase de desenvolvimento;
- ambiente de homologação isolado.

É proibido executar testes destrutivos no Supabase de produção.

## Validação automatizada no CI

O workflow `.github/workflows/ci.yml` executa:

1. inicialização do banco Supabase local;
2. aplicação integral das migrations;
3. `supabase db lint --local --level error`;
4. testes pgTAP em `supabase/tests/database`;
5. `pg_dump` no formato custom com ACLs preservadas;
6. criação de banco temporário separado pelo papel administrativo local `supabase_admin`;
7. `pg_restore --exit-on-error` com ACLs preservadas;
8. validação de tabelas, migrations, RLS, privilégios `anon` e exposição de RPCs administrativas;
9. remoção do banco temporário e do arquivo de backup.

Script: `scripts/validate-local-database.sh`.

## Baseline validado

No workflow `30671936723`, run `619`:

- 64 migrations foram reproduzidas;
- 63 testes pgTAP foram aprovados;
- o lint SQL foi aprovado;
- o backup custom foi gerado;
- a restauração isolada foi concluída;
- 95 tabelas públicas foram recuperadas;
- nenhuma tabela pública ficou sem RLS;
- nenhum privilégio de tabela para `anon` foi restaurado;
- nenhuma RPC administrativa ficou exposta.

## Backup manual controlado

Executar somente no ambiente autorizado:

```bash
supabase db start
DB_CONTAINER="$(docker ps --format '{{.ID}} {{.Names}}' | awk '$2 ~ /^supabase_db_/ {print $1; exit}')"
docker exec "$DB_CONTAINER" pg_dump \
  --username postgres \
  --dbname postgres \
  --format custom \
  --no-owner \
  --file /tmp/lander-solutions.backup
```

Não usar `--no-privileges`: o backup precisa preservar ACLs, grants e revogações.

## Restauração de validação

No ambiente local Supabase, utilizar o papel administrativo interno somente para o banco descartável:

```bash
docker exec "$DB_CONTAINER" dropdb \
  --username supabase_admin \
  --if-exists lander_restore_validation

docker exec "$DB_CONTAINER" createdb \
  --username supabase_admin \
  lander_restore_validation

docker exec "$DB_CONTAINER" pg_restore \
  --username supabase_admin \
  --dbname lander_restore_validation \
  --no-owner \
  --exit-on-error \
  /tmp/lander-solutions.backup
```

O papel `supabase_admin` deste procedimento pertence exclusivamente à stack local. Credenciais administrativas remotas não devem ser expostas nem incorporadas ao script.

## Verificações obrigatórias

- todas as migrations presentes;
- nenhuma tabela pública sem RLS;
- nenhum privilégio de tabela para `anon`;
- nenhuma RPC `admin_%` executável por `PUBLIC`, `anon` ou `authenticated`;
- nenhuma função pública elevada executável por autenticados;
- ledger balanceado;
- eventos imutáveis preservados;
- unidades oficiais preservadas;
- referências de produção ausentes no runtime de desenvolvimento;
- ACLs iguais às do banco de origem.

## Critério de aprovação

A restauração só é considerada válida quando o script termina com código zero e confirma as contagens de tabelas e migrations, RLS integral, ACLs seguras e ausência de RPCs administrativas expostas.

## Produção

Antes do primeiro deploy produtivo, o proprietário real deve aprovar:

- política de retenção;
- frequência dos backups;
- destino criptografado;
- responsáveis autorizados;
- RPO e RTO;
- teste documentado de restauração em ambiente isolado;
- procedimento de rotação e proteção das credenciais de backup.
