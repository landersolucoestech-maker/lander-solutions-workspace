do $$
declare
  r record;
  v_index_name text;
  v_columns text;
begin
  for r in
    with foreign_keys as (
      select
        con.oid as constraint_oid,
        n.nspname as schema_name,
        c.relname as table_name,
        con.conname as constraint_name,
        con.conrelid,
        con.conkey,
        array_agg(a.attname order by k.ordinality) as column_names
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join lateral unnest(con.conkey) with ordinality as k(attnum, ordinality) on true
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
      where con.contype = 'f'
        and n.nspname = 'public'
        and c.relname like 'support\_%' escape '\'
      group by con.oid, n.nspname, c.relname, con.conname, con.conrelid, con.conkey
    )
    select *
    from foreign_keys fk
    where not exists (
      select 1
      from pg_index i
      where i.indrelid = fk.conrelid
        and i.indisvalid
        and i.indisready
        and (
          select array_agg(x order by ordinality)
          from unnest(i.indkey::smallint[]) with ordinality as u(x, ordinality)
          where ordinality <= cardinality(fk.conkey)
        ) = fk.conkey
    )
    order by table_name, constraint_name
  loop
    v_index_name := left(r.constraint_name, 50) || '_' || substr(md5(r.constraint_name), 1, 8) || '_idx';
    select string_agg(format('%I', column_name), ', ')
      into v_columns
    from unnest(r.column_names) as column_name;

    execute format(
      'create index if not exists %I on %I.%I (%s)',
      v_index_name,
      r.schema_name,
      r.table_name,
      v_columns
    );
  end loop;
end
$$;
