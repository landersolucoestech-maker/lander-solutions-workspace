#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="lander-solutions"
VALIDATION_PROFILE="${VALIDATION_PROFILE:-development}"
RESTORE_DATABASE="lander_restore_validation"
RESTORE_USER="supabase_admin"
BACKUP_FILE="/tmp/lander-solutions.backup"
LOCAL_MIGRATION_COUNT="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d '[:space:]')"

if command -v supabase >/dev/null 2>&1; then
  SUPABASE_CLI=(supabase)
elif [[ -x node_modules/.bin/supabase.exe ]]; then
  SUPABASE_CLI=(node_modules/.bin/supabase.exe)
else
  echo "Supabase CLI not found in PATH or node_modules/.bin." >&2
  exit 1
fi

case "$VALIDATION_PROFILE" in
  development | staging | production) ;;
  *)
    echo "Perfil inválido: $VALIDATION_PROFILE. Use development, staging ou production." >&2
    exit 1
    ;;
esac

if [[ "$VALIDATION_PROFILE" == "production" ]]; then
  if ! grep -RFlq "PRODUCTION_AUTH_RESTORED" supabase/migrations; then
    echo "Validação de produção bloqueada: migration PRODUCTION_AUTH_RESTORED ausente." >&2
    exit 1
  fi
fi

cleanup() {
  if [[ -n "${DB_CONTAINER:-}" ]]; then
    docker exec "$DB_CONTAINER" dropdb --username "$RESTORE_USER" --if-exists "$RESTORE_DATABASE" >/dev/null 2>&1 || true
    docker exec "$DB_CONTAINER" rm -f "$BACKUP_FILE" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

"${SUPABASE_CLI[@]}" db lint --local --level error
"${SUPABASE_CLI[@]}" test db

DB_CONTAINER="$(docker ps --format '{{.ID}} {{.Names}}' | awk '$2 ~ /^supabase_db_/ {print $1; exit}')"
if [[ -z "$DB_CONTAINER" ]]; then
  echo "Não foi possível localizar o container PostgreSQL do Supabase local." >&2
  exit 1
fi

docker exec "$DB_CONTAINER" pg_dump \
  --username postgres \
  --dbname postgres \
  --format custom \
  --no-owner \
  --file "$BACKUP_FILE"

docker exec "$DB_CONTAINER" dropdb --username "$RESTORE_USER" --if-exists "$RESTORE_DATABASE"
docker exec "$DB_CONTAINER" createdb --username "$RESTORE_USER" "$RESTORE_DATABASE"
docker exec "$DB_CONTAINER" pg_restore \
  --username "$RESTORE_USER" \
  --dbname "$RESTORE_DATABASE" \
  --no-owner \
  --exit-on-error \
  "$BACKUP_FILE"

db_query() {
  docker exec "$DB_CONTAINER" psql \
    --username "$RESTORE_USER" \
    --dbname "$RESTORE_DATABASE" \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    --command "$1"
}

db_scalar() {
  db_query "$1" | tr -d '[:space:]'
}

validate_postgres_function_defaults() {
  local probe_sql
  probe_sql="$(cat <<'SQL'
begin;

create schema __acl_probe authorization postgres;
set local role postgres;

create function __acl_probe.postgres_function_default_probe() returns integer
language sql
as 'select 1';

do $probe$
declare
  probe_oid oid;
  exposed boolean;
begin
  select p.oid
  into strict probe_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = '__acl_probe'
    and p.proname = 'postgres_function_default_probe';

  select
    has_function_privilege('anon', probe_oid, 'execute')
    or has_function_privilege('authenticated', probe_oid, 'execute')
    or exists (
      select 1
      from aclexplode(
        coalesce(
          (select proacl from pg_proc where oid = probe_oid),
          acldefault('f', (select proowner from pg_proc where oid = probe_oid))
        )
      ) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    )
  into exposed;

  if exposed then
    raise exception 'Nova função de postgres nasceu executável por papéis clientes';
  end if;
end
$probe$;

rollback;
SQL
)"

  db_query "$probe_sql" >/dev/null
}

