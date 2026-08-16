begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

select is(
  (
    with expanded as (
      select schemaname,tablename,policyname,role_name,action
      from pg_policies
      cross join lateral unnest(roles) role_name
      cross join lateral unnest(
        case cmd
          when 'ALL' then array['SELECT','INSERT','UPDATE','DELETE']::text[]
          else array[cmd]::text[]
        end
      ) action
      where permissive='PERMISSIVE'
    ), duplicate_groups as (
      select schemaname,tablename,role_name,action
      from expanded
      group by schemaname,tablename,role_name,action
      having count(*)>1
    )
    select count(*)::integer from duplicate_groups
  ),
  0,
  'RLS has no duplicate permissive policy branches per role and command'
);

select is(
  (
    select count(*)::integer
    from (
      select index_row.indrelid,index_row.indkey,
        coalesce(pg_get_expr(index_row.indpred,index_row.indrelid),'') predicate
      from pg_index index_row
      join pg_class table_row on table_row.oid=index_row.indrelid
      join pg_namespace schema_row on schema_row.oid=table_row.relnamespace
      where schema_row.nspname in ('public','private')
        and index_row.indisvalid
        and index_row.indisready
      group by index_row.indrelid,index_row.indkey,
        coalesce(pg_get_expr(index_row.indpred,index_row.indrelid),'')
      having count(*)>1
    ) duplicate_indexes
  ),
  0,
  'application schemas have no structurally identical indexes'
);

select is(
  (
    select count(*)::integer
    from pg_proc function_row
    join pg_namespace schema_row on schema_row.oid=function_row.pronamespace
    where schema_row.nspname='public'
      and function_row.prosecdef
      and has_function_privilege('anon',function_row.oid,'execute')
  ),
  0,
  'anon cannot execute a public SECURITY DEFINER function'
);

select cmp_ok(
  (
    select count(*)::integer
    from pg_proc function_row
    join pg_namespace schema_row on schema_row.oid=function_row.pronamespace
    where schema_row.nspname='public'
      and function_row.prosecdef
      and has_function_privilege('authenticated',function_row.oid,'execute')
  ),
  '>',
  0,
  'authenticated workflow RPCs remain intentionally callable'
);

select is(
  (
    with public_definers as (
      select function_row.*,pg_get_functiondef(function_row.oid) definition
      from pg_proc function_row
      join pg_namespace schema_row on schema_row.oid=function_row.pronamespace
      where schema_row.nspname='public' and function_row.prosecdef
    )
    select count(*)::integer
    from public_definers function_row
    where has_function_privilege('anon',function_row.oid,'execute')
       or (
         has_function_privilege('authenticated',function_row.oid,'execute')
         and (
           not coalesce(
             function_row.proconfig @> array['search_path='||chr(34)||chr(34)],false
           )
           or position('auth.uid()' in function_row.definition)=0
           or not (
             position('user_has_permission' in function_row.definition)>0
             or position('require_permission' in function_row.definition)>0
             or (
               position('aal2' in lower(function_row.definition))>0
               and position('.admin_' in function_row.definition)>0
             )
           )
         )
       )
  ),
  0,
  'client-callable definers have fixed search_path, caller identity, and authorization'
);

select * from finish();

rollback;
