do $$
declare
  r record;
  v_index_name text;
begin
  for r in
    with foreign_keys as (
      select
        c.oid,
        n.nspname as schema_name,
        rel.relname as table_name,
        c.conname,
        c.conrelid,
        c.conkey,
        string_agg(quote_ident(a.attname), ', ' order by k.ordinality) as columns_sql
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      cross join lateral unnest(c.conkey) with ordinality as k(attnum, ordinality)
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where c.contype = 'f'
        and n.nspname = 'public'
      group by c.oid,n.nspname,rel.relname,c.conname,c.conrelid,c.conkey
    )
    select fk.*
    from foreign_keys fk
    where not exists (
      select 1
      from pg_index i
      where i.indrelid = fk.conrelid
        and i.indisvalid
        and i.indisready
        and i.indnkeyatts >= cardinality(fk.conkey)
        and (
          select array_agg(v order by ordinality)
          from unnest(i.indkey::smallint[]) with ordinality as x(v, ordinality)
          where ordinality <= cardinality(fk.conkey)
        ) = fk.conkey
    )
    order by fk.table_name,fk.conname
  loop
    v_index_name := left(r.table_name || '_' || r.conname, 49)
      || '_' || substr(md5(r.schema_name || '.' || r.table_name || '.' || r.conname), 1, 8)
      || '_idx';
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      v_index_name,
      r.schema_name,
      r.table_name,
      r.columns_sql
    );
  end loop;
end
$$;