PUBLIC_TABLES="$(db_scalar "select count(*) from pg_tables where schemaname = 'public';")"
UNPROTECTED_TABLES="$(db_scalar "select count(*) from pg_tables where schemaname = 'public' and rowsecurity = false;")"
ANON_GRANTS="$(db_scalar "select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon';")"
ANON_POLICIES="$(db_scalar "select count(*) from pg_policies where 'anon' = any(roles);")"
EXPOSED_ADMIN_RPCS="$(db_scalar "select count(*) from information_schema.role_routine_grants where specific_schema = 'public' and routine_name like 'admin_%' and grantee in ('PUBLIC', 'anon', 'authenticated');")"
MIGRATION_COUNT="$(db_scalar "select count(*) from supabase_migrations.schema_migrations;")"
UNINDEXED_FOREIGN_KEYS="$(db_scalar "
  select count(*)
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where con.contype = 'f'
    and nsp.nspname in ('public', 'private')
    and not exists (
      select 1
      from pg_index idx
      where idx.indrelid = con.conrelid
        and idx.indisvalid
        and idx.indisready
        -- A supporting btree must start with every FK column in the same order.
        -- A partial index is valid when its predicate only omits null FK rows.
        and (idx.indkey::smallint[])[0:cardinality(con.conkey) - 1] = con.conkey
    );
")"
UNINDEXED_FOREIGN_KEY_DETAILS="$(db_query "
  select coalesce(
    string_agg(
      format(
        '%I.%I constraint=%I columns=(%s)',
        nsp.nspname,
        rel.relname,
        con.conname,
        (select string_agg(att.attname, ', ' order by key_column.ordinality)
         from unnest(con.conkey) with ordinality key_column(attnum, ordinality)
         join pg_attribute att
           on att.attrelid=con.conrelid and att.attnum=key_column.attnum)
      ),
      '; ' order by nsp.nspname, rel.relname, con.conname
    ),
    '<none>'
  )
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where con.contype = 'f'
    and nsp.nspname in ('public', 'private')
    and not exists (
      select 1
      from pg_index idx
      where idx.indrelid = con.conrelid
        and idx.indisvalid
        and idx.indisready
        and (idx.indkey::smallint[])[0:cardinality(con.conkey) - 1] = con.conkey
    );
")"
UNSAFE_PUBLIC_EXECUTABLE_DEFINERS="$(db_scalar "
  with public_definers as (
    select p.*, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  )
  select count(*)
  from public_definers p
  where has_function_privilege('anon', p.oid, 'execute')
     or (
       has_function_privilege('authenticated', p.oid, 'execute')
       and (
         not coalesce(p.proconfig @> array['search_path=' || chr(34) || chr(34)], false)
         or position('auth.uid()' in p.definition) = 0
         or not (
           position('user_has_permission' in p.definition) > 0
           or position('require_permission' in p.definition) > 0
           or (
             position('aal2' in lower(p.definition)) > 0
             and position('.admin_' in p.definition) > 0
           )
         )
       )
     );
")"
PRIVATE_EXECUTABLE_DEFINERS="$(db_scalar "
  select count(*)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'development_private'
    and p.prosecdef
    and (
      has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute')
    );
")"
DUPLICATE_PERMISSIVE_POLICY_SQL="
  with expanded as (
    select schemaname, tablename, policyname, role_name, action
    from pg_policies
    cross join lateral unnest(roles) as role_name
    cross join lateral unnest(
      case cmd
        when 'ALL' then array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]
        else array[cmd]::text[]
      end
    ) as action
    where permissive = 'PERMISSIVE'
  ), duplicate_groups as (
    select
      schemaname,
      tablename,
      role_name,
      action,
      array_agg(policyname order by policyname) as policies
    from expanded
    group by schemaname, tablename, role_name, action
    having count(*) > 1
  )
"
DUPLICATE_PERMISSIVE_POLICY_GROUPS="$(db_scalar "
  ${DUPLICATE_PERMISSIVE_POLICY_SQL}
  select count(*) from duplicate_groups;
")"
DUPLICATE_PERMISSIVE_POLICY_DETAILS="$(db_query "
  ${DUPLICATE_PERMISSIVE_POLICY_SQL}
  select coalesce(
    string_agg(
      format(
        '%I.%I role=%s action=%s policies=[%s]',
        schemaname,
        tablename,
        role_name,
        action,
        array_to_string(policies, ',')
      ),
      '; ' order by schemaname, tablename, role_name, action
    ),
    '<none>'
  )
  from duplicate_groups;
")"
DEVELOPMENT_PRIVATE_EXISTS="$(db_scalar "select count(*) from pg_namespace where nspname = 'development_private';")"
DEVELOPMENT_PRIVATE_EXPOSED="$(db_scalar "
  select count(*)
  from unnest(string_to_array(coalesce(current_setting('pgrst.db_schemas', true), ''), ',')) as exposed(schema_name)
  where btrim(schema_name) = 'development_private';
")"
TEMPORARY_PUBLIC_RPCS_EXECUTABLE="$(db_scalar "
  select count(*)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(array[
      'create_fiscal_document_bundle',
      'dev_delete_hr_record',
      'dev_get_contact_form',
      'dev_save_contact_form',
      'dev_update_hr_document',
      'dev_update_hr_employee',
      'dev_update_hr_leave',
      'dev_update_hr_payment',
      'has_permission'
    ])
    and (
      has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute')
    );
")"
DANGEROUS_CLIENT_TABLE_GRANTS="$(db_scalar "
  select count(*)
  from information_schema.role_table_grants
  where table_schema in ('public', 'private')
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER');
")"
DANGEROUS_CLIENT_TABLE_GRANT_DETAILS="$(db_query "
  select coalesce(
    string_agg(
      format('%I.%I role=%s privilege=%s', table_schema, table_name, grantee, privilege_type),
      '; ' order by table_schema, table_name, grantee, privilege_type
    ),
    '<none>'
  )
  from information_schema.role_table_grants
  where table_schema in ('public', 'private')
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER');
")"
DANGEROUS_POSTGRES_DEFAULT_TABLE_PRIVILEGES="$(db_scalar "
  select count(*)
  from pg_default_acl d
  join pg_roles owner_role on owner_role.oid = d.defaclrole
  left join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(coalesce(d.defaclacl, acldefault(d.defaclobjtype, d.defaclrole))) x
  join pg_roles grantee_role on grantee_role.oid = x.grantee
  where owner_role.rolname = 'postgres'
    and n.nspname in ('public', 'private')
    and d.defaclobjtype = 'r'
    and grantee_role.rolname in ('anon', 'authenticated')
    and x.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER');
")"
DANGEROUS_POSTGRES_DEFAULT_TABLE_PRIVILEGE_DETAILS="$(db_query "
  select coalesce(
    string_agg(
      format(
        'owner=%s schema=%I role=%s privilege=%s',
        owner_role.rolname,
        n.nspname,
        grantee_role.rolname,
        x.privilege_type
      ),
      '; ' order by owner_role.rolname, n.nspname, grantee_role.rolname, x.privilege_type
    ),
    '<none>'
  )
  from pg_default_acl d
  join pg_roles owner_role on owner_role.oid = d.defaclrole
  left join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(coalesce(d.defaclacl, acldefault(d.defaclobjtype, d.defaclrole))) x
  join pg_roles grantee_role on grantee_role.oid = x.grantee
  where owner_role.rolname = 'postgres'
    and n.nspname in ('public', 'private')
    and d.defaclobjtype = 'r'
    and grantee_role.rolname in ('anon', 'authenticated')
    and x.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER');
")"
DIRECT_PRIVATE_TABLE_GRANTS="$(db_scalar "
  select count(*)
  from information_schema.role_table_grants
  where table_schema in ('private', 'development_private')
    and grantee in ('anon', 'authenticated');
")"
DIRECT_PRIVATE_TABLE_GRANT_DETAILS="$(db_query "
  select coalesce(
    string_agg(
      format('%I.%I role=%s privilege=%s', table_schema, table_name, grantee, privilege_type),
      '; ' order by table_schema, table_name, grantee, privilege_type
    ),
    '<none>'
  )
  from information_schema.role_table_grants
  where table_schema in ('private', 'development_private')
    and grantee in ('anon', 'authenticated');
")"
UNSAFE_CLIENT_VIEWS="$(db_scalar "
  select count(*)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('v', 'm')
    and (
      has_table_privilege('anon', c.oid, 'select')
      or has_table_privilege('authenticated', c.oid, 'select')
    )
    and not coalesce(c.reloptions @> array['security_invoker=true'], false);
")"
UNSAFE_CLIENT_VIEW_DETAILS="$(db_query "
  select coalesce(
    string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by n.nspname, c.relname),
    '<none>'
  )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('v', 'm')
    and (
      has_table_privilege('anon', c.oid, 'select')
      or has_table_privilege('authenticated', c.oid, 'select')
    )
    and not coalesce(c.reloptions @> array['security_invoker=true'], false);
")"
GLOBAL_PERMISSION_SCOPE_SAFE="$(db_scalar "
  select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='authorization_private' and p.proname='current_user_has_permission'
    and pg_get_functiondef(p.oid) like '%p_unit_code is null and ura.unit_code is null%'
    and pg_get_functiondef(p.oid) like '%p_unit_code is not null%';
")"
if (( GLOBAL_PERMISSION_SCOPE_SAFE != 1 )); then
  echo "Autorização insegura: escopo global aceita atribuição restrita a unidade." >&2
  exit 1
fi


ANON_STORAGE_READ_POLICY_COUNT="$(db_scalar "
  select count(*)
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd = 'SELECT'
    and 'anon' = any(roles);
")"
SAFE_ANON_STORAGE_READ_POLICY_COUNT="$(db_scalar "
  select count(*)
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'dev_public_document_read'
    and cmd = 'SELECT'
    and 'anon' = any(roles)
    and qual like '%financial-fiscal-documents%'
    and qual like '%public-dev/%'
    and qual not like '%hr-documents%'
    and qual not like '%bucket_id = ANY%';
")"

if (( ANON_STORAGE_READ_POLICY_COUNT != 1 )); then
  echo "Storage inseguro: esperada uma única política anônima de leitura; encontradas $ANON_STORAGE_READ_POLICY_COUNT." >&2
  exit 1
fi
if (( SAFE_ANON_STORAGE_READ_POLICY_COUNT != 1 )); then
  echo "Storage inseguro: leitura anônima não está limitada ao prefixo fiscal public-dev/." >&2
  exit 1
fi

if (( PUBLIC_TABLES < 100 )); then
  echo "Restauração incompleta: apenas $PUBLIC_TABLES tabelas públicas." >&2
  exit 1
fi
if (( UNPROTECTED_TABLES != 0 )); then
  echo "Restauração insegura: $UNPROTECTED_TABLES tabelas públicas sem RLS." >&2
  exit 1
fi
if (( EXPOSED_ADMIN_RPCS != 0 )); then
  echo "Restauração insegura: $EXPOSED_ADMIN_RPCS RPCs administrativas expostas." >&2
  exit 1
fi
if (( MIGRATION_COUNT != LOCAL_MIGRATION_COUNT )); then
  echo "Histórico divergente: $MIGRATION_COUNT migrations restauradas para $LOCAL_MIGRATION_COUNT arquivos locais." >&2
  exit 1
fi
if (( UNINDEXED_FOREIGN_KEYS != 0 )); then
  echo "FK index details: $UNINDEXED_FOREIGN_KEY_DETAILS" >&2
  echo "Banco incompleto: $UNINDEXED_FOREIGN_KEYS chaves estrangeiras sem índice de cobertura." >&2
  exit 1
fi
if (( UNSAFE_PUBLIC_EXECUTABLE_DEFINERS != 0 )); then
  echo "Banco inseguro: $UNSAFE_PUBLIC_EXECUTABLE_DEFINERS funções públicas SECURITY DEFINER sem proteção suficiente." >&2
  exit 1
fi
if (( DUPLICATE_PERMISSIVE_POLICY_GROUPS != 0 )); then
  echo "Banco ineficiente: $DUPLICATE_PERMISSIVE_POLICY_GROUPS grupos de políticas permissivas duplicadas." >&2
  echo "Detalhes: $DUPLICATE_PERMISSIVE_POLICY_DETAILS" >&2
  exit 1
fi
if (( DEVELOPMENT_PRIVATE_EXPOSED != 0 )); then
  echo "Banco inseguro: development_private está exposto pelo Data API." >&2
  exit 1
fi
if (( DANGEROUS_CLIENT_TABLE_GRANTS != 0 )); then
  echo "Banco inseguro: $DANGEROUS_CLIENT_TABLE_GRANTS privilégios DDL de tabela concedidos a clientes." >&2
  echo "Detalhes: $DANGEROUS_CLIENT_TABLE_GRANT_DETAILS" >&2
  exit 1
fi
if (( DANGEROUS_POSTGRES_DEFAULT_TABLE_PRIVILEGES != 0 )); then
  echo "Banco inseguro: $DANGEROUS_POSTGRES_DEFAULT_TABLE_PRIVILEGES privilégios DDL retornariam em novas tabelas de postgres." >&2
  echo "Detalhes: $DANGEROUS_POSTGRES_DEFAULT_TABLE_PRIVILEGE_DETAILS" >&2
  exit 1
fi
if (( DIRECT_PRIVATE_TABLE_GRANTS != 0 )); then
  echo "Banco inseguro: $DIRECT_PRIVATE_TABLE_GRANTS grants diretos de tabela existem em schemas privados." >&2
  echo "Detalhes: $DIRECT_PRIVATE_TABLE_GRANT_DETAILS" >&2
  exit 1
fi
if (( UNSAFE_CLIENT_VIEWS != 0 )); then
  echo "Banco inseguro: $UNSAFE_CLIENT_VIEWS views acessíveis a clientes não usam security_invoker." >&2
  echo "Detalhes: $UNSAFE_CLIENT_VIEW_DETAILS" >&2
  exit 1
fi
if ! validate_postgres_function_defaults; then
  echo "Banco inseguro: novas funções de postgres herdam EXECUTE para papéis clientes." >&2
  exit 1
fi

if [[ "$VALIDATION_PROFILE" == "development" ]]; then
  if (( ANON_GRANTS == 0 || ANON_POLICIES == 0 )); then
    echo "Runtime de desenvolvimento incompleto: grants ou políticas anônimas temporárias ausentes." >&2
    exit 1
  fi
  if (( DEVELOPMENT_PRIVATE_EXISTS != 1 )); then
    echo "Runtime de desenvolvimento incompleto: schema development_private ausente." >&2
    exit 1
  fi
  if (( PRIVATE_EXECUTABLE_DEFINERS != 9 )); then
    echo "Runtime de desenvolvimento divergente: esperadas 9 implementações privilegiadas isoladas, encontradas $PRIVATE_EXECUTABLE_DEFINERS." >&2
    exit 1
  fi
  if (( TEMPORARY_PUBLIC_RPCS_EXECUTABLE != 9 )); then
    echo "Runtime de desenvolvimento divergente: esperados 9 wrappers públicos temporários, encontrados $TEMPORARY_PUBLIC_RPCS_EXECUTABLE." >&2
    exit 1
  fi
else
  if (( ANON_GRANTS != 0 || ANON_POLICIES != 0 )); then
    echo "Produção insegura: $ANON_GRANTS grants e $ANON_POLICIES políticas anônimas permanecem." >&2
    exit 1
  fi
  if (( PRIVATE_EXECUTABLE_DEFINERS != 0 )); then
    echo "Produção insegura: $PRIVATE_EXECUTABLE_DEFINERS implementações privilegiadas temporárias permanecem executáveis." >&2
    exit 1
  fi
  if (( TEMPORARY_PUBLIC_RPCS_EXECUTABLE != 0 )); then
    echo "Produção insegura: $TEMPORARY_PUBLIC_RPCS_EXECUTABLE wrappers públicos temporários permanecem executáveis." >&2
    exit 1
  fi
fi

echo "Banco local aprovado no perfil $VALIDATION_PROFILE: $PUBLIC_TABLES tabelas, $MIGRATION_COUNT migrations, RLS integral, 0 FKs sem índice, 0 definers públicos inseguros, 0 políticas permissivas duplicadas, 0 privilégios DDL de tabela para clientes, 0 grants privados diretos, views seguras e defaults efetivos de funções restritos em $PROJECT_ID."
